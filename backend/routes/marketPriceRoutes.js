const express = require("express");
const c = require("../controllers/marketPriceController");
const { authenticate, authorize } = require("../middleware/auth");
const { validateBody, validateQuery, validateId } = require("../middleware/validate");

const router = express.Router();
const admin = [authenticate, authorize("admin")];

router.get("/", validateQuery(c.schemas.list), c.list);
router.get("/matrix", validateQuery(c.schemas.matrix), c.matrix);
router.get("/compare", validateQuery(c.schemas.compare), c.compare);
router.post("/", ...admin, validateBody(c.schemas.save), c.create);
router.put("/:id", validateId(), ...admin, validateBody(c.schemas.save), c.update);
router.delete("/:id", validateId(), ...admin, c.remove);

module.exports = router;
