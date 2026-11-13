const express = require("express");
const c = require("../controllers/listingController");
const offers = require("../controllers/offerController");
const { authenticate, authorize, optionalAuth } = require("../middleware/auth");
const { validateBody, validateQuery, validateId } = require("../middleware/validate");
const { imageUpload } = require("../middleware/upload");

const router = express.Router();
const farmer = [authenticate, authorize("farmer")];

router.get("/", validateQuery(c.schemas.search), c.search);
router.get("/mine", ...farmer, validateQuery(c.schemas.mine), c.mine);
router.get("/:id", validateId(), optionalAuth, c.show);
router.post("/", ...farmer, ...imageUpload("listings", 5), validateBody(c.schemas.create), c.create);
router.put("/:id", validateId(), ...farmer, ...imageUpload("listings", 5), validateBody(c.schemas.update), c.update);
router.patch("/:id/status", validateId(), ...farmer, validateBody(c.schemas.status), c.setStatus);
router.delete("/:id", validateId(), ...farmer, c.remove);

// A buyer sends a purchase offer on a listing
router.post("/:id/offers", validateId(), authenticate, authorize("buyer"), validateBody(offers.schemas.create), offers.create);

module.exports = router;
