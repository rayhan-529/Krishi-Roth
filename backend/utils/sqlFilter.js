/**
 * Builds a WHERE clause step by step, keeping values as "?" parameters.
 *
 *   const filter = sqlFilter("b.status <> 'cancelled'");
 *   if (q.district_id) filter.add("b.district_id = ?", q.district_id);
 *   db.query(`SELECT ... FROM bookings b ${filter.where}`, filter.params);
 */
function sqlFilter(...baseClauses) {
  const clauses = [...baseClauses];
  const params = [];

  return {
    add(clause, ...values) {
      clauses.push(clause);
      params.push(...values);
      return this;
    },
    /** Adds "(a LIKE ? OR b LIKE ?)" for a search text over several columns. */
    search(text, columns) {
      if (!text) return this;
      clauses.push(`(${columns.map((c) => `${c} LIKE ?`).join(" OR ")})`);
      params.push(...columns.map(() => `%${text}%`));
      return this;
    },
    get where() {
      return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    },
    params
  };
}

module.exports = { sqlFilter };
