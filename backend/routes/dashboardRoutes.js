const express = require("express");
const c = require("../controllers/dashboardController");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, c.show);

module.exports = router;
