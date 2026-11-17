/** Public webhook for the SMS-forwarder app; protected by WALLET_SMS_SECRET, not by login. */
const express = require("express");
const c = require("../controllers/walletSmsController");

const router = express.Router();
router.post("/", c.receive);

module.exports = router;
