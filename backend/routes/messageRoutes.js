const express = require("express");
const c = require("../controllers/messageController");
const { authenticate, authorize } = require("../middleware/auth");
const { validateBody, validateId } = require("../middleware/validate");

const router = express.Router();

router.use(authenticate, authorize("farmer", "buyer"));
router.get("/", c.list);
router.post("/", validateBody(c.schemas.start), c.start);
router.get("/:id", validateId(), c.messages);
router.post("/:id/messages", validateId(), validateBody(c.schemas.reply), c.reply);

module.exports = router;
