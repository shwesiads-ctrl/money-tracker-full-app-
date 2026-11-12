# Money Tracker — Windows + Android Firebase Cloud Foundation (v0.1)

Owner/developer: **Myominaung (Myanmar)** · Telegram [@kominit](https://t.me/kominit) · `linkstar2012@gmail.com`

## What is included

1. **Windows**: Tauri 2 / React / TypeScript desktop UI, QR Login, Dashboard, Wallets, Transactions, Reports and remote Firestore snapshot subscription. Windows can create transactions through a Firestore transaction with revision increment and validation.
2. **Android**: v2.5.2 source copied forward to **v2.6.0 cloud preview**, adding Camera QR scan, Cloud Email + Password sign-in, email verification, explicit approve/reject QR login, manual upload and download with conflict prevention, while retaining original local SQLite.
3. **Firebase**: Cloud Functions v2 in Singapore region, Firestore owner-only security rules, deny-all Cloud Storage rules and pairing session lifetime/rate limits.
4. **GitHub Actions**: Workflow to build a Windows NSIS Setup `.exe` and Android Cloud Preview APK after code is committed to your repository. Workflow run builds are *not* proof of functional cloud login until the Firebase project is deployed and its configuration inserted.

## Workflow

1. Run Windows app, click Generate QR. The app creates a **random secret** held only on Windows and submits its SHA-256 hash to Cloud Functions. The QR contains a one-time session identifier plus six-digit code, **not** the secret or Firebase token.
2. Sign in to the **same Firebase project** on Android using a verified Cloud email account. Use **Cloud Sync → Scan Windows Login QR**.
3. Compare the six-digit code with the Windows screen, confirm that you trust the PC, and tap **Approve Windows Login**.
4. The Cloud Function uses a server-side transaction, one-time secret and 120s expiration to mint a Firebase Custom Token. Windows uses `signInWithCustomToken`, receives its **own Firebase session**, then subscribes to `users/{uid}/sync/main`.
5. Android: **Upload Android → Firebase** to initialize cloud data; Windows displays the cloud snapshot. Windows transaction additions cause an immediate Firestore revision increment. Android: **Download Firebase → Android** to safely retrieve updates (only when local changes have not diverged).

## Current sync limitations — read before putting money records on the cloud

This is a **foundation / test build**, not a production-ready finance sync. It supports a versioned **whole-dataset snapshot**, not yet a production incremental/paginated sync engine. Firestore documents are limited to 1 MiB; the app caps payloads at ~760 kB / up to 2,000 transactions. Automatic background bidirectional sync, fine-grained merge of concurrent edits, server-side ledger auditing, offline conflict resolution and multi-device cash reconciliation remain future milestones. To prevent financial loss, **revision conflicts block updates** instead of silently overwriting them. Android download is manual and asks confirmation; users must export a validated **encrypted backup first**.

The synchronized snapshot covers wallets, categories, transactions, budgets, app presentation settings, recurring templates and posted occurrence IDs, category budgets, debts, debt repayments, savings goals and goal contributions. Receipt photo bytes and device-local `file://` paths are excluded. Local PIN/password, recovery secrets, biometric keys and reminder schedules remain on the device. No real bank integration. **Firestore data is not end-to-end encrypted**: Firebase encrypts infrastructure storage but your Firebase project admins can access account data. Enable strong account security, Firestore rules, and cost alerts.

## Setup

Full instructions: [`docs/DEPLOY.md`](docs/DEPLOY.md). Credentials/project configuration are intentionally **not** bundled. Never put a Firebase Admin SDK private key or service account secret into app source, ZIP, GitHub or a QR code.

## Existing Android data / upgrade

The app ID remains `com.shwesiads.moneytracker`, SQLite name remains `money-tracker-ts.db`; local finance and auth features are preserved. Android versionCode increments to 9. However, **APK signing compatibility has not been verified in this package**. Create JSON + encrypted backup and use an **update installation**, never uninstall first.

## Build/testing status

Local security/source checks can be run without credentials via `node --test windows/tests/*.test.mjs firebase/functions/tests/*.test.mjs`; actual dependency typecheck, emulator security tests, live Firebase pairing, Android camera permission, UI and Windows NSIS build require the proper environments. Source generation is not a successful build claim. Do not treat sample code as deployed services.
