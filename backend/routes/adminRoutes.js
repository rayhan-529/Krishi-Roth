/**
 * Every admin endpoint. Protected on the SERVER: authenticate + authorize("admin")
 * run before any of these handlers, whatever the frontend shows or hides.
 */
const express = require("express");
const c = require("../controllers/adminController");
const verifications = require("../controllers/verificationController");
const { authenticate, authorize } = require("../middleware/auth");
const { validateBody, validateQuery, validateId } = require("../middleware/validate");

const router = express.Router();
const id = validateId();

router.use(authenticate, authorize("admin"));

router.get("/stats", c.stats);
router.get("/reports", c.reports);
router.get("/activity", validateQuery(c.schemas.activity), c.activity);

router.get("/users", validateQuery(c.schemas.users), c.users);
router.get("/users/:id", id, c.userDetail);
router.patch("/users/:id/block", id, validateBody(c.schemas.block), c.blockUser);
router.patch("/users/:id/unblock", id, c.unblockUser);
router.patch("/users/:id/role", id, validateBody(c.schemas.role), c.changeRole);

router.get("/verifications", validateQuery(verifications.schemas.adminList), verifications.adminList);
router.get("/verifications/:id/document", id, verifications.document);
router.patch("/verifications/:id", id, validateBody(verifications.schemas.review), verifications.review);

router.get("/listings", validateQuery(c.schemas.listings), c.listings);
router.patch("/listings/:id/status", id, validateBody(c.schemas.listingStatus), c.setListingStatus);

router.get("/crops", c.crops);
router.post("/crops", validateBody(c.schemas.crop), c.saveCrop);
router.put("/crops/:id", id, validateBody(c.schemas.crop), c.saveCrop);

router.get("/harvests/overview", c.harvestOverview);
router.get("/expenses/overview", c.expenseOverview);

router.get("/bookings", validateQuery(c.schemas.bookings), c.bookings);
router.patch("/bookings/:id/cancel", id, validateBody(c.schemas.bookingCancel), c.cancelBooking);

router.get("/trades", validateQuery(c.schemas.trades), c.tradeList);
router.patch("/trades/:id/resolve", id, validateBody(c.schemas.resolveTrade), c.resolveTrade);

router.get("/complaints", validateQuery(c.schemas.complaints), c.complaints);
router.patch("/complaints/:id", id, validateBody(c.schemas.complaintUpdate), c.updateComplaint);

router.get("/reviews", validateQuery(c.schemas.reviews), c.reviews);
router.patch("/reviews/:id/hide", id, validateBody(c.schemas.hideReview), c.hideReview);
router.patch("/reviews/:id/unhide", id, c.unhideReview);

router.get("/announcements", c.announcements);
router.post("/announcements", validateBody(c.schemas.announcement), c.createAnnouncement);

module.exports = router;
