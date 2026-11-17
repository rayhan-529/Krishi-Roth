/**
 * Password rule shown in the browser. Must match backend/utils/password.js:
 * at least 6 characters with a letter, a number and a symbol.
 */
export const PASSWORD_RULES = [
  { key: 'length', test: (p) => p.length >= 6, bn: 'কমপক্ষে ৬ অক্ষর', en: 'At least 6 characters' },
  { key: 'letter', test: (p) => /\p{L}/u.test(p), bn: 'একটি অক্ষর (a-z)', en: 'A letter (a-z)' },
  { key: 'number', test: (p) => /\d/.test(p), bn: 'একটি সংখ্যা (0-9)', en: 'A number (0-9)' },
  { key: 'symbol', test: (p) => /[^\p{L}\p{N}\s]/u.test(p), bn: 'একটি চিহ্ন (@ # $ !)', en: 'A symbol (@ # $ !)' },
]

/** True when every rule passes. */
export function isStrongPassword(password) {
  return PASSWORD_RULES.every((rule) => rule.test(password || ''))
}
