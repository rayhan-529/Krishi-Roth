const express = require("express");
const c = require("../controllers/tradeController");
const map = require("../controllers/tradeMapController");
const { authenticate, authorize } = require("../middleware/auth");
const { validateBody, validateQuery, validateId } = require("../middleware/validate");

const router = express.Router();

router.use(authenticate);
router.get("/", authorize("farmer", "buyer"), validateQuery(c.schemas.list), c.list);
router.get("/:id", validateId(), authorize("farmer", "buyer", "admin"), c.show);
router.patch("/:id", validateId(), authorize("farmer", "buyer"), validateBody(c.schemas.action), c.act);

// Delivery map: pickup / drop points and the vehicle's live location
router.patch("/:id/place", validateId(), authorize("farmer", "buyer"), validateBody(map.schemas.place), map.place);
router.post("/:id/tracking", validateId(), authorize("farmer", "buyer"), validateBody(map.schemas.tracking), map.track);
router.delete("/:id/tracking", validateId(), authorize("farmer", "buyer"), map.stopTracking);

module.exports = router;
