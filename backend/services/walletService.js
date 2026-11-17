/**
 * Wallet and Safe Trade escrow.
 *
 * Every function expects a transaction connection (services/transaction.js).
 * A wallet row is always locked (SELECT ... FOR UPDATE) before it changes,
 * and every change writes one ledger row in wallet_transactions, so the
 * balance can always be explained line by line.
 *
 * Money flow of a Safe Trade:
 *   buyer.available  --hold-->    buyer.escrow          (buyer pays)
 *   buyer.escrow     --release--> farmer.available      (buyer confirms receipt / admin / auto)
 *   buyer.escrow     --refund-->  buyer.available       (cancel / admin)
 */
const ApiError = require("../utils/ApiError");

const MONEY = (n) => Math.round(Number(n) * 100) / 100;

/** Days after the farmer starts delivery before escrow is released automatically. */
const AUTO_RELEASE_DAYS = 7;

async function lockWallet(conn, userId) {
  // Lock first; create the row only when missing. (INSERT IGNORE on an existing row takes a
  // shared lock, and two requests upgrading it at once would deadlock.)
  let [[wallet]] = await conn.query("SELECT * FROM wallets WHERE user_id = ? FOR UPDATE", [userId]);
  if (!wallet) {
    await conn.query("INSERT IGNORE INTO wallets (user_id) VALUES (?)", [userId]);
    [[wallet]] = await conn.query("SELECT * FROM wallets WHERE user_id = ? FOR UPDATE", [userId]);
  }
  return {
    user_id: wallet.user_id,
    available: MONEY(wallet.available),
    escrow: MONEY(wallet.escrow),
    pending_withdrawal: MONEY(wallet.pending_withdrawal)
  };
}

/**
 * Applies a change to one wallet and writes the ledger row.
 * @param {object} change  { available, escrow, pending } deltas (can be negative)
 * @param {object} entry   { type, amount, tradeId, depositId, withdrawalId, note, createdBy }
 */
async function apply(conn, userId, change, entry) {
  const wallet = await lockWallet(conn, userId);
  const next = {
    available: MONEY(wallet.available + (change.available || 0)),
    escrow: MONEY(wallet.escrow + (change.escrow || 0)),
    pending: MONEY(wallet.pending_withdrawal + (change.pending || 0))
  };
  if (next.available < 0) {
    throw ApiError.badRequest("ওয়ালেটে যথেষ্ট টাকা নেই।", "Not enough balance in your wallet.", {
      amount: { bn: "ওয়ালেটে যথেষ্ট টাকা নেই।", en: "Not enough balance." }
    });
  }
  if (next.escrow < 0 || next.pending < 0) {
    throw ApiError.conflict("ওয়ালেটের হিসাবে গরমিল হয়েছে। অ্যাডমিনকে জানান।", "Wallet balance mismatch. Please contact the administrator.");
  }

  await conn.query("UPDATE wallets SET available = ?, escrow = ?, pending_withdrawal = ? WHERE user_id = ?", [
    next.available,
    next.escrow,
    next.pending,
    userId
  ]);
  await conn.query(
    `INSERT INTO wallet_transactions
       (user_id, type, amount, available_after, escrow_after, trade_id, deposit_id, withdrawal_id, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId, entry.type, MONEY(entry.amount), next.available, next.escrow,
      entry.tradeId || null, entry.depositId || null, entry.withdrawalId || null,
      entry.note ? String(entry.note).slice(0, 300) : null, entry.createdBy || null
    ]
  );
  return next;
}

// ------------------------------------------------------------ deposits & withdrawals
function creditDeposit(conn, deposit, adminId) {
  return apply(conn, deposit.user_id, { available: deposit.amount }, {
    type: "deposit", amount: deposit.amount, depositId: deposit.id, createdBy: adminId,
    note: `${deposit.method} ${deposit.trx_id}`
  });
}

/** Moves money from available to "waiting for payout". */
function reserveWithdrawal(conn, withdrawal) {
  return apply(conn, withdrawal.user_id, { available: -withdrawal.amount, pending: withdrawal.amount }, {
    type: "withdrawal", amount: -withdrawal.amount, withdrawalId: withdrawal.id, createdBy: withdrawal.user_id,
    note: `${withdrawal.method} ${withdrawal.account_number}`
  });
}

/** Admin sent the money: it leaves the wallet for good (ledger already shows the withdrawal). */
async function completeWithdrawal(conn, withdrawal) {
  const wallet = await lockWallet(conn, withdrawal.user_id);
  const pending = MONEY(wallet.pending_withdrawal - withdrawal.amount);
  if (pending < 0) throw ApiError.conflict("ওয়ালেটের হিসাবে গরমিল।", "Wallet balance mismatch.");
  await conn.query("UPDATE wallets SET pending_withdrawal = ? WHERE user_id = ?", [pending, withdrawal.user_id]);
}

/** Admin rejected the payout: money goes back to available. */
function refundWithdrawal(conn, withdrawal, adminId, note) {
  return apply(conn, withdrawal.user_id, { available: withdrawal.amount, pending: -withdrawal.amount }, {
    type: "withdrawal_refund", amount: withdrawal.amount, withdrawalId: withdrawal.id, createdBy: adminId, note
  });
}

// ------------------------------------------------------------ escrow
/** Buyer pays a trade: money moves from available into escrow. */
async function holdEscrow(conn, trade, buyerId) {
  const amount = MONEY(trade.total_amount);
  await apply(conn, buyerId, { available: -amount, escrow: amount }, {
    type: "escrow_hold", amount: -amount, tradeId: trade.id, createdBy: buyerId, note: `Safe Trade #${trade.id}`
  });
  await conn.query(
    "UPDATE trade_records SET escrow_status = 'held', escrow_amount = ?, escrow_held_at = NOW() WHERE id = ?",
    [amount, trade.id]
  );
}

/** Escrow goes to the farmer (trade completed). Does nothing for trades without escrow. */
async function releaseEscrow(conn, trade, actorId, note = null) {
  if (trade.escrow_status !== "held") return false;
  const amount = MONEY(trade.escrow_amount);
  await apply(conn, trade.buyer_id, { escrow: -amount }, {
    type: "escrow_release", amount: -amount, tradeId: trade.id, createdBy: actorId,
    note: note || `Paid to farmer, Safe Trade #${trade.id}`
  });
  await apply(conn, trade.farmer_id, { available: amount }, {
    type: "escrow_receive", amount, tradeId: trade.id, createdBy: actorId, note: note || `Safe Trade #${trade.id}`
  });
  await conn.query("UPDATE trade_records SET escrow_status = 'released', escrow_settled_at = NOW() WHERE id = ?", [trade.id]);
  return true;
}

/** Escrow goes back to the buyer (trade cancelled). Does nothing for trades without escrow. */
async function refundEscrow(conn, trade, actorId, note = null) {
  if (trade.escrow_status !== "held") return false;
  const amount = MONEY(trade.escrow_amount);
  await apply(conn, trade.buyer_id, { available: amount, escrow: -amount }, {
    type: "escrow_refund", amount, tradeId: trade.id, createdBy: actorId, note: note || `Refund, Safe Trade #${trade.id}`
  });
  await conn.query("UPDATE trade_records SET escrow_status = 'refunded', escrow_settled_at = NOW() WHERE id = ?", [trade.id]);
  return true;
}

module.exports = {
  MONEY,
  AUTO_RELEASE_DAYS,
  lockWallet,
  creditDeposit,
  reserveWithdrawal,
  completeWithdrawal,
  refundWithdrawal,
  holdEscrow,
  releaseEscrow,
  refundEscrow
};
