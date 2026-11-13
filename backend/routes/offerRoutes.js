const express = require("express");
const c = require("../controllers/offerController");
const { authenticate, authorize } = require("../middleware/auth");
const { validateBody, validateQuery, validateId } = require("../middleware/validate");

const router = express.Router();

router.use(authenticate);
router.get("/", authorize("farmer", "buyer"), validateQuery(c.schemas.list), c.list);
router.patch("/:id/accept", validateId(), authorize("farmer"), validateBody(c.schemas.respond), c.accept);
router.patch("/:id/reject", validateId(), authorize("farmer"), validateBody(c.schemas.respond), c.reject);
router.patch("/:id/withdraw", validateId(), authorize("buyer"), c.withdraw);

module.exports = router;
