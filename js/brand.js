// ---------------------------------------------------------------------------
// BRAND — everything that makes this app "your shop" lives in this one file.
//
// For a new shop: change the values below, replace the images in icons/ (and
// optionally add img/banner.jpg), then update the shop name in index.html,
// manifest.json and offline.html (see README → Step 2). Menu, opening hours,
// payment methods, DuitNow QR, WhatsApp number etc. are set by the shop itself
// in the Admin panel — no code needed.
// ---------------------------------------------------------------------------
export const BRAND = {
  // Names
  name: 'Your Café',                       // shown in headers, receipts, notifications
  nameHTML: 'Your <em>Café</em>',          // home header & splash (the <em> part gets the accent colour)
  tagline: 'Order ahead • Skip the queue',

  // Home & welcome screen copy
  welcomeTitle: 'Order ahead.<br>Skip the queue.',
  heroChip: '☕ Skip the queue',
  heroTitle: 'Pre-order coffee,<br>pick up on time.',
  bannerImage: '',                         // optional photo behind the home banner, e.g. 'img/banner.jpg'

  // Colours (applied as CSS variables at start-up)
  colors: {
    primary: '#0B2A4A',      // main brand colour (headers, cards, buttons)
    primary2: '#173F6B',     // hover / lighter variant
    primaryDark: '#061A30',  // deep variant (on-dark cards)
    accent: '#BFD9FF',       // highlights: prices, badges, active chips (dark text sits on it)
    accentDark: '#2E6BC6',   // accent used as text on light backgrounds
    bg: '#F4F6FA',           // page background
    dark: '#0D1626',         // bottom nav, pills, toasts
  },

  // Optional loyalty programme. Set to null to hide every loyalty feature.
  // To award points automatically you also need the /api/loyalty keys (README → Loyalty).
  loyalty: null,
  /* Example:
  loyalty: {
    name: 'Rewards',                                   // card title / receipt heading
    url: 'https://your-loyalty-app.vercel.app',        // where customers join / log in
    pointsPerOrder: 10,
    perks: '5th stamp: RM3 off · 10th stamp: 1 free coffee',
  },
  */

  receiptThanks: 'Thank you!',
};

/** Apply the brand colours and title. Called once at start-up (js/app.js). */
export function applyBrand() {
  const root = document.documentElement.style;
  const c = BRAND.colors || {};
  const map = {
    '--primary': c.primary, '--primary-2': c.primary2, '--primary-dark': c.primaryDark,
    '--accent': c.accent, '--accent-dark': c.accentDark, '--bg': c.bg, '--dark': c.dark,
  };
  Object.entries(map).forEach(([k, v]) => { if (v) root.setProperty(k, v); });
  if (c.primary) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.primary);
  if (!document.title || document.title.startsWith('Your Café')) document.title = `${BRAND.name} — ${BRAND.tagline}`;
}
