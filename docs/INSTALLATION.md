# Installation Guide (Windows)

Every command below is for **Windows PowerShell**. Run them from the project folder (`Krishi-Roth`) unless a step says otherwise.

## 1. Install the tools

| Tool | Where to get it | Check |
|---|---|---|
| Node.js 18 or newer (LTS) | <https://nodejs.org> | `node -v` |
| Git | <https://git-scm.com> | `git --version` |
| MySQL 8 **or** XAMPP | <https://dev.mysql.com/downloads/installer/> or <https://www.apachefriends.org> | see below |
| VS Code (recommended) | <https://code.visualstudio.com> | |

**XAMPP:** open the XAMPP Control Panel and press **Start** next to **MySQL**. The username is `root` and the password is empty.
**MySQL Installer:** remember the root password you chose. The `MySQL80` Windows service must be running.

If PowerShell says *"running scripts is disabled on this system"* when you run `npm`, run this once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 2. Get the code

```powershell
git clone https://github.com/rayhan-529/Krishi-Roth.git
cd Krishi-Roth
```

## 3. Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Generate a secret for login tokens and copy the printed text:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Open the settings file and fill it in:

```powershell
notepad .env
```

| Setting | Value |
|---|---|
| `DB_PASSWORD` | your MySQL root password (leave empty for XAMPP) |
| `JWT_SECRET` | the text you just generated |
| `ADMIN_NAME` | e.g. `MD. Abu Rayhan` |
| `ADMIN_EMAIL` | the admin login email |
| `ADMIN_PASSWORD` | at least 8 characters |
| `AI_API_KEY` | optional: a free Gemini key from <https://aistudio.google.com/apikey> |

Create the database and the admin account, then start the API:

```powershell
npm run db:setup
npm run admin:create
npm run db:check
npm run dev
```

You should see `Krishi Roth API running at http://localhost:5000` and `MySQL connected`. Check <http://localhost:5000/api/health> in a browser.

Leave this window open.

## 4. Frontend

Open a **second** PowerShell window in the project folder:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open <http://localhost:5173>.

## 5. First use

1. Log in at <http://localhost:5173/login> with `ADMIN_EMAIL` and `ADMIN_PASSWORD`. You land on the admin dashboard.
2. Go to **Admin → Market Prices** and add a few real prices.
3. Log out and register test accounts for each role (farmer, buyer, labour, harvester owner, tractor owner, transport owner) using different mobile numbers.
4. Follow [TESTING.md](TESTING.md) to try every workflow.

## 6. Everyday commands

| Where | Command | Purpose |
|---|---|---|
| backend | `npm run dev` | Start the API with auto-restart |
| backend | `npm start` | Start the API (production) |
| backend | `npm run db:setup` | Create/upgrade tables (safe to repeat) |
| backend | `npm run db:check` | Test the MySQL connection |
| backend | `npm run admin:create` | Create the admin or change their password |
| backend | `npm run db:reset` | Delete and rebuild the whole database (asks first) |
| frontend | `npm run dev` | Start the website for development |
| frontend | `npm run build` | Production build into `frontend/dist` |
| frontend | `npm run preview` | Preview the production build |

## 7. Problems

| Problem | Fix |
|---|---|
| `Cannot reach MySQL at localhost:3306` | Start MySQL (XAMPP Control Panel, or `Start-Service MySQL80` in an Administrator PowerShell) |
| `MySQL rejected the username/password` | Fix `DB_USER` / `DB_PASSWORD` in `backend/.env` |
| `Missing required setting(s)` | Fill in `backend/.env` (step 3) |
| Website says it cannot reach the server | The backend window must be running; `frontend/.env` must contain `VITE_API_URL=http://localhost:5000` |
| Browser console shows a CORS error | `CLIENT_URL` in `backend/.env` must be exactly `http://localhost:5173` |
| Port 5000 is in use | Set `PORT=5001` in `backend/.env` and `VITE_API_URL=http://localhost:5001` in `frontend/.env` |
| The chatbot says "not configured" | Add `AI_API_KEY` to `backend/.env` and restart the backend |

More database help: [DATABASE_SETUP.md](DATABASE_SETUP.md).
