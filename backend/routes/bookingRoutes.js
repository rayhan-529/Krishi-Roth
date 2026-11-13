const express = require("express");
const c = require("../controllers/bookingController");
const { authenticate, authorize } = require("../middleware/auth");
const { validateBody, validateQuery, validateId } = require("../middleware/validate");

const router = express.Router();

router.use(authenticate);
router.post("/", authorize("farmer", "buyer"), validateBody(c.schemas.create), c.create);
router.get("/", validateQuery(c.schemas.list), c.list);
router.get("/:id", validateId(), c.show);
router.patch("/:id", validateId(), validateBody(c.schemas.action), c.act);

module.exports = router;
