# Deployment Guide — free hosting

This guide puts Krishi Roth online at no cost:

| Part | Service | Free plan (checked November 2026; plans change, so check each site) |
|---|---|---|
| Database | **TiDB Cloud Starter** (MySQL-compatible) | 5 GiB storage and 50 million request units per month for each instance, up to 5 instances, no credit card |
| Backend API | **Render** web service | 750 instance-hours a month; the service sleeps after 15 minutes without traffic and takes about a minute to wake up |
| Frontend | **Vercel** (or Netlify) | Static hosting for the React build |
| Photos | **Cloudinary** | Free plan; needed because Render's free disk is wiped on every restart |
| AI chatbot | **Google Gemini API** | Free tier with rate limits; on the free tier Google may use requests to improve its products |

> Why not a free MySQL on Aiven? Aiven no longer creates new free MySQL services. TiDB Cloud speaks the MySQL protocol, so the app connects to it with the normal `mysql2` driver.

Order of work: **database → photos → AI key → backend → frontend → connect them**.

---

## 1. Database: TiDB Cloud Starter

1. Sign up at <https://tidbcloud.com> (no card needed).
2. **Create instance → Starter**, choose the **MySQL-compatible** option and a region close to Bangladesh (e.g. AWS Singapore).
3. Open the instance → **Connect**. Choose "General" / Node.js and press **Generate Password**. Write down:
   - Host, e.g. `gateway01.ap-southeast-1.prod.aws.tidbcloud.com`
   - Port: `4000`
   - User, e.g. `2abcXYZ.root`
   - Password
4. On **your own computer**, point `backend/.env` at TiDB for a moment and build the database:

   ```powershell
   cd backend
   Copy-Item .env .env.local-backup        # keep your local settings
   notepad .env
   ```

   ```env
   DB_HOST=gateway01.ap-southeast-1.prod.aws.tidbcloud.com
   DB_PORT=4000
   DB_USER=2abcXYZ.root
   DB_PASSWORD=the-generated-password
   DB_NAME=krishi_roth
   DB_SSL=true
   ```

   ```powershell
   npm run db:setup
   npm run admin:create
   npm run db:check
   Copy-Item .env.local-backup .env -Force  # back to your local database
   ```

TiDB accepts the schema's `CHECK` rules but does not enforce them by default. That is fine, because the API validates the same rules before every write.

## 2. Photos: Cloudinary

1. Sign up at <https://cloudinary.com> (free plan).
2. Dashboard → **API Keys** (or "Product Environment Credentials") → copy the **API environment variable**. It looks like `cloudinary://123456789012345:abcDEF...@your-cloud-name`.
3. You will paste it into Render as `CLOUDINARY_URL`. Without it, photos uploaded on Render disappear when the server restarts.

## 3. AI key: Google Gemini

1. Go to <https://aistudio.google.com/apikey> and create an API key.
2. You will paste it into Render as `AI_API_KEY` (with `AI_PROVIDER=gemini`).
3. The default model is `gemini-3.5-flash`. If Google retires it, set `AI_MODEL` to a current Flash model name from the Gemini docs.

To use OpenAI or Claude instead, set `AI_PROVIDER=openai` or `AI_PROVIDER=anthropic` and use that provider's key.

## 4. Backend: Render

1. Push the project to GitHub (`.env` is ignored and will not be uploaded).
2. Sign up at <https://render.com> with GitHub.
3. **New → Blueprint**, pick the repository. Render reads `render.yaml` and creates `krishi-roth-api`.
   (Manual alternative: **New → Web Service**, Root Directory `backend`, Build Command `npm install`, Start Command `npm start`, Instance type **Free**, Health check path `/api/health`.)
4. Fill in the environment variables marked "sync: false":

   | Key | Value |
   |---|---|
   | `DB_HOST`, `DB_USER`, `DB_PASSWORD` | from TiDB (step 1) |
   | `CLOUDINARY_URL` | from step 2 |
   | `AI_API_KEY` | from step 3 |
   | `CLIENT_URL` | leave as `http://localhost:5173` for now; change in step 6 |

   `render.yaml` already sets `NODE_ENV=production`, `TRUST_PROXY=true`, `DB_SSL=true`, `DB_PORT=4000` and generates `JWT_SECRET`.
5. Deploy. When it is live, open `https://<your-service>.onrender.com/api/health`. It should say `MySQL connected`, `storage: cloudinary` and `ai: configured`.

## 5. Frontend: Vercel

1. Sign up at <https://vercel.com> with GitHub → **Add New → Project** → import the repository.
2. **Root Directory:** `frontend`. Framework preset: **Vite** (build `npm run build`, output `dist`).
3. Environment variable: `VITE_API_URL = https://<your-service>.onrender.com` (no trailing slash).
4. Deploy. `frontend/vercel.json` sends every path to `index.html`, so reloading pages like `/farmer/harvests` works.

**Netlify instead:** base directory `frontend`, build `npm run build`, publish `frontend/dist`, same `VITE_API_URL`. `frontend/public/_redirects` handles page reloads.

## 6. Connect them

1. Copy your Vercel address, e.g. `https://krishi-roth.vercel.app`.
2. In Render → Environment, set `CLIENT_URL=https://krishi-roth.vercel.app` (comma-separate several addresses if needed) and save. Render redeploys.
3. Open the Vercel site, log in as admin, add market prices, and register test users.

## 7. Things to know

- **Cold start:** after 15 quiet minutes the free Render server sleeps, and the first request takes about a minute. The website shows "The server is waking up…" during that time. A paid Render instance removes the sleep.
- **Harvest reminders** run every 3 hours while the server is awake, and also whenever a farmer opens their dashboard or harvest page, so sleeping does not lose reminders.
- **Secrets** live only in the Render/Vercel dashboards. Never put keys in frontend code or in Git.
- **Database backups:** export from the TiDB console regularly before demos.
- **Changing the schema later:** run `npm run db:setup` against TiDB from your computer (step 1); it only adds what is missing.
- **Free-tier terms** change over time. Before relying on any plan, re-check its limits on the provider's pricing page.
