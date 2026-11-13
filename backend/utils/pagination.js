/**
 * Reads ?page=&limit= from the query string safely.
 * @returns {{ page: number, limit: number, offset: number }}
 */
function getPagination(query, defaultLimit = 12, maxLimit = 50) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

/** Builds the meta object sent with a paginated list. */
function pageMeta({ page, limit }, total) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/**
 * Runs a paginated list query.
 * @param {object} db         the mysql2 pool or connection
 * @param {string} fromSql    "FROM ... WHERE ..." part (with ? placeholders)
 * @param {Array}  params     values for the placeholders in fromSql
 * @param {string} selectSql  "SELECT ..." part
 * @param {string} orderSql   "ORDER BY ..." part (must not contain user input)
 * @param {object} paging     result of getPagination()
 */
async function paginate(db, { selectSql, fromSql, params = [], orderSql = "", paging }) {
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${fromSql}`, params);
  const [rows] = await db.query(`${selectSql} ${fromSql} ${orderSql} LIMIT ? OFFSET ?`, [
    ...params,
    paging.limit,
    paging.offset
  ]);
  return { rows, meta: pageMeta(paging, Number(total)) };
}

module.exports = { getPagination, pageMeta, paginate };
