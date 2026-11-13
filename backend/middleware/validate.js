/**
 * Validation middleware built on utils/validator.js.
 *
 *   router.post("/", validateBody(schema), controller.create);
 *     -> req.body is replaced by the cleaned values (unknown keys removed)
 *
 *   router.get("/", validateQuery(schema), controller.list);
 *     -> cleaned query values are available as req.q
 */
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");

function fail(errors) {
  return ApiError.badRequest(
    "ফর্মের কিছু তথ্য ঠিক নেই। লাল চিহ্নিত ঘরগুলো দেখুন।",
    "Some information is not correct. Please check the highlighted fields.",
    errors
  );
}

function validateBody(schema, options) {
  return (req, res, next) => {
    const { value, errors } = v.validate(schema, req.body || {}, options);
    if (errors) throw fail(errors);
    req.body = value;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const { value, errors } = v.validate(schema, req.query || {});
    if (errors) throw fail(errors);
    req.q = value;
    next();
  };
}

/** Validates :id style route parameters as positive integers. */
function validateId(...names) {
  const params = names.length ? names : ["id"];
  return (req, res, next) => {
    for (const name of params) {
      const n = Number(req.params[name]);
      if (!Number.isInteger(n) || n < 1) throw ApiError.notFound();
      req.params[name] = n;
    }
    next();
  };
}

module.exports = { validateBody, validateQuery, validateId };
