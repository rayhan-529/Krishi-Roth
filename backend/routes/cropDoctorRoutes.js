/** Crop doctor (photo diagnosis) for logged-in users; shares the AI chatbot rate limit. */
const express = require("express");
const c = require("../controllers/cropDoctorController");
const { authenticate } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { chatbotLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/diagnose", authenticate, chatbotLimiter, c.receivePhoto, validateBody(c.schemas.diagnose), c.diagnose);

module.exports = router;
