/**
 * Picks the reply language for each request.
 * The frontend sends "Accept-Language: bn" or "Accept-Language: en".
 * Bengali is the default.
 *
 * Adds:
 *   req.lang          "bn" | "en"
 *   req.t(bn, en)     returns the text in the chosen language
 */
function language(req, res, next) {
  const header = String(req.headers["accept-language"] || "").toLowerCase();
  req.lang = header.startsWith("en") ? "en" : "bn";
  req.t = (bn, en) => (req.lang === "en" ? en || bn : bn);
  next();
}

module.exports = language;
