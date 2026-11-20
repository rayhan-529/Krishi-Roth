/**
 * Sends email through SMTP (Gmail, Brevo, Mailgun, any provider).
 *
 * When SMTP_HOST is not set, nothing is sent: the message is printed in the
 * server console so password-reset codes can still be tested locally.
 */
const nodemailer = require("nodemailer");
const { config } = require("../config/env");
const ApiError = require("../utils/ApiError");

let transporter = null;

/** Email is sent only when the host and the login are both filled in. */
function isConfigured() {
  return Boolean(config.mail.host && config.mail.user && config.mail.pass);
}

function getTransporter() {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined
    });
  }
  return transporter;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** A simple branded email body. `highlight` is a code or a button link. */
function layout({ heading, intro, code, buttonText, buttonUrl, footer }) {
  const block = code
    ? `<div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0c3b27;background:#f1f5ef;border-radius:12px;padding:16px 0;text-align:center;margin:24px 0">${escapeHtml(code)}</div>`
    : `<div style="text-align:center;margin:28px 0"><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background:#15803d;color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:999px">${escapeHtml(buttonText)}</a></div>`;
  return `<!doctype html><html><body style="margin:0;background:#f1f5ef;font-family:Arial,Helvetica,sans-serif;color:#111827">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e1e8de">
    <div style="height:4px;background:linear-gradient(90deg,#15803d,#84cc16,#f5a524)"></div>
    <div style="padding:28px">
      <div style="font-weight:700;font-size:18px;color:#0c3b27">Krishi Roth · কৃষি রথ</div>
      <h1 style="font-size:20px;margin:20px 0 8px">${escapeHtml(heading)}</h1>
      <p style="margin:0;color:#374151;line-height:1.6">${escapeHtml(intro)}</p>
      ${block}
      <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6">${escapeHtml(footer)}</p>
    </div>
  </div></body></html>`;
}

/**
 * @param {{ to: string, subject: string, text: string, html: string }} message
 */
async function sendMail(message) {
  const transport = getTransporter();
  if (!transport) {
    console.log(
      `\n[mail] SMTP is not configured — email not sent. Printing it instead:\n` +
        `  To: ${message.to}\n  Subject: ${message.subject}\n  ${message.text.replace(/\n/g, "\n  ")}\n`
    );
    return;
  }
  try {
    await transport.sendMail({ from: config.mail.from, ...message });
  } catch (err) {
    console.error("[mail] Sending failed:", err.message);
    throw ApiError.unavailable(
      "এখন ইমেইল পাঠানো যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।",
      "Could not send the email right now. Please try again shortly."
    );
  }
}

/** Password-reset code email, in the user's language. */
function sendResetCode(user, code, minutes) {
  const bn = user.preferred_language !== "en";
  const subject = bn ? `পাসওয়ার্ড রিসেট কোড: ${code}` : `Your password reset code: ${code}`;
  const intro = bn
    ? `${user.name}, আপনার পাসওয়ার্ড রিসেট করতে নিচের কোডটি ব্যবহার করুন।`
    : `Hi ${user.name}, use this code to reset your password.`;
  const footer = bn
    ? `কোডটি ${minutes} মিনিট পর্যন্ত কার্যকর। আপনি অনুরোধ না করলে এই ইমেইলটি উপেক্ষা করুন।`
    : `The code expires in ${minutes} minutes. If you did not ask for this, ignore this email.`;
  return sendMail({
    to: user.email,
    subject,
    text: `${intro}\n\n${code}\n\n${footer}`,
    html: layout({ heading: bn ? "পাসওয়ার্ড রিসেট" : "Reset your password", intro, code, footer })
  });
}

/** What each two-step code is for, shown in the email/SMS. [bengali, english] */
const PURPOSE_TEXT = {
  login_2fa: ["নতুন ডিভাইস থেকে লগইন", "Sign-in from a new device"],
  withdraw: ["ওয়ালেট থেকে টাকা তোলা", "Withdrawing from your wallet"],
  password_change: ["পাসওয়ার্ড পরিবর্তন", "Changing your password"],
  enable_2fa: ["টু-স্টেপ ভেরিফিকেশন চালু করা", "Turning on two-step verification"],
  disable_2fa: ["টু-স্টেপ ভেরিফিকেশন বন্ধ করা", "Turning off two-step verification"]
};

/** Two-step verification code email. */
function sendSecurityCode(user, code, minutes, purpose) {
  const bn = user.preferred_language !== "en";
  const [whatBn, whatEn] = PURPOSE_TEXT[purpose] || ["নিরাপত্তা যাচাই", "Security check"];
  const intro = bn
    ? `${user.name}, ${whatBn}-এর জন্য নিচের কোডটি দিন।`
    : `Hi ${user.name}, enter this code to confirm: ${whatEn.toLowerCase()}.`;
  const footer = bn
    ? `কোডটি ${minutes} মিনিট পর্যন্ত কার্যকর। কাউকে বলবেন না। আপনি এটা না করে থাকলে এখনই পাসওয়ার্ড বদলান।`
    : `The code expires in ${minutes} minutes. Never share it. If this was not you, change your password now.`;
  return sendMail({
    to: user.email,
    subject: bn ? `কৃষি রথ যাচাই কোড: ${code}` : `Krishi Roth security code: ${code}`,
    text: `${intro}\n\n${code}\n\n${footer}`,
    html: layout({ heading: bn ? whatBn : whatEn, intro, code, footer })
  });
}

/** One-click sign-in link email. */
function sendLoginLink(user, url, minutes) {
  const bn = user.preferred_language !== "en";
  const intro = bn ? `${user.name}, নিচের বোতামে চাপ দিয়ে লগইন করুন।` : `Hi ${user.name}, tap the button below to sign in.`;
  const footer = bn
    ? `লিংকটি ${minutes} মিনিট পর্যন্ত ও একবারই কার্যকর। আপনি অনুরোধ না করলে উপেক্ষা করুন।`
    : `The link works once and expires in ${minutes} minutes. If you did not ask for this, ignore this email.`;
  return sendMail({
    to: user.email,
    subject: bn ? "কৃষি রথে লগইন লিংক" : "Your Krishi Roth sign-in link",
    text: `${intro}\n\n${url}\n\n${footer}`,
    html: layout({
      heading: bn ? "লগইন লিংক" : "Sign in to Krishi Roth",
      intro,
      buttonText: bn ? "লগইন করুন" : "Sign in",
      buttonUrl: url,
      footer
    })
  });
}

module.exports = { isConfigured, getTransporter, sendMail, sendResetCode, sendLoginLink, sendSecurityCode, PURPOSE_TEXT };
