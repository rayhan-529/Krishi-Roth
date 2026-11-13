# Krishi Roth — MySQL Database Setup (Windows)

This guide sets up the MySQL database for Krishi Roth on Windows using PowerShell.

## 1. What you need

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18 or newer | `node -v` to check |
| MySQL **or** XAMPP | MySQL 8.0.16+ / MariaDB 10.4+ (XAMPP 8.x) | Older versions will work but will not enforce the data CHECK rules |

If you use **XAMPP**, open the XAMPP Control Panel and click **Start** next to **MySQL**.
If you use **MySQL Installer**, make sure the `MySQL80` service is running (Services app, or `Get-Service MySQL80`).

## 2. First-time setup

Run these commands in PowerShell from the project folder (`Krishi-Roth`):

```powershell
cd backend

# 1. Install backend packages
npm install

# 2. Create your settings file
Copy-Item .env.example .env

# 3. Generate a JWT secret and copy the output into JWT_SECRET in .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. Open .env and fill in DB_PASSWORD, JWT_SECRET, ADMIN_NAME,
#    ADMIN_EMAIL and ADMIN_PASSWORD
notepad .env

# 5. Create the database, all tables and the reference data
npm run db:setup

# 6. Create the admin account from the ADMIN_* settings in .env
npm run admin:create

# 7. Check everything is connected
npm run db:check

# 8. Start the API
npm run dev
```

Then open <http://localhost:5000/api/health> in a browser. It should say `MySQL connected`.

## 3. Database commands

All commands are run inside the `backend` folder.

| Command | What it does | Safe to repeat? |
|---|---|---|
| `npm run db:setup` | Creates the database if missing, creates all tables, loads reference data (roles, 64 districts, crops, expense categories) and upgrades tables from earlier versions. Migrates accounts from the old `users` table if one is found. | Yes, existing data is kept |
| `npm run db:check` | Tests the MySQL connection and shows row counts | Yes |
| `npm run admin:create` | Creates the admin account, or updates its name/password from `.env` | Yes |
| `npm run admin:create -- --promote` | Same, but allows turning an existing non-admin account into admin | Use with care |
| `npm run db:reset` | **Deletes the whole database** and rebuilds it. Asks you to type the database name first. Disabled when `NODE_ENV=production`. | Destroys all data |

## 4. Upgrading from the first version of the project

The first version had a `users` table with a `password` column. When `npm run db:setup` finds that table it:

1. Renames it to `users_legacy_<date-time>` (nothing is deleted).
2. Creates the new schema.
3. Copies every account (id, name, email, role, password hash) into the new `users` table, so existing logins keep working.
4. Prints how many accounts were migrated.

When you have checked that login works, you can delete the backup table in MySQL:

```sql
DROP TABLE users_legacy_20261113120000;  -- use the exact name printed by db:setup
```

## 5. Database design

The schema is in [`backend/database/schema.sql`](../backend/database/schema.sql) and the reference data in [`backend/database/seed.sql`](../backend/database/seed.sql).

**34 tables + 1 view**, grouped by module:

| Module | Tables |
|---|---|
| Users and access | `roles`, `users`, `user_sessions`, `user_verifications`, `divisions`, `districts`, `activity_logs` |
| Crop catalogue | `crop_categories`, `crops` |
| Market prices | `market_prices` |
| Marketplace | `crop_listings`, `crop_listing_images`, `conversations`, `messages` |
| Safe trade | `purchase_offers`, `trade_records`, `trade_status_history` |
| Harvest | `harvests` |
| Expense notebook | `expense_notebooks`, `expenses`, `expense_categories` |
| Labour | `labour_profiles`, `provider_service_areas` |
| Machinery and transport | `machinery`, `machinery_images`, `transport_vehicles`, `transport_vehicle_images` |
| Bookings | `bookings` |
| Reviews | `reviews`, view `user_rating_summary` |
| Notifications | `notifications`, `announcements` |
| Complaints | `complaints` |
| AI chatbot | `chatbot_conversations`, `chatbot_messages` |

### Main relationships

```
roles 1───* users *───1 districts *───1 divisions
users 1───* crop_listings *───1 crops *───1 crop_categories
crop_listings 1───* purchase_offers 1───0..1 trade_records 1───* trade_status_history
users 1───* harvests 1───* expense_notebooks 1───* expenses *───1 expense_categories
users 1───0..1 labour_profiles
users 1───* machinery (harvester | tractor)
users 1───* transport_vehicles
bookings: requester (user) → provider (user) + optional machinery / transport_vehicle
reviews: reviewer → reviewee, linked to exactly one trade_record OR booking
```

### Rules the database enforces itself

- A user must have an email **or** a phone number; both are unique.
- `role` must exist in `roles`. Admin is marked `is_self_registrable = 0`.
- Expense row total = quantity × unit price (generated column, cannot be wrong).
- Purchase-offer total = quantity × offered price (generated column).
- Ratings must be 1–5; a user cannot review themselves; the same person cannot review the same trade or booking twice.
- A buyer cannot make an offer on their own listing; a farmer cannot book themselves.
- A booking must point to the right kind of service (labour → no machine; harvester/tractor → machinery; transport → vehicle) and its end date cannot be before its start date.
- Listing quantity, prices, wages and land size cannot be negative.

### Market prices

No prices are seeded: the table starts empty and admins enter real prices from **Admin → Market Prices** (stored with `source = 'admin'`). The app labels them as admin-entered. No live government price feed is connected.

### Privacy

- Passwords are stored only as bcrypt hashes (`users.password_hash`).
- Every login/registration creates a row in `user_sessions` with a random token ID, so the server can end sessions (logout, password change, block).
- Verification documents are stored inside the database (`user_verifications.document_data`) and are only sent to admins; only the last 4 digits of a document number are kept.
- Vehicle registration numbers are visible only to the owner and admins.

## 6. Troubleshooting

| Message | Fix |
|---|---|
| `Cannot reach MySQL at localhost:3306` | Start MySQL (XAMPP Control Panel → Start, or `Start-Service MySQL80` in an Administrator PowerShell) |
| `MySQL rejected the username/password` | Check `DB_USER` / `DB_PASSWORD` in `backend/.env`. XAMPP root usually has an empty password. |
| `Missing required setting(s) in backend/.env` | Run `Copy-Item .env.example .env` in `backend` and fill in the values |
| `JWT_SECRET must be at least 32 characters` | Generate one with the `node -e ...` command in step 2.3 |
| You ran `db:setup` from an earlier phase | Run `npm run db:setup` again; it adds the new tables and upgrades `user_verifications` |
| `the tables are missing` | Run `npm run db:setup` |
| `npm` is not recognized | Install Node.js LTS from nodejs.org and reopen PowerShell |
| PowerShell says running scripts is disabled (`npm.ps1`) | Run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
