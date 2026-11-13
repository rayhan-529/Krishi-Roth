const express = require("express");
const c = require("../controllers/chatbotController");
const { authenticate } = require("../middleware/auth");
const { validateBody, validateId } = require("../middleware/validate");
const { chatbotLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.get("/status", c.status);
router.use(authenticate);
router.get("/conversations", c.conversations);
router.get("/conversations/:id", validateId(), c.messages);
router.delete("/conversations/:id", validateId(), c.remove);
router.post("/messages", chatbotLimiter, validateBody(c.schemas.send), c.sendMessage);

module.exports = router;
