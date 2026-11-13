const express = require("express");
const c = require("../controllers/reviewController");
const { authenticate } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");

const router = express.Router();

router.use(authenticate);
router.post("/", validateBody(c.schemas.create), c.create);
router.get("/pending", c.pending);

module.exports = router;
