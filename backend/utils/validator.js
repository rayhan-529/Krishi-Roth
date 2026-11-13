/**
 * A small, dependency-free request validator.
 *
 * Example:
 *   const v = require("../utils/validator");
 *   const schema = {
 *     name:     v.string().required().min(2).max(100),
 *     phone:    v.phone().required(),
 *     quantity: v.number().required().min(0.01),
 *     unit:     v.enum(["kg", "maund"]).required(),
 *     note:     v.string().max(500)            // optional -> null when empty
 *   };
 *   const { value, errors } = v.validate(schema, req.body);
 *
 * Only keys listed in the schema are kept, so a user can never sneak in
 * extra columns such as "role" or "is_blocked" (mass-assignment protection).
 * Bengali digits (০-৯) are accepted anywhere a number is expected.
 */

const MSG = {
  required: { bn: "এই ঘরটি পূরণ করুন।", en: "This field is required." },
  string: { bn: "সঠিক লেখা দিন।", en: "Enter valid text." },
  number: { bn: "সঠিক সংখ্যা দিন।", en: "Enter a valid number." },
  integer: { bn: "পূর্ণ সংখ্যা দিন।", en: "Enter a whole number." },
  boolean: { bn: "হ্যাঁ অথবা না বেছে নিন।", en: "Choose yes or no." },
  date: { bn: "সঠিক তারিখ দিন।", en: "Enter a valid date." },
  email: { bn: "সঠিক ইমেইল ঠিকানা দিন।", en: "Enter a valid email address." },
  phone: {
    bn: "সঠিক মোবাইল নম্বর দিন (যেমন 01712345678)।",
    en: "Enter a valid mobile number (e.g. 01712345678)."
  },
  enum: { bn: "তালিকা থেকে একটি বেছে নিন।", en: "Choose an option from the list." },
  array: { bn: "সঠিক তালিকা দিন।", en: "Enter a valid list." },
  minLength: (n) => ({ bn: `কমপক্ষে ${n} অক্ষর লিখুন।`, en: `Enter at least ${n} characters.` }),
  maxLength: (n) => ({ bn: `${n} অক্ষরের বেশি লেখা যাবে না।`, en: `Use at most ${n} characters.` }),
  minValue: (n) => ({ bn: `মান ${n} বা তার বেশি হতে হবে।`, en: `Must be ${n} or more.` }),
  maxValue: (n) => ({ bn: `মান ${n} বা তার কম হতে হবে।`, en: `Must be ${n} or less.` }),
  minItems: (n) => ({ bn: `কমপক্ষে ${n}টি দিন।`, en: `Add at least ${n}.` }),
  maxItems: (n) => ({ bn: `সর্বোচ্চ ${n}টি দেওয়া যাবে।`, en: `At most ${n} allowed.` })
};

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Converts Bengali digits to English digits: "১২৫" -> "125". */
function toEnglishDigits(text) {
  return String(text).replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

function isEmpty(value) {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

class Rule {
  constructor(type, parse) {
    this.type = type;
    this.parse = parse; // (raw) => { value } | { error }
    this.isRequired = false;
    this.defaultValue = null;
    this.checks = [];
  }

  required() {
    this.isRequired = true;
    return this;
  }

  /** Value used when the field is empty (default is null). */
  default(value) {
    this.defaultValue = value;
    return this;
  }

  min(n) {
    this.checks.push((value) => {
      if (this.type === "string" && value.length < n) return MSG.minLength(n);
      if (this.type === "array" && value.length < n) return MSG.minItems(n);
      if ((this.type === "number" || this.type === "integer") && value < n) return MSG.minValue(n);
      return null;
    });
    return this;
  }

  max(n) {
    this.checks.push((value) => {
      if (this.type === "string" && value.length > n) return MSG.maxLength(n);
      if (this.type === "array" && value.length > n) return MSG.maxItems(n);
      if ((this.type === "number" || this.type === "integer") && value > n) return MSG.maxValue(n);
      return null;
    });
    return this;
  }

  /** Regular-expression check with a custom {bn, en} message. */
  pattern(regex, message) {
    this.checks.push((value) => (regex.test(value) ? null : message));
    return this;
  }

  /** Any extra check: fn(value) returns {bn, en} on failure or null. */
  custom(fn) {
    this.checks.push(fn);
    return this;
  }

  run(raw) {
    if (isEmpty(raw)) {
      return this.isRequired ? { error: MSG.required } : { value: this.defaultValue };
    }
    const parsed = this.parse(raw);
    if (parsed.error) return parsed;
    for (const check of this.checks) {
      const error = check(parsed.value);
      if (error) return { error };
    }
    return parsed;
  }
}

const v = {
  string() {
    return new Rule("string", (raw) =>
      typeof raw === "string" || typeof raw === "number"
        ? { value: String(raw).trim() }
        : { error: MSG.string }
    );
  },

  number() {
    return new Rule("number", (raw) => {
      const n = Number(toEnglishDigits(raw));
      return Number.isFinite(n) ? { value: n } : { error: MSG.number };
    });
  },

  integer() {
    return new Rule("integer", (raw) => {
      const n = Number(toEnglishDigits(raw));
      return Number.isInteger(n) ? { value: n } : { error: MSG.integer };
    });
  },

  /** Positive database id. */
  id() {
    return v.integer().min(1);
  },

  boolean() {
    return new Rule("boolean", (raw) => {
      if ([true, 1, "1", "true", "on", "yes"].includes(raw)) return { value: true };
      if ([false, 0, "0", "false", "off", "no"].includes(raw)) return { value: false };
      return { error: MSG.boolean };
    });
  },

  /** Date in YYYY-MM-DD format. */
  date() {
    return new Rule("date", (raw) => {
      const text = toEnglishDigits(raw).trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { error: MSG.date };
      const date = new Date(`${text}T00:00:00Z`);
      return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text
        ? { error: MSG.date }
        : { value: text };
    });
  },

  email() {
    return new Rule("string", (raw) => {
      const text = String(raw).trim().toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text) && text.length <= 150
        ? { value: text }
        : { error: MSG.email };
    });
  },

  /** Bangladeshi mobile number. Accepts +8801..., 8801..., 01... with spaces/dashes. */
  phone() {
    return new Rule("string", (raw) => {
      let text = toEnglishDigits(raw).replace(/[\s-]/g, "");
      if (text.startsWith("+880")) text = text.slice(3);
      else if (text.startsWith("880")) text = text.slice(2);
      return /^01[3-9]\d{8}$/.test(text) ? { value: text } : { error: MSG.phone };
    });
  },

  enum(options) {
    return new Rule("enum", (raw) => {
      const text = String(raw).trim();
      return options.includes(text) ? { value: text } : { error: MSG.enum };
    });
  },

  /** Array of values checked by another rule, e.g. v.array(v.id()). */
  array(itemRule) {
    return new Rule("array", (raw) => {
      let list = raw;
      if (typeof raw === "string") {
        try {
          list = JSON.parse(raw);
        } catch {
          list = raw.split(",");
        }
      }
      if (!Array.isArray(list)) return { error: MSG.array };
      const values = [];
      for (const item of list) {
        const result = itemRule.run(item);
        if (result.error) return { error: result.error };
        values.push(result.value);
      }
      return { value: values };
    });
  },

  /**
   * Validates input against a schema.
   * @param {object} schema
   * @param {object} input
   * @param {{ partial?: boolean }} [options] partial: skip fields that were not sent
   * @returns {{ value: object, errors: object|null }}
   */
  validate(schema, input = {}, { partial = false } = {}) {
    const value = {};
    const errors = {};

    for (const [key, rule] of Object.entries(schema)) {
      if (partial && input[key] === undefined) continue;
      const result = rule.run(input[key]);
      if (result.error) errors[key] = result.error;
      else value[key] = result.value;
    }

    return { value, errors: Object.keys(errors).length ? errors : null };
  },

  toEnglishDigits
};

module.exports = v;
