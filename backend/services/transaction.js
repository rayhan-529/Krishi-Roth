/**
 * Runs several queries as one all-or-nothing database transaction.
 *
 *   const result = await withTransaction(async (conn) => {
 *     await conn.query("UPDATE ...", [...]);
 *     await conn.query("INSERT ...", [...]);
 *     return something;
 *   });
 *
 * If anything throws, every change is rolled back.
 *
 * Work that must only happen once the data is really saved (for example
 * pushing a live notification) can be queued with conn.afterCommit(fn).
 * It runs after COMMIT and is dropped on ROLLBACK.
 */
const db = require("../config/db");

async function withTransaction(work) {
  const conn = await db.getConnection();
  const pending = [];
  conn.afterCommit = (fn) => pending.push(fn);
  let result;
  try {
    await conn.beginTransaction();
    result = await work(conn);
    await conn.commit();
  } catch (error) {
    await conn.rollback().catch(() => {});
    throw error;
  } finally {
    delete conn.afterCommit;
    conn.release();
  }
  for (const fn of pending) {
    Promise.resolve()
      .then(fn)
      .catch((error) => console.error("afterCommit task failed:", error.message));
  }
  return result;
}

module.exports = { withTransaction };
