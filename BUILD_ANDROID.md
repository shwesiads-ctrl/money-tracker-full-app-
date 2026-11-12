# Money Tracker Android v2.5 — Android build

1. Check out the `main` branch. Node.js 22.13+, Java 17, Android SDK and Expo SDK 58 are required.
2. In `android`, run `npm install && npm run test:core && npm run typecheck`.
3. Run `npx expo prebuild --platform android --no-install`, then `cd android && ./gradlew :app:assembleRelease`.
4. APK output: `android/android/app/build/outputs/apk/release/*.apk` from project root.

GitHub Actions publishes a prerelease asset at https://github.com/shwesiads-ctrl/money-tracker-full-app-/releases when the `main` build passes. Its repository is private, so you must sign in to GitHub. Back up money records before updating; do NOT uninstall the previous version.

## Acceptance QA

- v2.4 -> v2.5 install preserves username, login recovery, transactions, wallet balances, reminders and existing JSON backups.
- Create, confirm-post, pause, delete recurring templates. Press confirm twice: second attempt must not duplicate the transaction.
- Set category limits and verify progress after expense add/edit/delete; enable alerts and grant permission only when prompted.
- Create borrowed/lent debt and partial repayments, reject excess repayment.
- Create goal and contributions, verify wallet ledger unchanged.
- Attach, replace and remove a receipt; verify private local path and encrypted backup/restore of photo.
- Export an encrypted backup; wrong password / modified archive must fail, correct password must restore all features and receipts; legacy JSON import only after confirmation.
- Export PDF and CSV of same filtered period; check Myanmar script rendering on target phone.
- Add the home widget from Android launcher and test optional balance visibility. Check widget privacy while app is locked.
- Check back confirmation, pull-to-refresh, notification delivery, device biometric unlock on real phones.

Phone / biometric / notification and widget runtime tests have not been performed in the sandbox; please report any screen or device-specific issues.

## v2.5.2 widget acceptance

- Add Compact (2x2) and Balance (4x2) widgets from Android launcher; verify dark background and readable layout.
- With Show Balance on Home Widget off, both widgets must conceal amounts. Enable to reveal balance; medium shows current month's income and expense.
- Test high font scale and long amounts on a real device. The CI build alone cannot verify visual rendering.
