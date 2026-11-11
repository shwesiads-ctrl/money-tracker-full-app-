# Money Tracker Android — React Native + TypeScript

Offline-first Myanmar/English money tracker for Android, using Expo SDK 58, React Native 0.88 and SQLite.

## Status

- TypeScript financial-core tests **10/10 pass** in an offline Node.js environment.
- React/React Native and native APK runtime tests **not yet verified**. Expo dependencies cannot be installed in this build sandbox due to no internet access.
- `.github/workflows/android-apk.yml` builds a **testing-only APK** in GitHub Actions after source is pushed. GitHub may require Actions enabled and the workflow to be manually dispatched or fixed if upstream tool versions change.
- **Not yet production ready**; review security, backups, UI, and real-device functionality before handling sensitive records.

## Features

- Dashboard: wallet balances, monthly income/expenses, monthly budget progress
- Add/edit/delete transactions and wallet-to-wallet transfers
- SQLite local database, no PHP hosting required for Android app
- Full Myanmar/English UI, light/dark mode
- Cash, KBZPay, WavePay, AYA Pay, CB Pay, Bank/Card, custom wallets/categories
- Separate MMK and USD ledgers, *no automatic exchange-rate conversion*
- Transaction search, filters, category and daily summaries, CSV export
- Full-account JSON backup & restore (supports compatible PHP v1.0 backups)

## Quick start

```bash
cd android
npm install
npm run test:core
npm run typecheck
npx expo start
```

To build an **installable testing APK** in GitHub, open **Actions → Build Money Tracker Android APK → Run workflow** (or push a change under `android/`). When build succeeds, open its run page, download **money-tracker-android-testing-apk** under Artifacts, extract the ZIP, and install the APK.

**Important:** The testing APK is built with Expo's generated local debug/test signing configuration, not with a separately managed secure production signing key. Do **not** distribute it as a production or Play Store release. For release builds, manage your signing key securely and use an EAS Production profile / Android App Bundle as appropriate.

A manual Expo cloud APK build is also supported:

```bash
cd android
npm install
npx eas-cli build -p android --profile preview
```

This requires your **own** Expo account login/project initialization and may require setting up credentials. `eas.json` already requests APK output for preview.

## Project layout

- `android/App.tsx` — app provider
- `android/src/Tracker.tsx` — React Native screens and UI
- `android/src/core.ts` — pure TypeScript financial logic and backup validation
- `android/src/database.ts` — SQLite schema and transaction CRUD
- `android/src/export.ts` — Android share and JSON file import/export
- `android/src/i18n.ts` — Myanmar/English translations
- `android/tests/core.test.ts` — financial core tests
- `.github/workflows/android-apk.yml` — GitHub Actions testing APK build

## Privacy and data

All normal financial records remain in the phone's local SQLite database; no online account or server synchronization is implemented. JSON backup and CSV export are **unencrypted**: keep exported copies private. Backup restore replaces the current dataset after validation; make a backup first. This is a personal finance tracker, not regulated accounting software.

## Financial model

Each currency has its own ledger and wallet opening balance. Transfers between wallets do not count as income/expenses. Budget applies to expense entries in the current calendar month for the selected currency.

## Verification

```bash
cd android
npm run test:core    # 10 tests
npm run typecheck    # requires npm packages installed
```

No Android APK was generated inside the sandbox: no Android SDK + npm network access were available. The GitHub Actions workflow has to run to produce the first verified APK.

## v2.1 UI & branding improvements
- Fixed 5-tab Android navigation: compact one-line Myanmar/English labels, larger touch areas, central Add action and accessible tab names.
- New native Android app icon, adaptive launcher icon and Expo splash screen (SDK 58 plugin).
- Dashboard includes live income-versus-expense proportion and a tappable six-month grouped bar chart using actual SQLite transaction records, with no fabricated amounts.
- No changes to database identity (`money-tracker-ts.db`) or Android package ID; user data remains stored locally.
- **Signing warning:** CI testing APKs may use different ephemeral signing keys. If Android refuses to update an existing installation, export a JSON backup from the current version *before* uninstalling it, then restore after installing the new APK.

## v2.2 — Local full-profile login & Android UX fixes

- First launch registration with username, display name, 10+ character password, and one-time **160-bit recovery key** (store offline).
- Local login with PBKDF2-HMAC-SHA256 (120,000 iterations, per-secret random salt), secure device keystore storage, and persistent failed-attempt backoff.
- Password reset with recovery key; a successful reset turns off biometrics until explicitly re-enabled.
- Optional fingerprint/face sign-in via a device-authenticated SecureStore token. Requires enrolled device biometrics; password login remains available when biometric keys become invalid.
- Editable display name, locally stored profile picture, change password, regenerate recovery key and lock/logout.
- Lock when the app has been backgrounded for over 60 seconds or left idle for five minutes (app-level timeout).
- Bottom navigation uses fixed-height icon/label slots and extra Android gesture-area padding to prevent Myanmar-script label collisions.
- Preserves Android package `com.shwesiads.moneytracker` and SQLite name `money-tracker-ts.db` from v2.1.

### Security limitations (read before using)

The account is **single-device and offline**, not an online/remote account. It has no cloud sync, remote account recovery or multi-user separation; a future backend would be a separate project phase. Authentication gates the app UI but **does not encrypt the SQLite database itself**. For sensitive financial data, use phone encryption and a secure screen lock, and keep any JSON export/backup in encrypted storage. The recovery key is never emailed, stored in plain text or recoverable after dismissal; do not lose it. If both password and recovery key are lost, there is no guaranteed way to regain access without resetting app data. You should make a private JSON backup **before** installing a new build. Android APK updates require a matching signing certificate; never uninstall before backing up.

### QA

`npm run test:core` runs 12 finance and 12 auth validation cases. Full native Android biometric, profile picker, secure storage and SQLite upgrade tests require installation on a real device; passing CI alone is not a substitute.
