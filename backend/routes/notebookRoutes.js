const express = require("express");
const c = require("../controllers/notebookController");
const { authenticate, authorize } = require("../middleware/auth");
const { validateBody, validateQuery, validateId } = require("../middleware/validate");

const router = express.Router();

router.use(authenticate, authorize("farmer"));
router.get("/", c.list);
router.get("/summary", c.summary);
router.get("/:id", validateId(), validateQuery(c.schemas.show), c.show);
router.post("/", validateBody(c.schemas.save), c.create);
router.put("/:id", validateId(), validateBody(c.schemas.save), c.update);
router.delete("/:id", validateId(), c.remove);
// Saves every row of the notebook grid at once (rows are validated in the controller)
router.put("/:id/rows", validateId(), c.saveRows);

module.exports = router;
