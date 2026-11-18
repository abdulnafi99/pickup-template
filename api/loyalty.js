// ---------------------------------------------------------------------------
// Optional: order app → loyalty app (Vercel Serverless Function)
//
//   POST /api/loyalty  { orderId }
//
// When staff mark an order "Completed", the staff app calls this endpoint (only
// if BRAND.loyalty is set in js/brand.js). The server (never the browser):
//   1. reads the order from this app's Firestore and checks it really is
//      Completed, not a POS sale, and has a Malaysian mobile number;
//   2. claims the order once in the loyalty database (preorder/awards/<id>),
//      so the same order can never earn twice;
//   3. adds 1 stamp + points to customers/<phone> in the loyalty Realtime
//      Database: points expiry kept/renewed for 1 year, the 5th/10th stamp
//      creates a stampClaims reward, a full card (10) resets and starts a new
//      cycle, expired points reset to 0 first;
//   4. registers unknown numbers as new members (1 stamp + points);
//   5. logs the award under customers/<phone>/preorderHistory/<orderId>.
//
// Expected loyalty data shape (Firebase Realtime Database):
//   customers/<phone e.g. 0123456789>: { name, phone, stamps, points, pointsExpiry,
//     cardCycle, createdAt, stampClaims/<c{cycle}_m{5|10}>: { milestone, cycle, reward, status } }
//
// Environment variables (Vercel → Settings → Environment Variables):
//   FIREBASE_SERVICE_ACCOUNT   this app's Firebase project key (also used by /api/push)
//   LOYALTY_SERVICE_ACCOUNT    the loyalty app's Firebase project key — whole JSON
//   LOYALTY_DB_URL             the loyalty Realtime Database URL (https://<project>-default-rtdb.firebaseio.com)
//   LOYALTY_POINTS             optional, points per order (default 10)
//   LOYALTY_REWARD_5 / LOYALTY_REWARD_10   optional reward names for the 5th / 10th stamp
// ---------------------------------------------------------------------------
const POINTS_PER_ORDER = Number(process.env.LOYALTY_POINTS) || 10;
const ORDER_ID = /^PNG-\d{6}-[A-Z0-9]{4}$/;
const MILESTONES = { 5: process.env.LOYALTY_REWARD_5 || 'RM3 Discount', 10: process.env.LOYALTY_REWARD_10 || '1 Free Coffee' };

let apps = null;
function getApps() {
  if (apps) return apps;
  let admin;
  try {
    admin = require('firebase-admin');
  } catch {
    throw Object.assign(new Error('firebase-admin is not installed.'), { status: 503 });
  }
  const parse = (name) => {
    const raw = process.env[name] || process.env[`${name}2`]; // accept e.g. FIREBASE_SERVICE_ACCOUNT2 too
    if (!raw) throw Object.assign(new Error(`Loyalty is not configured (${name} missing).`), { status: 503 });
    const cred = JSON.parse(raw);
    if (typeof cred.private_key === 'string') cred.private_key = cred.private_key.replace(/\\n/g, '\n');
    return cred;
  };
  const shop = admin.apps.find((a) => a.name === '[DEFAULT]')
    || admin.initializeApp({ credential: admin.credential.cert(parse('FIREBASE_SERVICE_ACCOUNT')) });
  const loyalty = admin.apps.find((a) => a.name === 'loyalty')
    || admin.initializeApp({
      credential: admin.credential.cert(parse('LOYALTY_SERVICE_ACCOUNT')),
      databaseURL: (() => {
        if (!process.env.LOYALTY_DB_URL) throw Object.assign(new Error('Loyalty is not configured (LOYALTY_DB_URL missing).'), { status: 503 });
        return process.env.LOYALTY_DB_URL;
      })(),
    }, 'loyalty');
  apps = { admin, firestore: shop.firestore(), rtdb: loyalty.database() };
  return apps;
}

/** '012-345 6789' / '+60123456789' / '60123456789' → '0123456789' (the loyalty app's key format). */
function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('60')) d = '0' + d.slice(2);
  return /^01\d{8,9}$/.test(d) ? d : '';
}

function expiryFrom(existing) {
  // Same rule as the loyalty app's getExpiryDateString(): keep a future expiry, else +1 year.
  if (existing && new Date(existing) > new Date()) return existing;
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

async function award(orderId) {
  const { admin, firestore, rtdb } = getApps();
  const orderRef = firestore.collection('orders').doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) return { ok: false, reason: 'order-not-found' };
  const order = snap.data();
  if (order.status !== 'Completed') return { ok: false, reason: 'not-completed' };
  if (order.source === 'pos') return { ok: false, reason: 'pos-order' };
  if (order.loyalty?.awarded) return { ok: true, already: true, phone: order.loyalty.phone, points: order.loyalty.points };

  const phone = normalizePhone(order.customer?.phone);
  if (!phone) {
    await orderRef.update({ loyalty: { awarded: false, reason: 'no-valid-phone' } }).catch(() => {});
    return { ok: false, reason: 'no-valid-phone' };
  }

  // 1) Claim this order once in the loyalty DB.
  const nowIso = new Date().toISOString();
  const claimRef = rtdb.ref(`preorder/awards/${orderId}`);
  const claim = await claimRef.transaction((cur) => (cur ? undefined : { phone, at: nowIso, total: Number(order.total) || 0 }));
  if (!claim.committed) return { ok: true, already: true, phone };

  try {
    // 2) Add the stamp + points (or register a new member).
    const custRef = rtdb.ref(`customers/${phone}`);
    let created = false;
    let newClaims = [];
    let result = null;
    const tx = await custRef.transaction((cur) => {
      newClaims = [];
      if (!cur) {
        created = true;
        result = { stamps: 1, points: POINTS_PER_ORDER };
        return {
          name: String(order.customer?.name || 'Pelanggan').slice(0, 60),
          birthdate: '',
          phone,
          stamps: 1,
          points: POINTS_PER_ORDER,
          pointsExpiry: expiryFrom(null),
          createdAt: nowIso,
          source: 'preorder-app',
        };
      }
      created = false;
      const expired = cur.pointsExpiry && new Date() > new Date(cur.pointsExpiry);
      let stamps = Number(cur.stamps) || 0;
      let cycle = Number(cur.cardCycle) || 0;
      let points = expired ? 0 : Number(cur.points) || 0;
      if (stamps >= 10) { // card was already full: make sure its reward exists, start a new card
        newClaims.push({ cycle, milestone: 10 });
        stamps = 0;
        cycle += 1;
      }
      stamps += 1;
      points += POINTS_PER_ORDER;
      if (stamps === 5 || stamps === 10) newClaims.push({ cycle, milestone: stamps });
      const shownStamp = stamps;
      if (stamps >= 10) { stamps = 0; cycle += 1; }
      result = { stamps: shownStamp, points };
      return { ...cur, stamps, cardCycle: cycle, points, pointsExpiry: expiryFrom(expired ? null : cur.pointsExpiry) };
    });
    if (!tx.committed) throw new Error('Loyalty update was not saved.');

    // 3) 5th / 10th stamp rewards — same deterministic keys as the loyalty app.
    for (const c of newClaims) {
      const ref = rtdb.ref(`customers/${phone}/stampClaims/c${c.cycle}_m${c.milestone}`);
      await ref.transaction((cur) => (cur ? undefined : {
        milestone: c.milestone, cycle: c.cycle, reward: MILESTONES[c.milestone], status: 'pending', createdAt: nowIso,
      }));
    }

    // 4) Log it (loyalty DB) and mark the order (shop DB).
    await rtdb.ref(`customers/${phone}/preorderHistory/${orderId}`).set({
      orderId, points: POINTS_PER_ORDER, stamp: result.stamps, total: Number(order.total) || 0, at: nowIso,
    });
    await orderRef.update({
      loyalty: { awarded: true, phone, points: POINTS_PER_ORDER, stamp: result.stamps, newMember: created, at: Date.now() },
    });
    void admin;
    return { ok: true, phone, points: POINTS_PER_ORDER, balance: result.points, stamp: result.stamps, newMember: created, rewards: newClaims.map((c) => MILESTONES[c.milestone]) };
  } catch (err) {
    await claimRef.remove().catch(() => {}); // let staff retry
    throw err;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const orderId = body && typeof body.orderId === 'string' ? body.orderId : '';
  if (!ORDER_ID.test(orderId)) return res.status(400).json({ error: 'Invalid order id.' });
  try {
    const result = await award(orderId);
    return res.status(200).json(result);
  } catch (err) {
    console.error('loyalty award failed', err && err.message);
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not add loyalty points.' });
  }
};
