const express = require("express");
const c = require("../controllers/verificationController");
const { authenticate } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { privateDocument } = require("../middleware/upload");

const router = express.Router();

router.use(authenticate);
router.post("/", ...privateDocument(), validateBody(c.schemas.create), c.create);
router.get("/mine", c.mine);

module.exports = router;
