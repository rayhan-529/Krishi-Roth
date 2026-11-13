# Admin Guide

## Getting access

There is no admin registration on the website. The admin account is created from `backend/.env`:

```powershell
cd backend
npm run admin:create        # creates the admin, or updates their name/password
```

The admin logs in on the normal login page (`/login`) with `ADMIN_EMAIL` and `ADMIN_PASSWORD` and is taken to `/admin`. To change the admin password, edit `ADMIN_PASSWORD` in `.env` and run the command again; all of that admin's old sessions end. To turn an existing user into an admin (rarely needed): `npm run admin:create -- --promote`.

Every admin page is protected on the server (`authorize("admin")`). Hiding a menu link is not what protects it.

## Daily tasks

| Page | What to do |
|---|---|
| **Dashboard** | Check pending verifications, open complaints and disputed trades (each card links to its page). |
| **Market Prices** | Add today's prices: crop, market, district, unit, min/max price, date and a source note. Farmers who sell or grow that crop are notified. Prices are shown publicly as admin-entered. |
| **Verifications** | Open each document (it opens privately in a new tab), compare the name and the last 4 digits, then approve, or reject with a reason the user will see. |
| **Complaints** | Open a complaint, set it to "In review", write a reply and finally "Resolved" or "Dismissed". The user is notified. |
| **Transactions** | For a **disputed** trade, read the history and complaint, contact both parties if needed, then choose **Complete** or **Cancel** with a reason. Cancelling returns the quantity to the listing. |

## Moderation

- **Users:** search, filter by role/status/verification. **Details** shows activity counts and active sessions. **Block account** (reason required) logs the user out everywhere immediately; **Unblock** restores access. Role changes are limited to non-admin roles.
- **Crops & Listings → Crop listings:** remove an inappropriate listing (reason required; the farmer and any buyers with pending offers are notified) or restore it.
- **Crops & Listings → Crop catalogue:** add a new crop (Bengali and English names, a lowercase slug such as `bitter-gourd`, default unit) or hide one from the lists.
- **Bookings:** cancel a problematic open booking (reason required; both sides are notified).
- **Reviews:** hide abusive or false reviews (they no longer count in averages); unhide if needed.

## Communication

**Announcements:** choose an audience (everyone or one role), write a title and message, and send. Every matching active user receives an in-app notification.

## Reports

**Reports** has three tabs:
- **Market & services:** trades per month, completed value, listings by category, top crops, bookings by service, users by district.
- **Harvests & costs:** harvest records by status and crop, expense totals by category, average cost per notebook. Only totals are shown; individual farmers' notebooks stay private.
- **Activity log:** every important action (logins, listings, trades, admin decisions) with time, user and IP address.

Use **Print** for a printable copy.

## Good practice

- Never share the admin password; use a strong one even though the minimum is 8 characters.
- Write a clear reason for every block, removal, rejection and dispute decision; users see it.
- Keep market prices current; they are the first thing farmers check.
