/** Wallet for farmers and buyers (Safe Trade). Admin review endpoints live in adminRoutes. */
const express = require("express");
const c = require("../controllers/walletController");
const { authenticate, authorize } = require("../middleware/auth");
const { validateBody, validateQuery } = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.use(authenticate, authorize("farmer", "buyer"));
router.get("/", c.summary);
router.get("/transactions", validateQuery(c.schemas.paging), c.transactions);
router.get("/deposits", c.myDeposits);
router.post("/deposits", authLimiter, validateBody(c.schemas.deposit), c.createDeposit);
router.get("/withdrawals", c.myWithdrawals);
router.post("/withdrawals", authLimiter, validateBody(c.schemas.withdraw), c.createWithdrawal);

module.exports = router;
