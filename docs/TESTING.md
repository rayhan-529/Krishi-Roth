# Testing Guide

## 1. What was checked automatically during development

These checks ran in the build environment, which had **no MySQL server and no internet access for npm**. They catch structural mistakes, not runtime behaviour, so the manual checklist below must be run on a real machine.

| Check | Result |
|---|---|
| `node --check` on every backend file | All pass |
| Whole backend loaded with stub packages; every route walked | 125 routes, every handler a real function, no broken imports |
| Schema structure: every foreign key points to an existing column of the same type; CHECK constraints never use columns with FK actions (MySQL error 3823); seed columns exist | No problems (the checker was confirmed by planting an error) |
| Database scripts dry-run against a fake MySQL (fresh setup, upgrading the old `users` table, admin creation, weak password, refusing to promote a farmer) | Behaves as intended |
| JSX syntax of all 65 frontend files (TypeScript parser) | No syntax errors (the checker was confirmed with a broken file) |
| Frontend imports: every import points to an existing file and export | 0 problems |
| Undefined identifiers in the frontend | None |
| Every frontend API call matched against the backend route list (method + path) | All 115 calls match |

## 2. Before testing

```powershell
cd backend;  npm run db:setup; npm run admin:create; npm run dev
cd frontend; npm run dev
```

Create test accounts with different mobile numbers: one farmer (F), one buyer (B), one labour (L), one harvester owner (H), one tractor owner (T) and one transport owner (TR). Use two browsers (or a private window) to be two people at once.

## 3. Manual checklist

Tick each box. If something fails, note the page, what you did, and the message shown (plus the backend window's output).

### Authentication and roles
- [ ] Register F with a 7-character password → error "at least 8 characters".
- [ ] Register F correctly → lands on `/farmer`; header shows the name.
- [ ] Register another account with the same mobile → error under the mobile field.
- [ ] Log out → log in with the mobile number → works; log in with the email → works.
- [ ] Wrong password → "incorrect" message; 11 wrong attempts in 15 minutes → "Too many attempts".
- [ ] Admin logs in on `/login` → lands on `/admin`. `/admin/login` redirects to `/login`.
- [ ] Logged in as F, open `/admin` → redirected to the farmer dashboard.
- [ ] As F, call `GET /api/admin/stats` with F's token (see the PowerShell example in API.md) → **403**.
- [ ] Log in twice (two browsers); in the admin DB, `user_sessions` has two different `jti` rows. Log out in one → it stops working, the other keeps working.
- [ ] Change password in browser 1 → browser 2 is logged out on its next action.

### Market prices (FR-03)
- [ ] Before any prices: the market price page shows the empty state.
- [ ] Admin adds 3 prices for rice in 2 markets → they appear with the admin label; the comparison shows lowest/highest/average.
- [ ] Search "চাল"/"rice", filter by division and district → the results narrow correctly.
- [ ] F (who has a rice listing or harvest) receives a "new market price" notification.

### Marketplace and safe trade (FR-04, FR-05)
- [ ] F creates a listing with 2 photos → it appears in the marketplace and its details page shows the photos.
- [ ] F edits it: removes a photo, adds one, changes the price → saved.
- [ ] B filters by district/price/verified only → the results are correct.
- [ ] B messages F from the listing → F sees it in Messages with an unread count; F replies.
- [ ] B offers more than is available → error under quantity. B offers a valid amount → F gets a notification.
- [ ] B tries a second offer on the same listing → "already have a pending offer".
- [ ] F accepts → the listing's available quantity drops; a trade opens at "Payment pending".
- [ ] B records payment (bKash + transaction ID) → F sees it → F confirms → "Payment confirmed".
- [ ] F starts delivery → B confirms receipt → "Completed"; the history shows every step.
- [ ] Both rate each other; a second rating attempt → "already reviewed"; ratings show on profiles.
- [ ] New trade: cancel at "Payment pending" with a reason → the quantity returns to the listing.
- [ ] New trade: dispute → status "Disputed", a complaint is created, the admin is notified; admin resolves → status changes and parties are notified.
- [ ] F marks a listing sold → pending offers expire and buyers are notified.
- [ ] F deletes a listing with history → it disappears from the marketplace (soft delete).

### Harvests and expense notebook (FR-06, FR-07)
- [ ] Add a harvest with the expected date 2 days from today → open the dashboard → a reminder notification arrives (once only).
- [ ] Set status "Completed" without an actual date in the form → error; quick status change fills today's date.
- [ ] Create a notebook linked to the harvest → 25 empty rows show.
- [ ] Enter: Rice seeds 10 × 100; Fertilizer 80 × 25; Pesticide 1 × 800; Labour 5 × 600; Land preparation 1 × 1500 → row totals 1000, 2000, 800, 3000, 1500; **grand total ৳8,300**.
- [ ] Leave a category empty in one row and save → that row's cell turns red; fix it and save → success.
- [ ] Reload → the rows are still there (saved in MySQL). Delete a row and save → it is gone.
- [ ] Add 5 rows → 30 rows. Filter by category/date → filtered total; clear filters to edit again.
- [ ] Notebook list shows the total by crop, by category and the cost per unit for the harvest.

### Labour, machinery, transport and bookings (FR-08, FR-09)
- [ ] L creates a work profile (wage 600, district) and adds an extra service area.
- [ ] F searches labour in L's extra service area → L appears.
- [ ] H registers a harvester with photos; T a tractor; TR a vehicle (registration number visible only to TR and the admin).
- [ ] F books the harvester for 2 days → H sees the request on the dashboard and gets a notification.
- [ ] H accepts → F sees H's phone number. F books the same harvester for overlapping dates; H tries to accept → "Another accepted booking already covers…".
- [ ] H starts → completes → both can rate.
- [ ] B (buyer) books transport → allowed; B tries to book labour via the API → 403.
- [ ] H sets the harvester "unavailable" → it disappears from "available only" search.

### Notifications, profile, verification (FR-11, FR-12, FR-13)
- [ ] The bell count matches the unread notifications; "Mark all read" clears it.
- [ ] Profile: change the name and district → saved; upload a photo → shown in the header.
- [ ] Request verification with a PDF → status "Pending"; admin opens the document and approves → the user sees "Verified" and a badge on listings.
- [ ] Try uploading a `.exe` renamed to `.jpg` → rejected ("not a real image").

### AI chatbot (FR-10)
- [ ] With an empty `AI_API_KEY`: the page shows "not configured" and sending is not possible.
- [ ] With a valid key: ask "ধান কখন কাটতে হবে?" → a Bengali answer; the conversation appears in history; reload → still there; delete it.
- [ ] Switch to EN and ask in English → an English answer.
- [ ] Put a wrong key in `.env` and restart → a clear "key is not valid" message.

### Admin (FR-14)
- [ ] Dashboard counts match reality.
- [ ] Block B with a reason → B is logged out immediately and cannot log in; unblock → can log in.
- [ ] Change T's role to transport owner → T's menu changes on the next page load.
- [ ] Remove a listing with a reason → the farmer is notified; restore it.
- [ ] Add a new crop to the catalogue → it appears in crop dropdowns.
- [ ] Send an announcement to farmers only → F gets it, B does not.
- [ ] Reports: all three tabs load; Print works.

### Language and responsive design
- [ ] Switch বাং/EN on several pages → all labels, statuses, numbers (Bengali digits) and dates change.
- [ ] Phone width (Chrome DevTools → 375px): the menu opens as a drawer; tables scroll sideways; forms are one column; the notebook scrolls sideways.
- [ ] Tablet (768px) and desktop (1280px): the layout uses the extra width; the sidebar appears for logged-in users on desktop.

### MySQL connection
- [ ] Stop MySQL while the API runs → `/api/health` returns 503 "Database is not ready"; pages show "database is not reachable". Start MySQL → it works again without restarting the API.

## 4. Reporting a bug

Write down: the page URL, the account role, the steps, what you expected, what happened, the message on screen, and the last lines in the backend PowerShell window.
