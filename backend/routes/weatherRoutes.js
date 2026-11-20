/** Public weather forecast; logged-in users get their own district by default. */
const express = require("express");
const c = require("../controllers/weatherController");
const { optionalAuth } = require("../middleware/auth");
const { validateQuery } = require("../middleware/validate");

const router = express.Router();

router.get("/", optionalAuth, validateQuery(c.schemas.forecast), c.forecast);

module.exports = router;
