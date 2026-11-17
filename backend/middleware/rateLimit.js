/**
 * Rate limits for sensitive endpoints (protects against password guessing
 * and abuse of the paid AI API).
 */
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

function limitMessage(req, res) {
  res.status(429).json({
    success: false,
    message: req.t(
      "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
      "Too many attempts. Please wait a little and try again."
    )
  });
}

const common = { standardHeaders: "draft-8", legacyHeaders: false, handler: limitMessage };

/** Login and registration: 10 failed attempts per 15 minutes per IP. */
const authLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true
});

/** Emails (reset codes, sign-in links): 5 per 15 minutes per IP. */
const emailLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 5
});

/** AI chatbot: 20 messages per 10 minutes per user. */
const chatbotLimiter = rateLimit({
  ...common,
  windowMs: 10 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => (req.user ? `user-${req.user.id}` : ipKeyGenerator(req.ip))
});

/** Everything else: 600 requests per 15 minutes per IP. */
const apiLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 600
});

module.exports = { authLimiter, emailLimiter, chatbotLimiter, apiLimiter };
