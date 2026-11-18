# Pickup App Template (white-label)

PWA tempahan awal untuk kedai kopi / makanan: pelanggan pilih menu, pilih masa pickup (atau order dari meja), bayar, dan tunjuk QR di kaunter. Ada **Admin panel**, **Pickup Counter + POS** untuk staff, **push notification**, **auto-print resit Bluetooth 58mm**, dan **integrasi loyalty** (pilihan).

HTML + CSS + JavaScript biasa (ES modules), Firebase (Auth, Firestore, Storage), dan dua fungsi server di Vercel (`/api/push`, `/api/loyalty`).

Semua yang khusus untuk satu kedai dikumpul dalam **`js/brand.js`**. Menu, waktu buka, slot pickup, kaedah bayaran, DuitNow QR, WhatsApp, kod promo, kategori dan meja diurus oleh kedai sendiri dalam **Admin panel**.

---

## Cuba dulu (demo mode)

Tanpa Firebase, app berjalan dalam **demo mode**. Semua data disimpan dalam browser.

```bash
python3 -m http.server 8080      # atau: npx serve .
```

Buka <http://localhost:8080>.

| Peranan | Email | Password | Halaman |
|---|---|---|---|
| Admin | `admin@demo.shop` | `admin123` | `#/admin` |
| Staff | `staff@demo.shop` | `staff123` | `#/staff` |
| Pelanggan | tiada login (guest) | | `#/home` |

---

## Setup untuk kedai baru (senarai semak)

### 1. Salin template
GitHub → repo ni → **Use this template → Create a new repository**, contohnya `kedai-abc-order`.

### 2. Jenama kedai
- [ ] **`js/brand.js`**: nama, tagline, teks home, warna, `bannerImage` (pilihan), `loyalty` (biar `null` kalau tiada).
- [ ] **`icons/`**: ganti 8 imej dengan logo kedai, guna nama fail dan saiz yang sama:
  `favicon-32.png`, `favicon-48.png`, `icon-192.png`, `icon-512.png`, `maskable-512.png` (logo dalam 80% tengah), `apple-touch-icon.png` (180×180), `logo-256.png`, `badge-96.png` (putih atas latar lutsinar).
- [ ] **`index.html`**, **`manifest.json`**, **`offline.html`**: tukar "Your Café" kepada nama kedai, dan `theme-color` ikut warna utama.
- [ ] Banner gambar (pilihan): letak `img/banner.jpg`, set `bannerImage: 'img/banner.jpg'` dalam `brand.js`, dan tambah `'./img/banner.jpg'` dalam senarai `APP_SHELL` di `sw.js`.

### 3. Firebase (satu projek bagi setiap kedai)
- [ ] [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
- [ ] **Authentication** → Get started → aktifkan **Anonymous** dan **Email/Password**.
- [ ] **Firestore Database** → Create database (region `asia-southeast1`).
- [ ] **Storage** → Get started (pilihan; untuk gambar menu dan resit. Kalau tiada, gambar disimpan dalam Firestore).
- [ ] Project settings → **Your apps → Web app** → copy config, kemudian paste ke **`js/config.js`** (`FIREBASE_CONFIG`).

### 4. Akaun owner (admin)
- [ ] Authentication → Users → **Add user** (email + password owner).
- [ ] Copy **User UID**, dan letak di tiga tempat ni:
  - `js/config.js` → `OWNER_UIDS`
  - `firestore.rules` → ganti `REPLACE_WITH_OWNER_UID`
  - `storage.rules` → ganti `REPLACE_WITH_OWNER_UID`
- [ ] Firestore → **Rules** → paste isi `firestore.rules` → **Publish**. Buat yang sama untuk Storage dengan `storage.rules`.

### 5. Deploy ke Vercel
- [ ] [vercel.com](https://vercel.com) → **Add New → Project** → import repo kedai → Deploy. Tiada build command.
- [ ] Firebase → Authentication → Settings → **Authorized domains** → tambah domain Vercel kedai.

### 6. Key di Vercel (Settings → Environment Variables)

| Variable | Untuk | Cara dapat |
|---|---|---|
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Push notification | `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | Push notification | `mailto:email-kedai@contoh.com` |
| `FIREBASE_SERVICE_ACCOUNT` | Push staff bila app ditutup, dan loyalty | Firebase → Project settings → Service accounts → **Generate new private key** → paste **seluruh** JSON |
| `APP_NAME` | Tajuk notifikasi ujian (pilihan) | Nama kedai |

Lepas tambah key, buat **Redeploy**. ⚠️ Fail JSON key ni rahsia: jangan commit ke GitHub.

### 7. Isi data kedai (dalam app)
Log masuk sebagai owner → `#/admin`:
- **Shop & Payment**: nama kedai, WhatsApp, kaedah bayaran, DuitNow QR, kod promo
- **Menu**: tekan *Seed sample menu* untuk mula, atau terus tambah menu sendiri. Urus kategori dan add-on.
- **Pickup Settings**: waktu buka, slot, kapasiti, masa penyediaan
- **Table QR**: cetak QR meja (kalau ada dine-in)
- Tambah staff: daftar akaun di Authentication, kemudian set `role: "staff"` pada `users/<uid>` di Firestore.

### 8. Tablet kaunter
Chrome Android → buka app → **Install** → log masuk staff → Pickup Counter:
- ☰ → **Hidupkan order alerts** (push order baru)
- ☰ → **Receipt printer → Connect printer** (printer Bluetooth BLE 58mm) → **Test print**
- Biar skrin sentiasa hidup (Stay awake) dan Battery: *Unrestricted*.

---

## Loyalty (pilihan)

Untuk kedai yang ada app loyalty atas **Firebase Realtime Database**, dengan data dalam bentuk:

```
customers/<0123456789>: { name, phone, stamps, points, pointsExpiry, cardCycle, stampClaims/... }
```

Setiap order yang **Completed** akan dapat **+1 cap dan +N point**. Order yang sama hanya dapat point sekali. Nombor telefon yang belum berdaftar akan didaftarkan sebagai ahli baru. Halaman order dan resit juga akan papar kad dan QR untuk sertai loyalty.

1. `js/brand.js` → isi `loyalty: { name, url, pointsPerOrder, perks }`
2. Di Vercel, tambah:

| Variable | Nilai |
|---|---|
| `LOYALTY_SERVICE_ACCOUNT` | JSON service account projek Firebase **loyalty** |
| `LOYALTY_DB_URL` | `https://<projek-loyalty>-default-rtdb.firebaseio.com` |
| `LOYALTY_POINTS` | (pilihan) point setiap order, default `10` |
| `LOYALTY_REWARD_5`, `LOYALTY_REWARD_10` | (pilihan) nama reward cap ke-5 dan ke-10 |

3. Redeploy.

---

## Struktur fail

```
index.html, manifest.json, offline.html, sw.js   kerangka PWA (nama kedai: Step 2)
css/app.css                                      semua gaya (warna dikawal oleh brand.js)
js/brand.js                                      ★ jenama kedai
js/config.js                                     ★ Firebase + owner UID
js/app.js                                        router + boot
js/store.js                                      data (demo LocalStorage / Firebase)
js/views/                                        customer, admin, staff, POS, laporan
js/push.js, js/printer.js, js/loyalty.js          notifikasi, printer Bluetooth, loyalty
api/push.js, api/loyalty.js                      fungsi server Vercel
firestore.rules, storage.rules                   ★ keselamatan (owner UID)
```

Setiap kali deploy perubahan besar, naikkan `VERSION` dalam `sw.js` supaya telefon pelanggan ambil fail baru.
