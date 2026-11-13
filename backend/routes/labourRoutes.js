const express = require("express");
const c = require("../controllers/labourController");
const { authenticate, authorize } = require("../middleware/auth");
const { validateBody, validateQuery, validateId } = require("../middleware/validate");

const router = express.Router();
const labour = [authenticate, authorize("labour")];

router.get("/", validateQuery(c.schemas.search), c.search);
router.get("/me", ...labour, c.myProfile);
router.put("/me", ...labour, validateBody(c.schemas.profile), c.saveProfile);
router.patch("/me/availability", ...labour, validateBody(c.schemas.availability), c.setAvailability);
router.get("/:id", validateId(), c.show);

module.exports = router;
