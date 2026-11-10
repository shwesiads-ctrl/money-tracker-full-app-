# Money Tracker — Full Database App (v1.0)

> ⚠️ **Repository upload status:** Setup files and documentation are published, but the application source files have **not yet been pushed**. Download the prepared source ZIP from the ChatGPT conversation and push it to this repository before following the installation instructions below.

A responsive Myanmar/English personal finance tracker based on the supplied mobile UI. **This is a server-backed app (not an offline-only HTML demo).** Runs on Windows XAMPP or a PHP/MariaDB web host.

## Requirements
- PHP **8.2+**, with `pdo_mysql`, `json`, `session` enabled
- MariaDB **10.4+** or MySQL **8.0+** (InnoDB, utf8mb4)
- Apache 2.4+ recommended (supports `.htaccess`); PHP development server is for local tests only
- Modern browser (Chrome, Edge, Firefox)
- No npm, Composer, Tailwind CDN, external API, or cloud subscription needed

## Quick start on Windows / XAMPP

1. Start **Apache** and **MySQL** in XAMPP Control Panel.
2. Unzip the `money-tracker-full` folder into `C:\xampp\htdocs\money-tracker-full\`.
3. Open **http://localhost/money-tracker-full/install.php**.
4. Fill database connection: usually **host `localhost`, port `3306`, DB name `money_tracker`, user `root`, blank password** on a fresh local XAMPP setup. Use your actual MariaDB password if set. **Do not use a blank database password for a publicly accessible deployment.**
5. Set an admin username and a **strong password (at least 12 characters)**. Optional: select demo transactions based on the original HTML.
6. Click **Create Database & Install**, then sign in at `login.php`.

The installer creates the MariaDB database, tables and initial categories/wallets. It writes `private/config.local.php` and locks itself once installed. The `private/` directory contains `.htaccess` denying web access. If DB creation permissions are unavailable (common on shared hosting), create an empty database in cPanel/MySQL management first and use its exact name and assigned user. The installer can then use the existing empty database.

**Base URL:** `http://localhost/money-tracker-full/`

> If you change the installation folder name, the app still uses relative URLs; no source edit is needed.

## Features delivered
- Admin sign-in with hashed password, CSRF tokens, session regeneration and basic login rate limiting
- Independent MMK and USD ledgers — switching does **not** convert historical amounts
- Dashboard: overall wallet balances (opening + income − expenses ± transfers), monthly income/expenses, monthly budget progress
- Transaction **add / edit / delete**, and transfers between wallets (neither income nor expense)
- Category choices tied to transaction type, configurable custom categories
- Wallet names, active/inactive status and per-currency opening balances
- Detailed transaction history: search, type/category/wallet/date filters; summary, 40-record pages
- Date-filtered reports: income, expense, net, category breakdown, daily expense bars, wallet breakdown
- Filtered **CSV export** (up to 100,000 rows; UTF-8 BOM for Excel), formula injection protection on text fields
- Entire-account **JSON backup** (excluding login credentials) and **transactional restore** (up to 10 MB / 20,000 transactions). Restore validates all records before replacing current ones.
- Myanmar/English UI and complete light/dark app theme
- No external network dependencies in normal use

## Financial model — important
- **Wallet opening balance**: In **Settings → Opening Wallet Balances**, enter money that existed before starting tracking. A Cash expense without any opening Cash balance or recorded Cash income will show negative Cash balance, even if other wallets have positive balances. This is intentional; wallet balances are not pooled.
- Transfers move money between wallets of the **same selected currency**. They do not affect income, expense or budget.
- MMK and USD are stored separately. Do not enter USD values in an MMK wallet view. No exchange-rate service or currency conversion is performed.
- All new transactions record a positive amount with 0–2 decimal digits. Transaction type sets the sign.
- **Monthly budget** is calculated only from expense transactions in the selected month and currency. Budget settings are per currency, and apply to every month unless changed.
- The CSV file exports the current History filters (or Reports date range). The JSON file is a complete account backup, not a report.
- Dates are saved as entered. The app selects the current date/month using your browser clock.

## Backup & restore
1. Open **Settings → Backup & Restore** and click **Download JSON Backup**. Keep the JSON file securely: it contains your personal financial records in plain text. It does **not** contain your login password.
2. To restore, upload a JSON backup, type `RESTORE`, and confirm the browser warning.
3. The restore transaction validates all references and rebuilds your categories, wallets, opening balances, budgets, settings and transactions. **Current data is replaced** only on successful completion. An invalid backup does not partially overwrite data.
4. Take a fresh JSON backup *before* restoring. Do not upload backups received from untrusted sources.

## Security and deployment
- **Use HTTPS** for an internet-facing deployment. A local `http://localhost` test is acceptable; remote HTTP is unsafe for passwords and financial data.
- Create a **dedicated database user** with access to this database only (do not deploy with DB root).
- Ensure the host honors `.htaccess` rules. Block access to `/private`, `/src`, `.sql` files, and server-generated files. You may move the `private` directory outside the public document root and adjust `APP_ROOT`/configuration path for stricter production deployments.
- `private/config.local.php` holds the DB password; do not commit or share it.
- Disable PHP `display_errors` in production and restrict write access to the private folder after installation.
- Do not treat this project as regulated accounting or multi-user SaaS. It does not include bank API synchronization, automatic exchange rates, accounting reconciliation, scheduled offsite backups, or SMS 2FA.
- Keep PHP, MariaDB and Apache up to date and maintain your own server/database backups in addition to JSON exports.

## Project structure
```
money-tracker-full/
  index.php              Authenticated mobile app
  login.php              Login
  logout.php             POST-only logout
  install.php            One-time database setup
  api.php                Authenticated JSON API / CSV / backups
  schema.sql             MariaDB schema
  src/bootstrap.php      Session/security/DB helpers
  src/data.php           Business logic / reporting / backups
  assets/app.css         Responsive offline stylesheet
  assets/app.js          Frontend logic, i18n, API calls
  private/.htaccess      Private configuration access protection
  tests/                 Basic static and validation tests
```

## CLI quality checks
```bash
find . -name '*.php' -print0 | xargs -0 -n1 php -l
node --check assets/app.js
bash tests/static-check.sh
```
Run end-to-end **database** testing against a disposable installed MariaDB database prior to production. The sandbox used to build this package did not have `pdo_mysql` or MariaDB server available, so server database integration is not claimed as runtime-verified here.

## Troubleshooting
- **PDO MySQL extension not enabled:** Enable `extension=pdo_mysql` in your XAMPP `php.ini`, restart Apache.
- **Database connection fails:** Start MariaDB, check port, DB user and password.
- **500 error:** Check Apache/PHP error log (`C:\xampp\apache\logs\error.log`), ensure installed PHP extensions and SQL permissions.
- **Blank dashboard:** Inspect Browser DevTools → Network → `api.php?action=state` response and login session.
- **No Myanmar font on old Windows:** Install a Unicode Myanmar font such as Noto Sans Myanmar locally, or use the Windows Myanmar Text system font.
- **CSV characters in Excel:** CSV includes UTF-8 BOM; in older Excel versions, import as UTF-8.

## Release status
**Source package implemented and syntax-checked.** Browser UI checks can be run without database using mocked API responses. A true XAMPP + MariaDB acceptance pass is still required in the target environment; see `tests/QA_CHECKLIST.md`.

## Optional scheduled local backups

You can schedule **CLI-only** JSON backups with Windows Task Scheduler or cPanel Cron. This is *not automatically enabled* by the installer. Replace `admin` with the installer username:

```bat
C:\xampp\php\php.exe C:\xampp\htdocs\money-tracker-full\bin\backup-cli.php admin 7
```

The optional second argument means **retain the latest 7** snapshots for that account. Files are stored under `private/backups/`, protected with `.htaccess` and restrictive permissions where supported. They remain **unencrypted JSON**, so secure your machine, hosting backups and filesystem. Prefer copying them periodically to an access-controlled, encrypted offsite backup location; this package does not configure an external destination.