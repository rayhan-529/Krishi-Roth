const express = require("express");
const c = require("../controllers/transportController");
const { authenticate, authorize, optionalAuth } = require("../middleware/auth");
const { validateBody, validateQuery, validateId } = require("../middleware/validate");
const { imageUpload } = require("../middleware/upload");

const router = express.Router();
const owner = [authenticate, authorize("transport_owner")];

router.get("/", validateQuery(c.schemas.search), c.search);
router.get("/mine", ...owner, c.mine);
router.get("/:id", validateId(), optionalAuth, c.show);
router.post("/", ...owner, ...imageUpload("vehicles", 5), validateBody(c.schemas.create), c.create);
router.put("/:id", validateId(), ...owner, ...imageUpload("vehicles", 5), validateBody(c.schemas.update), c.update);
router.patch("/:id/availability", validateId(), ...owner, validateBody(c.schemas.availability), c.setAvailability);
router.delete("/:id", validateId(), ...owner, c.remove);

module.exports = router;
