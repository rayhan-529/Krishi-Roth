/**
 * Mounts every API module under /api.
 */
const express = require("express");

const router = express.Router();

router.use("/meta", require("./metaRoutes"));
router.use("/auth", require("./authRoutes"));
router.use("/", require("./profileRoutes")); // /profile and /users/:id
router.use("/verifications", require("./verificationRoutes"));
router.use("/market-prices", require("./marketPriceRoutes"));
router.use("/weather", require("./weatherRoutes"));
router.use("/listings", require("./listingRoutes"));
router.use("/offers", require("./offerRoutes"));
router.use("/trades", require("./tradeRoutes"));
router.use("/wallet-sms", require("./walletSmsRoutes"));
router.use("/wallet", require("./walletRoutes"));
router.use("/conversations", require("./messageRoutes"));
router.use("/harvests", require("./harvestRoutes"));
router.use("/notebooks", require("./notebookRoutes"));
router.use("/labour", require("./labourRoutes"));
router.use("/service-areas", require("./serviceAreaRoutes"));
router.use("/machinery", require("./machineryRoutes"));
router.use("/transport", require("./transportRoutes"));
router.use("/bookings", require("./bookingRoutes"));
router.use("/reviews", require("./reviewRoutes"));
router.use("/notifications", require("./notificationRoutes"));
router.use("/complaints", require("./complaintRoutes"));
router.use("/chatbot", require("./chatbotRoutes"));
router.use("/crop-doctor", require("./cropDoctorRoutes"));
router.use("/dashboard", require("./dashboardRoutes"));
router.use("/admin", require("./adminRoutes"));

module.exports = router;
