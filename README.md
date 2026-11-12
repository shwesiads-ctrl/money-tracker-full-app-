# Money Tracker — Free Firebase Spark JSON Cloud Foundation

Windows Tauri Desktop + Android v2.6 Cloud Preview.

- **No Cloud Functions, no Blaze plan required**: Firebase Email/Password Auth + Cloud Firestore Standard Spark quota.
- **Firestore JSON sync**: Android SQLite ↔ owner-only `users/{uid}/sync/main` JSON document. Manual push/pull with revision conflict protection, Windows dashboard subscribes to updates.
- **QR device confirmation**: Windows must *first* sign into the same verified Firebase email account as Android; Android QR approval then opens Windows dashboard. **Not passwordless authentication or a second factor.** No token passing, no admin secrets.
- Security Rules block cross-account financial reads and writes; QR requests expire in two minutes. Clients must be connected to the same Firebase project.
- Existing offline Android data/finance features preserved; Cloud remains optional. Receipt images, biometrics, recovery keys are not uploaded.
- **Limitations**: no automated bidirectional merge, no E2EE financial payloads, no production runtime QA; requires Firebase Console setup and two client rebuilds. Back up before syncing. Spark quotas apply.

See `docs/DEPLOY.md` for setup and testing. No Firebase billing account/Blaze deployment required for this design.

## v2.6.3 — Dashboard Period Cards

Dashboard income/expense cards default to today's totals. Tap either card to choose Day / Week / Month / Year; labels and both amounts change together. Monday starts the week. Transfers do not contribute to income/expense. Existing monthly budget, reports, database and cloud preview remain unchanged. Android version code 12.
