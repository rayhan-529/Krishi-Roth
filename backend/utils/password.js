/**
 * One password rule for every account (users and admin):
 *   - at least 8 characters
 *   - at most 64 characters (bcrypt only uses the first 72 bytes)
 */
const BCRYPT_ROUNDS = 12;
const MIN_LENGTH = 8;
const MAX_LENGTH = 64;

/**
 * @param {string} password
 * @returns {{bn: string, en: string} | null} a problem message, or null when acceptable
 */
function checkPasswordStrength(password) {
  if (typeof password !== "string" || password.length < MIN_LENGTH) {
    return {
      bn: `পাসওয়ার্ড কমপক্ষে ${MIN_LENGTH} অক্ষরের হতে হবে।`,
      en: `Password must be at least ${MIN_LENGTH} characters.`
    };
  }

  if (password.length > MAX_LENGTH) {
    return {
      bn: `পাসওয়ার্ড ${MAX_LENGTH} অক্ষরের বেশি হতে পারবে না।`,
      en: `Password cannot be longer than ${MAX_LENGTH} characters.`
    };
  }

  if (password.trim().length === 0) {
    return { bn: "শুধু ফাঁকা জায়গা দিয়ে পাসওয়ার্ড হবে না।", en: "Password cannot be only spaces." };
  }

  return null;
}

module.exports = { checkPasswordStrength, BCRYPT_ROUNDS, MIN_LENGTH, MAX_LENGTH };
