# Krishi Roth REST API

Base URL: `http://localhost:5000/api` (local) or `https://<your-service>.onrender.com/api` (production).

## Conventions

**Authentication.** Send the token from login/registration in a header:

```
Authorization: Bearer <token>
```

Every login and every registration returns a **new, unique token**. Its session ID (`jti`) is stored in `user_sessions`, so `POST /auth/logout` ends that session, while a password change, "log out everywhere" or an admin block ends them all. On every request the server reloads the user's role and blocked status from MySQL.

**Language.** Send `Accept-Language: bn` (default) or `Accept-Language: en`. Messages come back in that language.

**Field names** use `snake_case` in both requests and responses. Photo uploads use `multipart/form-data`; everything else uses JSON.

**Success response**

```json
{ "success": true, "message": "...", "data": { }, "meta": { "page": 1, "limit": 12, "total": 40, "totalPages": 4 } }
```

**Error response** (`errors` lists field-level problems for forms)

```json
{ "success": false, "message": "Some information is not correct...", "errors": { "phone": "Enter a valid mobile number" } }
```

| Status | Meaning |
|---|---|
| 400 | Invalid input or an action not allowed at this step |
| 401 | Not logged in, or the session ended |
| 403 | Logged in but not allowed (wrong role, not the owner, blocked) |
| 404 | Not found (also returned for records you may not see) |
| 409 | Conflict (duplicate, overlapping booking, already reviewed) |
| 413 | Request too large |
| 429 | Rate limit reached |
| 503 | Database or AI service not available |

**Pagination.** List endpoints accept `?page=1&limit=12` (`limit` is at most 50) and return `meta`.

**Rate limits.** Login/registration/password change: 10 failed attempts per 15 minutes per IP. Chatbot: 20 messages per 10 minutes per user. Whole API: 600 requests per 15 minutes per IP.

Roles: `farmer`, `buyer`, `labour`, `harvester_owner`, `tractor_owner`, `transport_owner`, `admin`. In the tables, **Public** means no login is needed, **Login** means any role, and a role list means only those roles.

---

## System and lookups

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/health` | Public | API, database, photo storage and AI status |
| GET | `/meta/lookups` | Public | Roles, divisions, districts, crop categories, crops, expense categories |
| GET | `/meta/stats` | Public | Real platform counts for the home page |

## Authentication

| Method | Path | Access | Body |
|---|---|---|---|
| POST | `/auth/register` | Public | `name, phone, email?, password (min 8), role (not admin), district_id, upazila?, preferred_language?` → `{ token, expires_at, user }` |
| POST | `/auth/login` | Public | `identifier` (mobile or email), `password` → `{ token, expires_at, user }`. The same endpoint is used for admins. |
| GET | `/auth/me` | Login | Current user |
| POST | `/auth/logout` | Login | Ends this session |
| POST | `/auth/logout-all` | Login | Ends every session of the user |
| POST | `/auth/change-password` | Login | `current_password, new_password` → new token; other sessions end |

## Profile and users

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/profile` | Login | Own profile with rating |
| PUT | `/profile` | Login | `name, phone?, email?, district_id?, upazila?, address?, bio?, preferred_language` |
| PATCH | `/profile/language` | Login | `preferred_language` |
| POST | `/profile/photo` | Login | multipart `photo` (JPG/PNG/WEBP, max 3 MB) |
| GET | `/users/:id` | Public | Public profile (no email/phone), reviews, services, service areas |
| GET | `/users/:id/reviews` | Public | Visible reviews, paginated, with the summary in `meta` |

## Verification

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/verifications` | Login | multipart `document` (image or PDF), `document_type, document_number_last4?, note?`. Stored privately in the database. |
| GET | `/verifications/mine` | Login | Own requests (without the file) |

## Market prices

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/market-prices` | Public | `q, crop_id, category_id, district_id, division_id, history(bool)`; latest price per crop/market unless `history=true`; `meta.last_updated` |
| GET | `/market-prices/compare` | Public | `crop_id, unit?` → markets, 30-day trend, lowest/highest/average |
| POST | `/market-prices` | admin | `crop_id, market_name, district_id, unit, min_price, max_price, price_date, source_note?`; notifies farmers selling/growing the crop |
| PUT | `/market-prices/:id` | admin | Same body |
| DELETE | `/market-prices/:id` | admin | |

## Marketplace

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/listings` | Public | `q, crop_id, category_id, district_id, division_id, unit, min_price, max_price, min_quantity, verified_only, sort (newest, price_asc, price_desc, quantity_desc)` |
| GET | `/listings/mine` | farmer | `status?`; includes `pending_offers` |
| GET | `/listings/:id` | Public | Photos, seller, recent market prices; buyers also get `my_offers`, owners get `pending_offers` |
| POST | `/listings` | farmer | multipart: `crop_id, variety?, quantity, unit, price_per_unit, min_order_quantity?, is_negotiable, district_id, upazila?, harvest_date?, description?`, up to 5 `images` |
| PUT | `/listings/:id` | farmer (owner) | Same fields plus `remove_image_ids` (JSON array) and new `images` |
| PATCH | `/listings/:id/status` | farmer (owner) | `status: active, sold or expired`; closing expires pending offers |
| DELETE | `/listings/:id` | farmer (owner) | Hidden (`removed`) if it has history, otherwise deleted |
| POST | `/listings/:id/offers` | buyer | `quantity, offered_price_per_unit, message?` |

## Offers and trades (safe trade workflow)

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/offers` | farmer, buyer | Farmers see offers received, buyers see offers sent; `status?` |
| PATCH | `/offers/:id/accept` | farmer (owner) | `farmer_note?`; reserves the quantity and creates a trade (`payment_pending`) |
| PATCH | `/offers/:id/reject` | farmer (owner) | `farmer_note?` |
| PATCH | `/offers/:id/withdraw` | buyer (owner) | |
| GET | `/trades` | farmer, buyer | Own trades; `status?` |
| GET | `/trades/:id` | party, admin | Details, contact numbers, status history, reviews, `can_review` |
| PATCH | `/trades/:id` | party | `action` plus fields, see below |

Trade actions:

| action | Who | From status | To status / effect | Extra fields |
|---|---|---|---|---|
| `mark_paid` | buyer | payment_pending | records the payment report | `payment_method, payment_reference?` |
| `confirm_payment` | farmer | payment_pending | payment_confirmed | |
| `start_delivery` | farmer | payment_confirmed | delivery_pending | `delivery_method, delivery_address?, expected_delivery_date?` |
| `confirm_receipt` | buyer | delivery_pending | completed (listing becomes sold when nothing is left) | |
| `cancel` | either | payment_pending | cancelled (quantity returned to the listing) | `reason` |
| `dispute` | either | payment_pending / payment_confirmed / delivery_pending | disputed (a complaint is opened and admins are notified) | `reason` |

No real money is handled: payment fields only record what the users report.

## Messages

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/conversations` | farmer, buyer | Conversations with the last message and unread count |
| POST | `/conversations` | farmer, buyer | `listing_id, body` — starts or continues a conversation with the listing's farmer |
| GET | `/conversations/:id` | participant | Messages (marks them read) |
| POST | `/conversations/:id/messages` | participant | `body` |

## Harvest management

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/harvests` | farmer | `status, crop_id, year, q`; includes `days_to_harvest`, `total_expense` |
| GET | `/harvests/upcoming` | farmer | Expected within 14 days |
| GET | `/harvests/:id` | farmer (owner) | Includes linked notebooks |
| POST | `/harvests` | farmer | `crop_id, variety?, field_name?, land_size, land_unit, expected_quantity?, actual_quantity?, quantity_unit, planting_date?, expected_harvest_date?, actual_harvest_date?, status, notes?` |
| PUT | `/harvests/:id` | farmer (owner) | Same body; changing the expected date re-arms the reminder |
| PATCH | `/harvests/:id/status` | farmer (owner) | `status, actual_harvest_date?, actual_quantity?` |
| DELETE | `/harvests/:id` | farmer (owner) | Linked notebooks are kept |

## Expense notebooks

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/notebooks` | farmer | Each with `total_cost` and `rows_count` |
| GET | `/notebooks/summary` | farmer | Totals by crop, category and harvest (with cost per unit) |
| GET | `/notebooks/:id` | farmer (owner) | `from, to, category_id` filters → `{ notebook, rows, by_category, filtered_total }` |
| POST | `/notebooks` | farmer | `title, harvest_id?, crop_id?, season?, year?, notes?` |
| PUT | `/notebooks/:id` | farmer (owner) | Same body |
| DELETE | `/notebooks/:id` | farmer (owner) | Deletes its rows too |
| PUT | `/notebooks/:id/rows` | farmer (owner) | `rows: [{ id?, item_name, category_id, quantity, unit?, unit_price, expense_date, notes? }]`; saves the whole grid in one transaction. Row errors come back as `rows.<index>.<field>`. Totals are calculated by MySQL. |

## Labour, machinery, transport

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/labour` | Public | `q, district_id, division_id, max_wage, available_only, sort` |
| GET | `/labour/me` | labour | Own work profile (or `null`) |
| PUT | `/labour/me` | labour | `skills, experience_years, experience_details?, daily_wage, district_id, upazila?, is_available, available_from?` |
| PATCH | `/labour/me/availability` | labour | `is_available, available_from?` |
| GET | `/labour/:id` | Public | One worker |
| GET | `/service-areas` | providers | Extra service areas |
| PUT | `/service-areas` | providers | `areas: [{ district_id, upazila? }]` (replaces the list) |
| GET | `/machinery` | Public | `type (harvester or tractor)` required; `q, district_id, division_id, max_price, price_unit, available_only, sort` |
| GET | `/machinery/mine` | harvester_owner, tractor_owner | Includes `pending_bookings` |
| GET | `/machinery/:id` | Public | Photos and service areas |
| POST | `/machinery` | harvester_owner, tractor_owner | multipart: `name, brand?, model?, model_year?, horsepower?, description?, rental_price, price_unit, district_id, upazila?, is_available` + `images`. The type follows the owner's role. |
| PUT | `/machinery/:id` | owner | Same plus `remove_image_ids` |
| PATCH | `/machinery/:id/availability` | owner | `is_available` |
| DELETE | `/machinery/:id` | owner | Blocked while bookings are open; hidden if it has history |
| GET | `/transport` | Public | `vehicle_type, district_id, division_id, max_price, min_capacity_kg, available_only, sort` |
| GET | `/transport/mine` | transport_owner | Includes the private `registration_number` |
| GET | `/transport/:id` | Public | The registration number is shown only to the owner and admins |
| POST / PUT / PATCH / DELETE | `/transport...` | transport_owner (owner) | `vehicle_type, name, registration_number?, capacity, capacity_unit, price, price_unit, district_id, upazila?, description?, is_available` + `images` |

## Bookings

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/bookings` | farmer (any service), buyer (transport) | `booking_type`, then `labour_id` / `machinery_id` / `transport_vehicle_id`, plus `start_date, end_date, work_district_id, work_upazila?, work_address?, destination?, work_size?, work_size_unit?, requester_note?`. The price is copied from the service at booking time. |
| GET | `/bookings` | Login | `as (requester or provider), status, booking_type` |
| GET | `/bookings/:id` | party, admin | Phone numbers appear once accepted; `can_review` |
| PATCH | `/bookings/:id` | party | `action: accept, reject, start, complete or cancel`; `note` is required for reject/cancel. Accepting is refused if the same machine/vehicle/worker already has an accepted booking for overlapping dates. |

## Reviews

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/reviews` | Login | `trade_id` **or** `booking_id`, `rating (1–5), comment?`; only after completion, once per person |
| GET | `/reviews/pending` | Login | Completed trades/bookings not yet reviewed |

## Notifications and complaints

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/notifications` | Login | `unread_only, type`; `meta.unread` |
| GET | `/notifications/unread-count` | Login | `{ unread, unread_messages }` (polled by the bell) |
| PATCH | `/notifications/read-all` | Login | |
| PATCH | `/notifications/:id/read` | Login (owner) | |
| DELETE | `/notifications/:id` | Login (owner) | |
| POST | `/complaints` | Login | `category, subject, description, against_user_id?, trade_id?, booking_id?` |
| GET | `/complaints/mine` | Login | Own complaints with admin replies |

## AI chatbot

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/chatbot/status` | Public | `{ configured, provider, model }` |
| GET | `/chatbot/conversations` | Login | Saved conversations |
| GET | `/chatbot/conversations/:id` | Login (owner) | Messages |
| DELETE | `/chatbot/conversations/:id` | Login (owner) | |
| POST | `/chatbot/messages` | Login | `message, language (bn or en), conversation_id?` → `{ conversation_id, title, reply }`. Returns 503 with a clear message when no AI key is configured. The key never leaves the server. |

## Dashboard

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/dashboard` | Login | Role-specific numbers: farmer (listings, offers, trades, harvests, expenses, charts), buyer (offers, trades, purchases), providers (booking counts, open requests, jobs per month) |

## Admin (every route needs the `admin` role)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/stats` | Totals, users by role, registrations per month, recent activity |
| GET | `/admin/reports` | Trades per month, listings by category, top crops, bookings by service, users by district |
| GET | `/admin/activity` | Activity log, `q` |
| GET | `/admin/users` | `q, role, status (active or blocked), verification` |
| GET | `/admin/users/:id` | Details, counts, active sessions, verification history |
| PATCH | `/admin/users/:id/block` | `reason`; ends the user's sessions. Admin accounts cannot be blocked here. |
| PATCH | `/admin/users/:id/unblock` | |
| PATCH | `/admin/users/:id/role` | `role` (any non-admin role) |
| GET | `/admin/verifications` | `status, q` |
| GET | `/admin/verifications/:id/document` | Streams the private document (no caching) |
| PATCH | `/admin/verifications/:id` | `status: approved or rejected, admin_note` (required when rejecting) |
| GET | `/admin/listings` | `q, status` |
| PATCH | `/admin/listings/:id/status` | `status: removed or active, admin_note` |
| GET / POST / PUT | `/admin/crops`, `/admin/crops/:id` | Crop catalogue: `category_id, slug, name_en, name_bn, default_unit, is_active` |
| GET | `/admin/harvests/overview` | Counts by status, crop and district |
| GET | `/admin/expenses/overview` | Totals only (individual notebooks stay private) |
| GET | `/admin/bookings` | `q, status, booking_type` |
| PATCH | `/admin/bookings/:id/cancel` | `note` |
| GET | `/admin/trades` | `q, status`; `meta.summary` |
| PATCH | `/admin/trades/:id/resolve` | Disputed trades only: `to_status (completed or cancelled), note` |
| GET | `/admin/complaints` | `q, status, category` |
| PATCH | `/admin/complaints/:id` | `status, admin_note` (the complainant is notified) |
| GET | `/admin/reviews` | `q, hidden, max_rating` |
| PATCH | `/admin/reviews/:id/hide` · `/unhide` | `reason` when hiding |
| GET / POST | `/admin/announcements` | `title, body, target_role?`; notifies every non-blocked user (of that role) |

## Quick test with PowerShell

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/auth/login `
  -ContentType "application/json" -Body '{"identifier":"admin@example.com","password":"your-password"}'
$headers = @{ Authorization = "Bearer $($login.data.token)" }
Invoke-RestMethod -Uri http://localhost:5000/api/admin/stats -Headers $headers
```
