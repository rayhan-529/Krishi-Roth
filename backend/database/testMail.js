/**
 * Checks the email (SMTP) settings and sends one test email.
 *   npm run mail:test                 -> sends to SMTP_USER
 *   npm run mail:test -- you@mail.com -> sends to that address
 */
const { config } = require("../config/env");
const { isConfigured, getTransporter, sendResetCode } = require("../services/mailService");

(async () => {
  if (!isConfigured()) {
    console.error(
      "Email is not configured yet. In backend/.env fill in SMTP_HOST, SMTP_USER and SMTP_PASS.\n" +
        "Gmail App password: https://myaccount.google.com/apppasswords"
    );
    process.exit(1);
  }

  console.log(`Connecting to ${config.mail.host}:${config.mail.port} as ${config.mail.user} ...`);
  try {
    await getTransporter().verify();
  } catch (err) {
    console.error("Login to the email server failed:", err.message);
    if (/535|Username and Password|BadCredentials|Authentication failed/i.test(err.message)) {
      if (/gmail/i.test(config.mail.host)) {
        console.error("-> For Gmail, SMTP_PASS must be a 16-letter App password, not your normal Gmail password.");
      } else if (/brevo/i.test(config.mail.host)) {
        console.error("-> For Brevo, SMTP_USER is the 'Login' shown under SMTP & API -> SMTP (often ...@smtp-brevo.com), and SMTP_PASS is the SMTP key.");
      } else {
        console.error("-> Check SMTP_USER and SMTP_PASS.");
      }
    }
    process.exit(1);
  }
  console.log("Connected.");

  const to = process.argv[2] || config.mail.user;
  // A random sample code, just like the real "Forgot password" email (this one is not usable).
  const code = String(require("crypto").randomInt(0, 1000000)).padStart(6, "0");
  await sendResetCode({ name: "Krishi Roth test", email: to, preferred_language: "bn" }, code, 15);
  console.log(`Test email sent to ${to} (from ${config.mail.from}) with sample code ${code}. Check the inbox and spam folder.`);
})().catch((err) => {
  console.error("Sending failed:", err.message);
  process.exit(1);
});
