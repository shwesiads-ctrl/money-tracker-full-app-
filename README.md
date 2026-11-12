# Money Tracker Android — v2.5.2

Android **React Native + TypeScript / Expo SDK 58**, offline-first with SQLite. Existing app ID `com.shwesiads.moneytracker` and SQLite database `money-tracker-ts.db` are preserved for in-place upgrades.

## Features

- Previous v2.4 dashboard, transactions, wallets, category summaries, expense reports, 6-month chart, login/password recovery, fingerprint/face unlock, profile photo, reminders, Back exit confirmation, pull-to-refresh.
- **Recurring transactions**: weekly or monthly income/expense templates. Posting **requires explicit user confirmation** and an overdue date. Unique occurrence rows prevent accidental double posting. Templates can be paused or removed without deleting posted ledger entries.
- **Category budgets**: per-month, per-currency limits with 75% / 90% / 100% visual warnings and opt-in generic Android notifications. Budget alerts do not show amounts, descriptions or category titles on the lock screen.
- **Debt & loan tracker**: money lent or borrowed, due date, partial repayments and remaining balance. These are informational: **they do not automatically change wallet balances**, to avoid double counting; record real transfers/expenses in Transactions separately.
- **Savings goals**: target, contributions and progress. These are tracking entries only, not wallet transfers.
- **Encrypted backup**: password-based PBKDF2-HMAC-SHA256 (210,000 iterations) and authenticated XChaCha20-Poly1305. Exports wallets, categories, transactions, budgets, preferences, feature records and receipt photos (size limits apply). Password is not stored; losing it makes the backup unrecoverable. Profile login credentials, device biometric keys and reminder schedules are **not** contained in the backup.
- **Receipt attachments**: one photo per financial transaction, copied to private app storage. Preview/replace/remove from transaction list. This is not OCR or automatic transaction entry.
- **PDF reports**: shareable PDF generated locally from the selected report date range/currency; CSV export retained.
- **Android home screen widget**: summary with financial amounts **hidden by default**. Explicit Settings opt-in reveals the selected-currency balance on the device home screen.

## Data migration / backup safety

The v2.5 migration adds tables using `CREATE TABLE IF NOT EXISTS` without changing existing financial records or the Android package ID. Update the installed app **without uninstalling**. First create an existing JSON backup from v2.4 if possible. This APK is a testing build and needs acceptance testing on a real Android device.

Encrypted backups are **not** synonymous with an encrypted SQLite database. Existing local account security is unchanged: credentials stored via SecureStore, local financial SQLite remains unencrypted at rest by this app. Keep your Android device lock enabled.

### Restore behavior

Encrypted v2.5 restore replaces the financial ledger plus v2.5 feature tables after decryption and structural validation; receipt files are reconstructed. Old v2.2-v2.4 plaintext JSON backups can still be imported through the explicitly labeled legacy import action (they do not include new feature data). Please export your own backup **before restoring**.

## Build / Test

```bash
cd android
npm install
npm run test:core
npm run typecheck
npx expo prebuild --platform android --no-install
cd android
./gradlew :app:assembleRelease
```

GitHub Actions creates a **private prerelease** when compilation succeeds; inspect `.github/workflows/android-apk.yml`. The APK uses a testing signature, not a Google Play distribution signature. The Expo Widgets implementation requires a native build (not Expo Go).

**Status:** Core/feature pure tests pass locally. GitHub Actions and real-device end-to-end validation are required before production use. Dependencies could not be installed in the sandbox due to network limitations.

## Developer

Myominaung (Myanmar) · +959256060722 · Telegram [@kominit](https://t.me/kominit) · linkstar2012@gmail.com

## v2.5.2 Widget UI

- Dark navy opaque background, rounded card, green title, white balance and no cluttered helper text.
- Two Android widgets: Compact 2x2 and Balance 4x2 (monthly income/expense).
- Both hide amounts by default and obey Settings > Show Balance on Home Widget.
- Existing SQLite, finance, fingerprint, login, backup and Back-key behavior preserved. Version code 8.
- After update, remove and re-add the widget from the launcher. Physical device visual QA is required.
