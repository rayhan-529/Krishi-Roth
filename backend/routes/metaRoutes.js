const express = require("express");
const c = require("../controllers/metaController");

const router = express.Router();

router.get("/lookups", c.lookups);
router.get("/stats", c.publicStats);

module.exports = router;
