# কৃষি রথ — Krishi Roth

**A farmer-to-market and harvest management platform for Bangladesh.**

Krishi Roth helps Bangladeshi farmers sell crops at fair prices directly to buyers, check admin-entered market prices, keep harvest records and a digital expense notebook, find farm labour, harvesters, tractors and transport, and ask an AI assistant farming questions in Bengali. The interface is Bengali-first, with a one-tap switch to English.

> University team project — project leader: **MD. Abu Rayhan**. Repository: <https://github.com/rayhan-529/Krishi-Roth>

---

## Features

| Area | What it does |
|---|---|
| Accounts | One login page for every role (farmer, buyer, labour, harvester owner, tractor owner, transport owner, admin). Registration for every role except admin. Login with mobile number or email. Passwords are at least 8 characters and stored as bcrypt hashes. Every login and registration creates a new, unique JWT session that the server can revoke. |
| Marketplace | Farmers list crops with photos. Buyers search and filter by crop, area, price and quantity, message the farmer and send purchase offers. |
| Safe trade workflow | Offer → accepted → payment pending → payment confirmed → delivery pending → completed. Cancel or dispute at the right steps, with a full status history. No real money passes through the platform. |
| Market prices | Admin-entered prices with search, filters, a cross-market comparison and a price trend. Clearly labelled as admin-entered, not a live government feed. |
| Harvest management | Records from planning to harvest, with automatic reminders 3 days before the expected harvest date. |
| Expense notebook | A ruled, paper-notebook-style grid that starts with 25 rows and can grow. Row totals and the production cost are calculated automatically, with cost per crop and per harvest. |
| Labour & machinery | Search workers, harvesters, tractors and transport by area, price and availability. Booking requests have accept/reject, protection against double bookings, and completion. |
| AI assistant | Bengali/English farming chatbot through a backend API (Gemini by default; OpenAI or Claude also supported). It shows a clear "not configured" message when no API key is set. |
| Notifications | In-app notifications for offers, bookings, trades, harvest reminders, price updates, verification and announcements. |
| Ratings & reviews | 1–5 stars, only after a completed trade or booking, once per person. Admins can moderate reviews. |
| Verification | Users upload an ID document, which is stored privately in the database. Admins approve or reject. |
| Admin panel | Statistics, users (block/unblock, role change), verifications, listings and the crop catalogue, market prices, trades and dispute decisions, bookings, complaints, review moderation, announcements, reports and an activity log. |

## Tech stack

- **Frontend:** React 19, Vite, React Router, Axios, plain CSS (mobile-first), Hind Siliguri font
- **Backend:** Node.js, Express 5, REST API, JWT (with server-side sessions), bcrypt, Helmet, express-rate-limit, Multer
- **Database:** MySQL 8 / MariaDB 10.4+ (XAMPP) / TiDB Cloud, using `mysql2` with parameterised queries
- **Optional services:** Cloudinary (photos in production), Google Gemini / OpenAI / Anthropic (chatbot)

## Project structure

```
Krishi-Roth/
├── backend/
│   ├── config/         env.js (settings), db.js (MySQL pool)
│   ├── controllers/    one controller per module (request handling + SQL)
│   ├── database/       schema.sql, seed.sql, setup.js, seedAdmin.js, check.js
│   ├── middleware/     auth (JWT + RBAC), validation, uploads, rate limits, errors
│   ├── routes/         one router per module, mounted in routes/index.js
│   ├── services/       tokens, notifications, storage, AI, reminders, trades
│   ├── utils/          ApiError, response format, validator, pagination
│   ├── server.js
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/ Layout, form controls, cards, modals, charts
│   │   ├── context/    Auth, Language (bn/en), Lookups, Toasts
│   │   ├── hooks/      useFetch, useForm
│   │   ├── pages/      public, auth, farmer, buyer, provider, market, services, shared, admin
│   │   ├── services/   api.js (Axios client)
│   │   ├── styles/     global.css
│   │   └── utils/      labels (bn/en), formatting, role menus
│   ├── vercel.json
│   └── .env.example
├── docs/               installation, database, deployment, API, guides, testing
└── render.yaml         Render blueprint for the API
```

## Quick start (Windows PowerShell)

You need Node.js 18+ (LTS) and MySQL 8 or XAMPP. The full guide is in [docs/INSTALLATION.md](docs/INSTALLATION.md).

```powershell
# 1. Backend
cd backend
npm install
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # paste into JWT_SECRET
notepad .env                 # set DB_PASSWORD, JWT_SECRET, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD
npm run db:setup             # creates the database, tables and reference data
npm run admin:create         # creates the admin account from .env
npm run dev                  # API on http://localhost:5000

# 2. Frontend (in a second PowerShell window)
cd frontend
npm install
Copy-Item .env.example .env
npm run dev                  # website on http://localhost:5173
```

Log in at <http://localhost:5173/login>. Admins use the same login page, with the email and password from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Documentation

| Document | Contents |
|---|---|
| [docs/INSTALLATION.md](docs/INSTALLATION.md) | Step-by-step local setup on Windows |
| [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md) | MySQL setup, database commands, schema overview |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Free hosting: TiDB Cloud + Render + Vercel + Cloudinary + Gemini |
| [docs/API.md](docs/API.md) | Every REST endpoint, with auth rules and the response format |
| [docs/FEATURES.md](docs/FEATURES.md) | How each requirement (FR-01 to FR-14) is implemented |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Guide for farmers, buyers and service providers (Bengali) |
| [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) | Guide for administrators |
| [docs/TESTING.md](docs/TESTING.md) | Test checklist for every module |

## Security summary

- Passwords: bcrypt (12 rounds). Login tokens: JWT with a random session ID stored in `user_sessions`, so logout, password changes and admin blocks end sessions immediately.
- RBAC is enforced on the server for every route. Admin routes need `authenticate + authorize("admin")`.
- Every SQL query is parameterised. Input is validated by a whitelist validator, so unknown fields are dropped.
- Helmet security headers, CORS restricted to `CLIENT_URL`, and rate limits on login/registration, the chatbot and the API.
- Uploads are checked for type, extension, size and real file signature. Identity documents are stored privately and only admins can open them.
- Ownership checks on every private record (listings, harvests, notebooks, trades, bookings, conversations).

## Team workflow

- Never commit `.env`, `node_modules` or `backend/uploads/`; `.gitignore` already excludes them.
- Create a branch per feature: `git checkout -b feature/<name>`. Open a pull request to `main`.
- Run `npm run db:check` (backend) after pulling schema changes; `npm run db:setup` is safe to repeat.

## Credits

Hero photo: "Rice harvesting by farmers in a wetland field, Bangladesh" by A S M Jobaer, Wikimedia Commons, CC BY-SA 4.0.
