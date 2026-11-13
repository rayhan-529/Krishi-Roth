const express = require("express");
const c = require("../controllers/notificationController");
const { authenticate } = require("../middleware/auth");
const { validateQuery, validateId } = require("../middleware/validate");

const router = express.Router();

router.use(authenticate);
router.get("/", validateQuery(c.schemas.list), c.list);
router.get("/unread-count", c.unreadCount);
router.patch("/read-all", c.markAllRead);
router.patch("/:id/read", validateId(), c.markRead);
router.delete("/:id", validateId(), c.remove);

module.exports = router;
