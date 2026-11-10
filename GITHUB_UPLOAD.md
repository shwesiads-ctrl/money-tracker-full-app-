# Upload the Money Tracker Source

The repository is private and currently contains setup documentation only.

Download and extract `Money_Tracker_GitHub_Ready_v1.0.zip` from the ChatGPT conversation, open **PowerShell** inside the extracted project folder, and run:

```powershell
git remote add origin https://github.com/shwesiads-ctrl/money-tracker-full-app-.git
git fetch origin
git reset --soft origin/main
git add -A
git commit -m "feat: publish Money Tracker Full App v1.0"
git push -u origin main
```

If `origin` already exists, run `git remote set-url origin https://github.com/shwesiads-ctrl/money-tracker-full-app-.git` instead of `git remote add origin`.

**Security:** Before pushing, verify `git status --short` doesn't include `private/config.local.php`, financial backups or database dumps. The `.gitignore` excludes typical private data. Never commit real account transactions, financial reports, or database secrets.
