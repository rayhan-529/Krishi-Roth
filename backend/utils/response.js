/**
 * Every successful API response has the same shape:
 *   { success: true, message: "...", data: ..., meta: {...} }
 * Errors (sent by middleware/errorHandler.js) look like:
 *   { success: false, message: "...", errors: {...} }
 */

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {object} [options]
 * @param {*} [options.data]
 * @param {[string, string]} [options.message] [bengali, english]
 * @param {object} [options.meta]  e.g. pagination
 * @param {number} [options.status=200]
 */
function send(req, res, { data = null, message, meta, status = 200 } = {}) {
  const body = { success: true };
  if (message) body.message = req.t(message[0], message[1]);
  body.data = data;
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

module.exports = { send };
