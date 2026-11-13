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
 */
const db = require("../config/db");

async function withTransaction(work) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback().catch(() => {});
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = { withTransaction };
