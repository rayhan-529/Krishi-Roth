const express = require("express");
const c = require("../controllers/tradeController");
const { authenticate, authorize } = require("../middleware/auth");
const { validateBody, validateQuery, validateId } = require("../middleware/validate");

const router = express.Router();

router.use(authenticate);
router.get("/", authorize("farmer", "buyer"), validateQuery(c.schemas.list), c.list);
router.get("/:id", validateId(), authorize("farmer", "buyer", "admin"), c.show);
router.patch("/:id", validateId(), authorize("farmer", "buyer"), validateBody(c.schemas.action), c.act);

module.exports = router;
