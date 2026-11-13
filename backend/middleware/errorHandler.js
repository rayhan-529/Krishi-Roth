/**
 * 404 handler and the ONE place where errors become HTTP responses.
 * Internal details (SQL, stack traces) are logged on the server but never
 * sent to the browser.
 */
const ApiError = require("../utils/ApiError");
const { removeUploadedFiles, MAX_BYTES } = require("./upload");

function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: req.t("এই ঠিকানায় কোনো API নেই।", "API route not found.")
  });
}

function translateErrors(req, errors) {
  if (!errors) return undefined;
  return Object.fromEntries(
    Object.entries(errors).map(([field, message]) => [field, req.t(message.bn, message.en)])
  );
}

// Express recognises an error handler by its 4 arguments.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  removeUploadedFiles(req);
  const t = req.t || ((bn) => bn);

  let error = err;

  if (!(error instanceof ApiError)) {
    if (err.name === "MulterError") {
      const mb = Math.round(MAX_BYTES / 1024 / 1024);
      error =
        err.code === "LIMIT_FILE_SIZE"
          ? ApiError.badRequest(`ফাইল ${mb} MB-এর বেশি বড়।`, `File is larger than ${mb} MB.`)
          : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
            ? ApiError.badRequest("অনেক বেশি ফাইল দেওয়া হয়েছে।", "Too many files.")
            : ApiError.badRequest("ফাইল আপলোড করা যায়নি।", "File upload failed.");
    } else if (err.type === "entity.parse.failed") {
      error = ApiError.badRequest("অনুরোধের তথ্য পড়া যায়নি।", "Invalid request data.");
    } else if (err.type === "entity.too.large") {
      error = new ApiError(413, "অনুরোধটি অনেক বড়।", "Request is too large.");
    } else if (err.code === "ER_DUP_ENTRY") {
      error = ApiError.conflict("এই তথ্যটি আগে থেকেই আছে।", "This record already exists.");
    } else if (err.code === "ER_ROW_IS_REFERENCED_2" || err.code === "ER_ROW_IS_REFERENCED") {
      error = ApiError.conflict(
        "অন্য তথ্যের সঙ্গে যুক্ত থাকায় এটি মুছে ফেলা যাবে না।",
        "This cannot be deleted because other records use it."
      );
    } else if (err.code === "ER_NO_REFERENCED_ROW_2" || err.code === "ER_NO_REFERENCED_ROW") {
      error = ApiError.badRequest("নির্বাচিত তথ্যটি সঠিক নয়।", "A selected item does not exist.");
    } else if (err.code === "ER_CHECK_CONSTRAINT_VIOLATED" || err.errno === 3819 || err.errno === 4025) {
      error = ApiError.badRequest("দেওয়া মানগুলো সঠিক নয়।", "Some values are not allowed.");
    } else if (["ECONNREFUSED", "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR", "PROTOCOL_CONNECTION_LOST"].includes(err.code)) {
      console.error("Database unavailable:", err.code);
      error = ApiError.unavailable(
        "ডাটাবেসের সঙ্গে সংযোগ করা যাচ্ছে না। কিছুক্ষণ পর চেষ্টা করুন।",
        "The database is not reachable. Please try again shortly."
      );
    } else {
      console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}\n`, err);
      error = new ApiError(500, "সার্ভারে একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।", "Something went wrong on the server. Please try again.");
    }
  }

  const body = { success: false, message: t(error.messages.bn, error.messages.en) };
  const fieldErrors = translateErrors(req.t ? req : { t }, error.errors);
  if (fieldErrors) body.errors = fieldErrors;

  res.status(error.status || 500).json(body);
}

module.exports = { notFound, errorHandler };
