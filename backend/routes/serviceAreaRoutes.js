const express = require("express");
const c = require("../controllers/serviceAreaController");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, authorize(...c.PROVIDER_ROLES));
router.get("/", c.list);
router.put("/", c.replace);

module.exports = router;
