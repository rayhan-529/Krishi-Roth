/**
 * An error with an HTTP status and a message in Bengali and English.
 * Throw it from any controller; the central error handler sends it.
 *
 *   throw ApiError.notFound("ফসলটি পাওয়া যায়নি।", "Listing not found.");
 */
class ApiError extends Error {
  /**
   * @param {number} status   HTTP status code
   * @param {string} bn       message in Bengali
   * @param {string} en       message in English
   * @param {object} [errors] field errors, e.g. { phone: {bn, en} }
   */
  constructor(status, bn, en, errors) {
    super(en || bn);
    this.status = status;
    this.messages = { bn, en: en || bn };
    this.errors = errors;
  }

  static badRequest(bn, en, errors) {
    return new ApiError(400, bn, en, errors);
  }

  static unauthorized(bn = "অনুগ্রহ করে লগইন করুন।", en = "Please log in.") {
    return new ApiError(401, bn, en);
  }

  static forbidden(bn = "এই কাজের অনুমতি আপনার নেই।", en = "You do not have permission to do this.") {
    return new ApiError(403, bn, en);
  }

  static notFound(bn = "তথ্যটি পাওয়া যায়নি।", en = "Not found.") {
    return new ApiError(404, bn, en);
  }

  static conflict(bn, en) {
    return new ApiError(409, bn, en);
  }

  static unavailable(bn, en) {
    return new ApiError(503, bn, en);
  }
}

module.exports = ApiError;
