const express = require("express");
const c = require("../controllers/notificationController");
const { authenticate } = require("../middleware/auth");
const { validateQuery, validateId } = require("../middleware/validate");

const router = express.Router();

// The live stream checks its own one-time ticket (EventSource cannot send the login header).
router.get("/stream", c.stream);

router.use(authenticate);
router.post("/stream-ticket", c.streamTicket);
router.get("/", validateQuery(c.schemas.list), c.list);
router.get("/unread-count", c.unreadCount);
router.patch("/read-all", c.markAllRead);
router.patch("/:id/read", validateId(), c.markRead);
router.delete("/:id", validateId(), c.remove);

module.exports = router;
