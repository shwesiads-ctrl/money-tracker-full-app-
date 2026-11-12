# Deployment checklist — Money Tracker Windows + Android

## 1. Firebase project

1. Create a project at https://console.firebase.google.com/. Cloud Functions for Firebase requires **Blaze pay-as-you-go** billing. Set a cost budget/alert and review quota usage. The regional functions in this package use `asia-southeast1` (Singapore).
2. Register **one Firebase Web App** and copy its public configuration (`apiKey`, `authDomain`, `projectId`, `appId`). Do not use service-account credentials in the clients.
3. Enable **Authentication → Sign-in method → Email/Password**; require email verification from the UI.
4. Enable **Cloud Firestore**. Choose an appropriate location; changing database location later can require migration. Deploy restrictive Security Rules before real user data.
5. Review Firebase **Authentication → Settings → Authorized domains**; do not add insecure production origins. The QR flow uses custom tokens rather than a popup/OAuth redirect.

## 2. Deploy Cloud Functions & Firestore Rules

Install Node 22+ and the Firebase CLI on your trusted computer:

```bash
npm install -g firebase-tools
firebase login
cd firebase
cp .firebaserc.example .firebaserc
# replace YOUR_FIREBASE_PROJECT_ID in .firebaserc
cd functions
npm install
npm run build
npm test
cd ..
firebase deploy --only functions,firestore:rules,storage
```

Functions: `startPair`, `pollPair`, `approvePair`, `completePair` in region `asia-southeast1`. Firestore document `users/{uid}/sync/main` is accessible only by its verified-email owner. Pairing and rate-limit collections are server-only.

## 3. Android app Cloud Config

Update **`android/src/cloudConfig.ts`** with the *public* Firebase Web App config (safe for distributed clients, but restrict API keys in Google Cloud as appropriate). Keep the same project values as Windows. Sign in with a verified Firebase email account, then use **Upload Android → Firebase**. Keep the existing local sign-in/profile as the device lock. Build from `android/`:

```bash
npm install
npm run test:core
npm run typecheck
npx expo prebuild --platform android --no-install
cd android
./gradlew :app:assembleRelease
```

On Windows replace `./gradlew` with `gradlew.bat`; Java 17 / Android SDK needed. Native QR scanning requires camera permission. The app still works offline without cloud credentials, showing an explanatory setup message.

## 4. Windows executable

Edit `windows/.env` using `windows/.env.example` to fill the **same public config**. From Windows 11 with Visual C++ Build Tools, Rust MSVC toolchain and WebView2 installed:

```powershell
cd windows
npm install
npm test
npm run build
npm run tauri build -- --bundles nsis
```

The `.exe` installer is under `windows/src-tauri/target/release/bundle/nsis/`. GitHub Actions workflow `.github/workflows/windows-build.yml` can compile on a Windows runner after the source is committed. Set GitHub Actions **repository secrets/vars** for the Firebase public config before release builds if you want a preconfigured executable; never include service account secrets. The current workflow builds a safe **unconfigured preview** unless you provide configuration during build.

## 5. Acceptance test before use

- Test QR expiration after 120s; wrong code rejected; a QR cannot be used twice; Windows QR **never contains the desktop secret**.
- Test Android email verification required for Cloud Functions and Firestore owner-only rules; account A cannot read account B.
- Test phone denial and cancellation, device loss, Firebase password reset and logout on Windows.
- Test first Android upload → Windows dashboard, Windows new transaction → Android download, duplicate IDs and revision conflicts.
- Test disconnected/online state, 2,000+ transactions, large data sets and Firestore document size limitations.
- Test with copied **non-sensitive demo data first**. Verify local SQLite, login/biometric state, recurring occurrences and existing receipt attachments survive before enabling cloud sync on real data.
- Test signing certificate compatibility with installed Android v2.5.2. Do not uninstall the current application just to replace it.

## 6. Production hardening still required

- Robust App Check compatible with Tauri and Android; server-side abuse prevention, per-account device revocation, session inventory and audited logout.
- Incremental per-record sync with tombstones, idempotent posted recurring transactions, conflict UI and offline outbox. Do **not** enable automatic two-way overwrites until these are implemented and tested.
- Optional end-to-end encryption of financial payloads and receipt photos with secure cross-device key transfer.
- Full Firebase emulator Firestore rules tests, real-device QR camera tests, and Windows installer signing and antivirus QA.
