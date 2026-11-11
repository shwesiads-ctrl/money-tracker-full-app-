# Build Android APK

## Recommended: GitHub Actions (works with a phone browser)

1. Go to the **private GitHub repository** `shwesiads-ctrl/money-tracker-full-app-`.
2. Tap **Actions**, open **Build Money Tracker Android APK**, then **Run workflow** if it has not started automatically.
3. Open the latest successful workflow run and tap the `money-tracker-android-testing-apk` artifact.
4. Unzip the artifact, install its APK on your Android phone, and test transactions/backup/restore.

The repository workflow is at `.github/workflows/android-apk.yml`. It needs GitHub Actions enabled. Artifacts are kept for 14 days by this workflow.

## Alternative: Expo EAS Build

```bash
npm install
npx eas-cli login
npx eas-cli build -p android --profile preview
```

EAS prompts for linking to your Expo project and setting up signing credentials. Preview produces an APK according to `eas.json`.

## Production releases

Do not use a test/debug signing key for final distribution. Configure a permanent secure app signing identity, ensure you have control of the key, and perform device tests before release. A Play Store release usually uses AAB. This repository does not contain signing credentials.
