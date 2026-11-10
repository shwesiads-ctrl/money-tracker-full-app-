# Upload the Money Tracker source using an Android phone

The repository is **Private** and contains documentation, but **not yet the complete app source**.

## Option A: Android + Termux (preserves all folders)
1. Download `Money_Tracker_GitHub_Ready_v1.0.zip` from the ChatGPT conversation to Android Downloads.
2. Install Termux from F-Droid (recommended official distribution) and open it.
3. Run:
```sh
pkg update -y
pkg install git gh unzip -y
termux-setup-storage
```
Grant Android file access when prompted. Then run:
```sh
gh auth login
gh auth setup-git
cd ~
gh repo clone shwesiads-ctrl/money-tracker-full-app-
mkdir -p ~/money-tracker-upload
unzip -o ~/storage/downloads/Money_Tracker_GitHub_Ready_v1.0.zip -d ~/money-tracker-upload
cp -R ~/money-tracker-upload/. ~/money-tracker-full-app-/
cd ~/money-tracker-full-app-
git status --short
```
Check that no secrets or personal backup files are listed in `git status`, then:
```sh
git add -A
git commit -m "feat: publish Money Tracker Full App v1.0"
git push -u origin main
```
If the commit reports unknown author identity, set your own author name and verified GitHub email with `git config --global user.name "Your Name"` and `git config --global user.email "your-email@example.com"`, then repeat the commit and push.

## Option B: Chrome browser
Open https://github.com/shwesiads-ctrl/money-tracker-full-app-, enable **Desktop site**, select **Add file > Upload files**. Android browsers may not support uploading folders as folders; uploading only the ZIP is *not* the same as publishing source files. Termux is recommended for preserving folder paths.

**Important:** Never upload `private/config.local.php`, `private/backups/`, database dumps, financial records or credentials.
