# Money Tracker — Firebase Spark Free JSON Sync (no Cloud Functions)

## Services to enable — NO Blaze required within Spark quotas

1. Create a free Firebase **Spark** project at https://console.firebase.google.com/.
2. Register Firebase **Web app**. Copy only `apiKey`, `authDomain`, `projectId`, and `appId` into `windows/.env` (from `.env.example`) and Android `android/src/cloudConfig.ts`.
3. Enable **Authentication → Email/Password**; verify the email address on both devices.
4. Enable **Cloud Firestore Standard** with the free default database. Under Firestore → Rules, paste `firebase/firestore.rules`, or deploy from the CLI:

```bash
npm install -g firebase-tools
firebase login
cd firebase
cp .firebaserc.example .firebaserc
# replace YOUR_FIREBASE_PROJECT_ID
firebase deploy --only firestore:rules,firestore:indexes
```

No Cloud Functions or Firebase Storage deployment. No service account JSON or admin private keys in clients.

## Windows device authorization via QR — no backend

1. On Android, log into the Cloud Sync panel using Firebase Email/Password; verify email and **Upload Android → Firebase** (first device).
2. On Windows, sign in using the **same verified Firebase Email/Password**. Windows creates `users/{uid}/pairs/{sessionId}` with a random one-time code and 2-minute expiry, then shows its QR.
3. On Android open **Scan Windows Device QR**, check matching digits, tap **Approve**.
4. Windows observes the approved JSON document and unlocks its dashboard. It marks the pairing complete and deletes the used document.

**Security**: Windows account authentication MUST happen first. The QR confirmation does not issue identity tokens and cannot securely replace password login without a trusted server. It is a user confirmation layer, NOT Firebase MFA. Firestore Rules limit pairing documents and financial data to the same authenticated, verified UID. A client signed into the same account can still write its own pair document, so do not describe QR as a cryptographically independent second factor.

## Cloud JSON storage

`users/{uid}/sync/main` document: `{schema:1, revision:integer, deviceId:string, payload:{wallets, categories, transactions, budgets, settings, recurring, categoryBudgets, debts, debtPayments, goals, goalContributions, recurringOccurrences}, updatedAt:timestamp}`.

The `revision` is incremented atomically, and mismatched revisions are rejected. Conflicts require manual review. Cloud JSON is **not end-to-end encrypted**; do not put local PIN, recovery key, device secrets or receipt file paths in it. Local financial SQLite remains the primary Android store. Firestore document limit applies; migrate to per-record sync for larger ledgers.

Firestore Spark limits (subject to change): one free database, 1 GiB storage, 50,000 reads/day, 20,000 writes/day and 20,000 deletes/day. Exceeding free limits may block usage until quotas reset; no Blaze billing upgrade is needed for this foundation.

## Test

- Android and Windows must be configured for the same Firebase project and verified UID. Try cross-account access (must be denied) and expired QR approval (must fail).
- With no server runtime, there is no Cloud Functions deployment/test. Use `cd windows && npm install && npm test && npm run build`. For Android, `cd android && npm install && npm run test:core && npm run typecheck` and native APK build.
- Test with demo transactions. On Android make an encrypted backup before syncing. Do not uninstall the existing APK; installer signing/version compatibility must be checked.
- Windows local auth sessions are not persisted after closing. Each new Windows session requires Firebase login and Android QR approval.
- Receipt photos, local PINs, recovery keys, biometric data and scheduled reminders remain device-local. Live automatic conflict-free two-way sync is **not** implemented; supported sync is explicit upload/download and Windows Firestore subscription.

## Optional JSON-file-only mode

A plain downloadable JSON file with no authenticated database is unsafe for private financial data and cannot support secure QR device approval. Use Firestore JSON documents and owner-only Rules instead.
