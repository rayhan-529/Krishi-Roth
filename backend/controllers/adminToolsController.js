/**
 * Admin diagnostics. "Send test email" shows the real SMTP result on the live
 * server (normal users only ever see a generic message, for security).
 */
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { config } = require("../config/env");
const { isConfigured, getTransporter, sendResetCode } = require("../services/mailService");
const { logActivity } = require("../services/activityService");

const schemas = { testEmail: { to: v.email().required() } };

async function testEmail(req, res) {
  const where = `${config.mail.host || "-"}:${config.mail.port} (${config.mail.user || "no user"})`;
  if (!isConfigured()) {
    throw ApiError.badRequest(
      `সার্ভারে email সেট করা নেই (SMTP_HOST/SMTP_USER/SMTP_PASS)। ${where}`,
      `Email is not configured on the server (SMTP_HOST/SMTP_USER/SMTP_PASS). ${where}`
    );
  }

  try {
    await getTransporter().verify();
  } catch (err) {
    throw ApiError.badRequest(
      `Email সার্ভারে ঢোকা যায়নি: ${err.message} [${where}]`,
      `Could not log in to the email server: ${err.message} [${where}]`
    );
  }

  const code = String(require("crypto").randomInt(0, 1000000)).padStart(6, "0");
  // sendMail turns failures into a generic error; the real reason is in the server log.
  await sendResetCode({ name: "Krishi Roth test", email: req.body.to, preferred_language: "bn" }, code, 15);
  await logActivity(req, "admin.test_email", "user", req.user.id, req.body.to);
  send(req, res, {
    message: [
      `টেস্ট email পাঠানো হয়েছে ${req.body.to}-এ (নমুনা কোড ${code})। Inbox ও Spam দেখুন।`,
      `Test email sent to ${req.body.to} (sample code ${code}). Check the inbox and spam folder.`
    ],
    data: { server: where, from: config.mail.from }
  });
}

module.exports = { schemas, testEmail };
