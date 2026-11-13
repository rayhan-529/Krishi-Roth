const express = require("express");
const c = require("../controllers/harvestController");
const { authenticate, authorize } = require("../middleware/auth");
const { validateBody, validateQuery, validateId } = require("../middleware/validate");

const router = express.Router();

router.use(authenticate, authorize("farmer"));
router.get("/", validateQuery(c.schemas.list), c.list);
router.get("/upcoming", c.upcoming);
router.get("/:id", validateId(), c.show);
router.post("/", validateBody(c.schemas.save), c.create);
router.put("/:id", validateId(), validateBody(c.schemas.save), c.update);
router.patch("/:id/status", validateId(), validateBody(c.schemas.status), c.setStatus);
router.delete("/:id", validateId(), c.remove);

module.exports = router;
