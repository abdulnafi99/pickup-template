// ---------------------------------------------------------------------------
// Shop configuration (Firebase)
//
// DEMO MODE (default): leave FIREBASE_CONFIG as null. All data (menu, orders,
// settings, accounts) is stored in this browser's LocalStorage and syncs live
// between tabs — perfect for trying the customer, staff and admin views.
//
// FIREBASE MODE: paste your Firebase web app config below. The app will then
// use Firebase Authentication, Cloud Firestore and Firebase Storage. Deploy
// firestore.rules and storage.rules from this repo. See README.md.
// ---------------------------------------------------------------------------

// Paste YOUR shop's Firebase web config here (see README → Step 3). Leave null for demo mode.
// (A Firebase web config is not a secret — access is controlled by firestore.rules / storage.rules.)
export const FIREBASE_CONFIG = null;
/* Example:
export const FIREBASE_CONFIG = {
  apiKey: 'AIza...',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:xxxxxxxxxxxx',
};
*/

// Owner accounts (Firebase Auth UIDs) that are always admin. The real check is in
// firestore.rules / storage.rules — keep this list identical to the one there.
export const OWNER_UIDS = []; // e.g. ['abc123yourOwnerUid'] — same list as in firestore.rules & storage.rules

export const FIREBASE_SDK_VERSION = '10.12.2';

export const APP_VERSION = '1.0.0';
