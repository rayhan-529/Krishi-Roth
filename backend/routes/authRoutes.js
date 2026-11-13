const express = require("express");
const c = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/register", authLimiter, validateBody(c.schemas.register), c.register);
router.post("/login", authLimiter, validateBody(c.schemas.login), c.login);
router.get("/me", authenticate, c.me);
router.post("/logout", authenticate, c.logout);
router.post("/logout-all", authenticate, c.logoutAll);
router.post("/change-password", authenticate, authLimiter, validateBody(c.schemas.changePassword), c.changePassword);

module.exports = router;
