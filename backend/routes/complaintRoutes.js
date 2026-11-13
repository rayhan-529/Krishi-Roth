const express = require("express");
const c = require("../controllers/complaintController");
const { authenticate } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");

const router = express.Router();

router.use(authenticate);
router.post("/", validateBody(c.schemas.create), c.create);
router.get("/mine", c.mine);

module.exports = router;
