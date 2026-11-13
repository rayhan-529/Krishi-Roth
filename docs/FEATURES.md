# Feature Documentation

How each requirement in the project brief is implemented. Paths are relative to the project root.

| Req. | Feature | Backend | Frontend |
|---|---|---|---|
| FR-01 | Authentication: register, login, logout, bcrypt, JWT, role redirects, protected routes, validation, profile | `controllers/authController.js`, `services/tokenService.js`, `middleware/auth.js`, `utils/validator.js`, `utils/password.js` | `pages/auth/Login.jsx`, `Register.jsx`, `components/ProtectedRoute.jsx`, `context/AuthContext.jsx` |
| FR-02 | Farmer dashboard: listings, harvests, expenses, prices, bookings, offers, notifications, charts | `controllers/dashboardController.js` | `pages/farmer/FarmerDashboard.jsx`, `components/BarChart.jsx` |
| FR-03 | Market prices: categories, markets, location, unit price, date, comparison, search/filter; admin-entered and labelled | `controllers/marketPriceController.js` | `pages/market/MarketPrices.jsx`, `pages/admin/AdminMarketPrices.jsx` |
| FR-04 | Marketplace: listings with photos, search/filter, seller info and rating, contact, offers, edit/delete/mark sold | `controllers/listingController.js`, `offerController.js`, `messageController.js`, `services/imageService.js` | `pages/market/Marketplace.jsx`, `ListingDetails.jsx`, `pages/farmer/MyListings.jsx`, `ListingForm.jsx`, `pages/shared/Messages.jsx` |
| FR-05 | Safe trade workflow with all nine statuses, history, cancel/dispute, review after completion; no real payments | `controllers/offerController.js`, `tradeController.js`, `services/tradeService.js`, `adminController.resolveTrade` | `pages/shared/Offers.jsx`, `Trades.jsx`, `TradeDetails.jsx`, `pages/admin/AdminTrades.jsx` |
| FR-06 | Harvest management: land size, quantity, expected/actual dates, five statuses, history, reminders | `controllers/harvestController.js`, `services/reminderService.js` | `pages/farmer/Harvests.jsx` |
| FR-07 | Digital expense notebook: paper-notebook grid, 25 starting rows + add more, auto row/overall totals, filters, saved in MySQL, cost per crop/harvest | `controllers/notebookController.js` (generated `total_cost` column) | `pages/farmer/Notebooks.jsx`, `NotebookEditor.jsx` |
| FR-08 | Labour: search by location/wage/availability, profiles, work requests, accept/reject | `controllers/labourController.js`, `bookingController.js`, `serviceAreaController.js` | `pages/services/LabourSearch.jsx`, `pages/provider/MyServices.jsx`, `pages/shared/Bookings.jsx` |
| FR-09 | Harvester, tractor and transport services with booking and provider management | `controllers/machineryController.js`, `transportController.js`, `bookingController.js` | `pages/services/MachineryRental.jsx`, `TransportServices.jsx`, `components/BookingModal.jsx`, `pages/shared/BookingDetails.jsx` |
| FR-10 | AI chatbot: Bengali/English, backend API, key in .env, loading/error states, history, clear "not configured" state | `services/aiService.js`, `controllers/chatbotController.js` | `pages/shared/Chatbot.jsx` |
| FR-11 | Notifications for offers, bookings, harvest reminders, prices, trades and announcements; read/unread, history | `services/notificationService.js`, `controllers/notificationController.js` | `pages/shared/Notifications.jsx`, bell in `components/Layout.jsx` |
| FR-12 | Profile and verification: edit, photo, password change, verification request, admin approval; private documents | `controllers/profileController.js`, `verificationController.js` | `pages/shared/Profile.jsx`, `PublicProfile.jsx`, `pages/admin/AdminVerifications.jsx` |
| FR-13 | Ratings and reviews: 1–5 stars, comments, averages (view `user_rating_summary`), only after completion, no duplicates | `controllers/reviewController.js`, unique keys in `reviews` | `components/ReviewModal.jsx`, `StarInput`/`Stars` in `components/ui.jsx` |
| FR-14 | Admin panel: statistics, users, roles, verifications, listings, prices, harvest/expense overviews, bookings, trades, complaints, reviews, announcements, reports; pagination/search/filters; confirmation before destructive actions | `controllers/adminController.js`, `routes/adminRoutes.js` (`authorize("admin")`) | `pages/admin/*` |

## Cross-cutting

- **Bengali/English:** `context/LanguageContext.jsx` (`tr(bn, en)`), `utils/labels.js` for every status/unit, `utils/format.js` for Bengali digits, money and dates. The API answers in the language sent in `Accept-Language`.
- **One login for everyone:** admins use `/login` too; `/admin/login` simply redirects there.
- **Unique token per login/registration:** `services/tokenService.js` + `user_sessions` table.
- **Password rule:** minimum 8 characters (users and admin), `utils/password.js`.
- **Responsive design:** mobile-first CSS in `styles/global.css`; sidebar on desktop, drawer on phones; tables scroll horizontally.
- **States:** loading (with a "server is waking up" note on free hosting), empty, error-with-retry and success toasts on every page.
- **Photos:** `services/storageService.js`: local folder in development, Cloudinary in production.
- **No demo data:** the database ships with reference data only (roles, 64 districts, crops, expense categories). Market prices come only from admins.
