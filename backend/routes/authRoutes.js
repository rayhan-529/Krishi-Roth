const express = require("express");
const c = require("../controllers/authController");
const x = require("../controllers/authExtraController");
const { authenticate } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { authLimiter, emailLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/register", authLimiter, validateBody(c.schemas.register), c.register);
router.post("/login", authLimiter, validateBody(c.schemas.login), c.login);
router.get("/providers", x.providers);
router.post("/forgot-password", emailLimiter, validateBody(x.schemas.email), x.forgotPassword);
router.post("/reset-password", authLimiter, validateBody(x.schemas.resetPassword), x.resetPassword);
router.post("/login-link", emailLimiter, validateBody(x.schemas.email), x.requestLoginLink);
router.post("/login-link/verify", authLimiter, validateBody(x.schemas.loginLink), x.verifyLoginLink);
router.post("/social", authLimiter, validateBody(x.schemas.social), x.socialLogin);
router.get("/me", authenticate, c.me);
router.post("/logout", authenticate, c.logout);
router.post("/logout-all", authenticate, c.logoutAll);
router.post("/change-password", authenticate, authLimiter, validateBody(c.schemas.changePassword), c.changePassword);

module.exports = router;
