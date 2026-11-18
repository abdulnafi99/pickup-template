// ---------------------------------------------------------------------------
// Optional loyalty programme (BRAND.loyalty in js/brand.js). When staff complete
// an order, ask the server to add 1 stamp + points to the customer's loyalty
// account (matched by phone). Everything here is off while BRAND.loyalty is null.
// The server does all the checks and only awards each order once, so calling
// this twice (or from two staff devices) is harmless.
// ---------------------------------------------------------------------------
import { Store } from './store.js';
import { toast } from './ui.js';
import { BRAND } from './brand.js';

const L = () => BRAND.loyalty || null;
/** Loyalty app link (customers join / log in there). '' when loyalty is off. */
export const loyaltyUrl = () => (L() ? (Store.settings?.loyaltyUrl || L().url || '') : '');
export const loyaltyName = () => L()?.name || 'Rewards';

const escHTML = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** "Join <Rewards>" card for the order page (QR is drawn into [data-loyalty-qr]). */
export function loyaltyCardHTML(o) {
  if (!L() || !loyaltyUrl()) return '';
  if (!o || o.status === 'Cancelled' || o.source === 'pos') return '';
  const pts = L().pointsPerOrder || 10;
  const phone = String(o.customer?.phone || '').trim();
  const url = loyaltyUrl();
  const status = o.loyalty?.awarded
    ? `<p class="lc-earned">✓ <b>+${o.loyalty.points || pts} pts</b> and 1 stamp added to <b>${escHTML(o.loyalty.phone || phone)}</b></p>`
    : phone
      ? `<p>Earn <b>1 stamp + ${pts} pts</b> when you collect this order. Points go automatically to <b>${escHTML(phone)}</b> — just log in with this number.</p>`
      : `<p>Add your phone number at checkout next time to earn <b>1 stamp + ${pts} pts</b> per order.</p>`;
  return `<div class="card loyalty-card">
    <div class="lc-body">
      <span class="lc-chip">☕ ${escHTML(loyaltyName())}</span>
      <h3>Collect stamps, get free coffee</h3>
      ${status}
      ${L().perks ? `<p class="lc-perks">${escHTML(L().perks)}</p>` : ''}
      <a class="btn btn-accent btn-sm" href="${escHTML(url)}" target="_blank" rel="noopener">Open & install ↗</a>
    </div>
    <div class="lc-qr"><div data-loyalty-qr></div><small>Scan to join</small></div>
  </div>`;
}

export async function awardLoyalty(order) {
  if (!L()) return null; // loyalty switched off in js/brand.js
  if (Store.mode !== 'firebase') return null; // demo mode has no real orders
  if (!order || order.status !== 'Completed' || order.source === 'pos') return null;
  if (!order.customer?.phone) return null;
  try {
    const res = await fetch('/api/loyalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 503) { console.warn('loyalty not configured:', data.error); return null; } // keys not set on Vercel yet
    if (!res.ok) throw new Error(data.error || `Loyalty failed (${res.status})`);
    if (data.ok && !data.already && data.points) {
      const reward = data.rewards?.length ? ` 🎁 ${data.rewards.join(', ')} unlocked!` : '';
      const who = data.newMember ? 'New loyalty member' : 'Loyalty';
      toast(`⭐ ${who}: +${data.points} pts · Stamp ${data.stamp}/10 (${data.phone})${reward}`, 'success', 5000);
    }
    return data;
  } catch (e) {
    console.warn('loyalty', e.message);
    toast(`Loyalty points not added: ${e.message}`, 'error', 5000);
    return null;
  }
}
