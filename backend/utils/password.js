/**
 * One password rule for every account (users and admin):
 *   - at least 6 characters
 *   - at least one letter, one number and one symbol (e.g. @ # $ !)
 *   - at most 64 characters (bcrypt only uses the first 72 bytes)
 * The same rule is shown live in the browser (frontend/src/utils/password.js).
 */
const BCRYPT_ROUNDS = 12;
const MIN_LENGTH = 6;
const MAX_LENGTH = 64;

const RULES = [
  {
    test: (p) => p.length >= MIN_LENGTH,
    bn: `পাসওয়ার্ড কমপক্ষে ${MIN_LENGTH} অক্ষরের হতে হবে।`,
    en: `Password must be at least ${MIN_LENGTH} characters.`
  },
  { test: (p) => /\p{L}/u.test(p), bn: "পাসওয়ার্ডে অন্তত একটি অক্ষর (a-z) দিন।", en: "Password must include a letter." },
  { test: (p) => /\d/.test(p), bn: "পাসওয়ার্ডে অন্তত একটি সংখ্যা (0-9) দিন।", en: "Password must include a number." },
  {
    test: (p) => /[^\p{L}\p{N}\s]/u.test(p),
    bn: "পাসওয়ার্ডে অন্তত একটি চিহ্ন (যেমন @ # $ !) দিন।",
    en: "Password must include a symbol (e.g. @ # $ !)."
  }
];

/**
 * @param {string} password
 * @returns {{bn: string, en: string} | null} a problem message, or null when acceptable
 */
function checkPasswordStrength(password) {
  if (typeof password !== "string") return { bn: RULES[0].bn, en: RULES[0].en };

  if (password.length > MAX_LENGTH) {
    return {
      bn: `পাসওয়ার্ড ${MAX_LENGTH} অক্ষরের বেশি হতে পারবে না।`,
      en: `Password cannot be longer than ${MAX_LENGTH} characters.`
    };
  }

  for (const rule of RULES) {
    if (!rule.test(password)) return { bn: rule.bn, en: rule.en };
  }
  return null;
}

module.exports = { checkPasswordStrength, BCRYPT_ROUNDS, MIN_LENGTH, MAX_LENGTH };
