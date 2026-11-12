# Money Tracker Android v2.6.2 — QA Notes

- Android-only changes: Day / Week / Month / Year + Custom analysis, income/expense period bar chart and export dates. Week starts Monday; transfers excluded.
- Settings moved into separate pages: Profile, Appearance, Wallets, Categories, Monthly Budget, Reminders, Backup, Cloud Sync, About; Financial Tools shortcut.
- System Back and top-left in-app Back use same path. Settings subpage -> Settings menu; main tabs -> native OK/Cancel Exit dialog. Android predictive back callbacks explicitly disabled as a compatibility fallback until React Native handles reliably on target phones.
- No SQLite migration or account records changed. APK versionCode increased to 11. Original Android package identifier retained.
- Tests are not the same as device validation: hardware Back gestures, report controls, settings navigation, screen sizes, Android widget and Firebase preview need manual testing.
- The temporary GitHub Actions signing key should be verified against the installed APK before update. Never uninstall before making an encrypted backup.
