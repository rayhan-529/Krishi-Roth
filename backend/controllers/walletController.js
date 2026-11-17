/**
 * Wallet: balance, history, "Add balance" (deposit) and "Withdraw".
 *
 * Deposits: the user sends money to the platform's bKash/Nagad/Rocket number,
 * then submits the amount and TrxID here. An admin checks the payment in the
 * platform's account and approves it; only then is the balance added.
 *
 * Withdrawals: the amount is reserved at once; an admin sends the money and
 * marks the request paid (or rejects it, which returns the money).
 */
const db = require("../config/db");
const { config } = require("../config/env");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { getPagination, paginate } = require("../utils/pagination");
const { sqlFilter } = require("../utils/sqlFilter");
const { withTransaction } = require("../services/transaction");
const wallet = require("../services/walletService");
const { notify, notifyMany } = require("../services/notificationService");
const { logActivity } = require("../services/activityService");
const { releaseDueEscrows } = require("../services/escrowService");
const { matchDeposit } = require("../services/smsPaymentService");
const smsWebhook = require("./walletSmsController");

const METHODS = ["bkash", "nagad", "rocket"];
const MAX_PENDING_DEPOSITS = 5;

const paging = { page: v.integer(), limit: v.integer() };

/**
 * bKash/Nagad use the 11-digit mobile number (01XXXXXXXXX). A Rocket account is
 * the mobile number plus one check digit (12 digits), so both lengths are accepted.
 */
const accountNumber = () =>
  v
    .string()
    .required()
    .max(20)
    .custom((value) => {
      const digits = String(value).replace(/[\s-]/g, "").replace(/^\+?88/, "");
      return /^01[3-9]\d{8,9}$/.test(digits)
        ? null
        : { bn: "সঠিক বিকাশ/নগদ/রকেট নম্বর দিন (০১ দিয়ে শুরু, ১১ বা ১২ সংখ্যা)।", en: "Enter a valid bKash/Nagad/Rocket number (starts with 01, 11 or 12 digits)." };
    });
const schemas = {
  paging,
  deposit: {
    method: v.enum(METHODS).required(),
    amount: v.number().required(),
    sender_number: accountNumber(),
    trx_id: v
      .string()
      .required()
      .max(40)
      .pattern(/^[A-Za-z0-9]{6,40}$/, { bn: "সঠিক TrxID দিন (শুধু অক্ষর ও সংখ্যা)।", en: "Enter a valid TrxID (letters and numbers only)." })
  },
  withdraw: {
    method: v.enum(METHODS).required(),
    account_number: accountNumber(),
    amount: v.number().required()
  },
  adminList: { status: v.string().max(20), q: v.string().max(100), ...paging },
  reviewDeposit: { action: v.enum(["approve", "reject"]).required(), note: v.string().max(300) },
  reviewWithdrawal: {
    action: v.enum(["paid", "reject"]).required(),
    payout_reference: v.string().max(40),
    note: v.string().max(300)
  }
};

const money = (n) => wallet.MONEY(n);

function amountError(bn, en) {
  return ApiError.badRequest(bn, en, { amount: { bn, en } });
}

/** Platform numbers that are switched on. */
function paymentNumbers() {
  return METHODS.filter((m) => config.wallet.numbers[m]).map((m) => ({ method: m, number: config.wallet.numbers[m] }));
}

// ------------------------------------------------------------ user side
async function summary(req, res) {
  await releaseDueEscrows(req.user.id);
  const w = await withTransaction((conn) => wallet.lockWallet(conn, req.user.id));
  const [[pending]] = await db.query(
    "SELECT COUNT(*) AS deposits, COALESCE(SUM(amount), 0) AS deposit_amount FROM wallet_deposits WHERE user_id = ? AND status = 'pending'",
    [req.user.id]
  );
  send(req, res, {
    data: {
      wallet: { ...w, total: money(w.available + w.escrow + w.pending_withdrawal) },
      pending_deposits: { count: Number(pending.deposits), amount: money(pending.deposit_amount) },
      payment_numbers: paymentNumbers(),
      limits: {
        min_deposit: config.wallet.minDeposit,
        max_deposit: config.wallet.maxDeposit,
        min_withdrawal: config.wallet.minWithdrawal
      },
      auto_release_days: wallet.AUTO_RELEASE_DAYS
    }
  });
}

async function transactions(req, res) {
  const { rows, meta } = await paginate(db, {
    selectSql: "SELECT id, type, amount, available_after, escrow_after, trade_id, deposit_id, withdrawal_id, note, created_at",
    fromSql: "FROM wallet_transactions WHERE user_id = ?",
    params: [req.user.id],
    orderSql: "ORDER BY id DESC",
    paging: getPagination(req.query, 15)
  });
  send(req, res, { data: rows, meta });
}

async function myDeposits(req, res) {
  const [rows] = await db.query(
    `SELECT id, method, amount, sender_number, trx_id, status, admin_note, reviewed_at, created_at
     FROM wallet_deposits WHERE user_id = ? ORDER BY id DESC LIMIT 20`,
    [req.user.id]
  );
  send(req, res, { data: rows });
}

async function myWithdrawals(req, res) {
  const [rows] = await db.query(
    `SELECT id, method, account_number, amount, status, payout_reference, admin_note, reviewed_at, created_at
     FROM wallet_withdrawals WHERE user_id = ? ORDER BY id DESC LIMIT 20`,
    [req.user.id]
  );
  send(req, res, { data: rows });
}

async function notifyAdmins(conn, payload) {
  const [admins] = await conn.query("SELECT id FROM users WHERE role = 'admin' AND is_blocked = 0");
  await notifyMany(conn, admins.map((a) => a.id), payload);
}

async function createDeposit(req, res) {
  const data = req.body;
  const amount = money(data.amount);
  if (!config.wallet.numbers[data.method]) {
    throw ApiError.badRequest("এই মাধ্যমে এখন টাকা যোগ করা যাচ্ছে না।", "This payment method is not available right now.");
  }
  if (!(amount >= config.wallet.minDeposit && amount <= config.wallet.maxDeposit)) {
    throw amountError(
      `৳${config.wallet.minDeposit} থেকে ৳${config.wallet.maxDeposit} এর মধ্যে দিন।`,
      `Enter an amount between ৳${config.wallet.minDeposit} and ৳${config.wallet.maxDeposit}.`
    );
  }
  const trxId = data.trx_id.toUpperCase();

  const { id, autoApproved } = await withTransaction(async (conn) => {
    const [[{ n }]] = await conn.query(
      "SELECT COUNT(*) AS n FROM wallet_deposits WHERE user_id = ? AND status = 'pending'",
      [req.user.id]
    );
    if (Number(n) >= MAX_PENDING_DEPOSITS) {
      throw ApiError.badRequest(
        "আগের অনুরোধগুলো যাচাই হওয়া পর্যন্ত অপেক্ষা করুন।",
        "Please wait until your earlier requests are checked."
      );
    }
    const [dupe] = await conn.query("SELECT id FROM wallet_deposits WHERE method = ? AND trx_id = ?", [data.method, trxId]);
    if (dupe.length > 0) {
      const message = { bn: "এই TrxID আগেই জমা দেওয়া হয়েছে।", en: "This TrxID has already been submitted." };
      throw new ApiError(409, message.bn, message.en, { trx_id: message });
    }
    const [result] = await conn.query(
      "INSERT INTO wallet_deposits (user_id, method, amount, sender_number, trx_id) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, data.method, amount, data.sender_number, trxId]
    );
    // If the payment SMS has already arrived, approve at once.
    const autoApproved = await matchDeposit(conn, result.insertId);
    if (!autoApproved) {
      await notifyAdmins(conn, {
        type: "announcement",
        title: ["নতুন ব্যালেন্স যোগের অনুরোধ", "New add-balance request"],
        body: [`৳${amount} · ${data.method} · ${trxId}`, `৳${amount} · ${data.method} · ${trxId}`],
        link: "/admin/wallet"
      });
    }
    return { id: result.insertId, autoApproved };
  });

  await logActivity(req, "wallet.deposit_request", "wallet_deposit", id, `${amount}`);
  send(req, res, {
    status: 201,
    message: autoApproved
      ? [`পেমেন্ট যাচাই হয়েছে, ৳${amount} ওয়ালেটে যোগ হয়েছে।`, `Payment verified, ৳${amount} was added to your wallet.`]
      : ["অনুরোধ জমা হয়েছে। পেমেন্ট যাচাই হলেই ব্যালেন্স যোগ হবে।", "Request submitted. Your balance is added as soon as the payment is verified."],
    data: { id, auto_approved: autoApproved }
  });
}

async function createWithdrawal(req, res) {
  const data = req.body;
  const amount = money(data.amount);
  if (!(amount >= config.wallet.minWithdrawal)) {
    throw amountError(`কমপক্ষে ৳${config.wallet.minWithdrawal} তুলতে পারবেন।`, `The minimum withdrawal is ৳${config.wallet.minWithdrawal}.`);
  }

  const id = await withTransaction(async (conn) => {
    const [result] = await conn.query(
      "INSERT INTO wallet_withdrawals (user_id, method, account_number, amount) VALUES (?, ?, ?, ?)",
      [req.user.id, data.method, data.account_number, amount]
    );
    await wallet.reserveWithdrawal(conn, { id: result.insertId, user_id: req.user.id, method: data.method, account_number: data.account_number, amount });
    await notifyAdmins(conn, {
      type: "announcement",
      title: ["নতুন টাকা তোলার অনুরোধ", "New withdrawal request"],
      body: [`৳${amount} · ${data.method} ${data.account_number}`, `৳${amount} · ${data.method} ${data.account_number}`],
      link: "/admin/wallet"
    });
    return result.insertId;
  });

  await logActivity(req, "wallet.withdraw_request", "wallet_withdrawal", id, `${amount}`);
  send(req, res, {
    status: 201,
    message: ["অনুরোধ জমা হয়েছে। অ্যাডমিন টাকা পাঠালে জানানো হবে।", "Request submitted. You will be notified when the money is sent."],
    data: { id }
  });
}

// ------------------------------------------------------------ admin side
async function adminSummary(req, res) {
  const [[totals]] = await db.query(
    `SELECT COALESCE(SUM(available), 0) AS available, COALESCE(SUM(escrow), 0) AS escrow,
            COALESCE(SUM(pending_withdrawal), 0) AS pending_withdrawal FROM wallets`
  );
  const [[queue]] = await db.query(
    `SELECT (SELECT COUNT(*) FROM wallet_deposits WHERE status = 'pending') AS pending_deposits,
            (SELECT COUNT(*) FROM wallet_withdrawals WHERE status = 'pending') AS pending_withdrawals`
  );
  send(req, res, {
    data: {
      totals: {
        available: money(totals.available),
        escrow: money(totals.escrow),
        pending_withdrawal: money(totals.pending_withdrawal),
        // Money users have put in that the platform must hold in its accounts.
        held_for_users: money(Number(totals.available) + Number(totals.escrow) + Number(totals.pending_withdrawal))
      },
      queue: { deposits: Number(queue.pending_deposits), withdrawals: Number(queue.pending_withdrawals) },
      payment_numbers: paymentNumbers(),
      sms: await smsWebhook.status()
    }
  });
}

function adminListOf(table, extraColumns) {
  return async function list(req, res) {
    const filter = sqlFilter();
    if (req.q.status) filter.add("x.status = ?", req.q.status);
    if (req.q.q) {
      const like = `%${req.q.q}%`;
      filter.add("(u.name LIKE ? OR u.phone LIKE ? OR u.email LIKE ? OR x.id = ?)", like, like, like, Number(req.q.q) || 0);
    }
    const { rows, meta } = await paginate(db, {
      selectSql: `SELECT x.id, x.user_id, x.method, x.amount, x.status, x.admin_note, x.reviewed_at, x.created_at, ${extraColumns},
                         u.name AS user_name, u.phone AS user_phone, u.role AS user_role, r.name AS reviewed_by_name`,
      fromSql: `FROM ${table} x JOIN users u ON u.id = x.user_id LEFT JOIN users r ON r.id = x.reviewed_by ${filter.where}`,
      params: filter.params,
      orderSql: "ORDER BY (x.status = 'pending') DESC, x.id DESC",
      paging: getPagination(req.query, 20)
    });
    send(req, res, { data: rows, meta });
  };
}

const adminDeposits = adminListOf("wallet_deposits", "x.sender_number, x.trx_id");
const adminWithdrawals = adminListOf("wallet_withdrawals", "x.account_number, x.payout_reference");

function alreadyHandled() {
  return ApiError.conflict("এই অনুরোধের সিদ্ধান্ত আগেই নেওয়া হয়েছে।", "This request has already been handled.");
}

async function reviewDeposit(req, res) {
  const { action, note } = req.body;
  if (action === "reject" && !note) {
    throw ApiError.badRequest("বাতিলের কারণ লিখুন।", "Write the reason for rejecting.", { note: { bn: "কারণ লিখুন।", en: "Write a reason." } });
  }

  await withTransaction(async (conn) => {
    const [[deposit]] = await conn.query("SELECT * FROM wallet_deposits WHERE id = ? FOR UPDATE", [req.params.id]);
    if (!deposit) throw ApiError.notFound();
    if (deposit.status !== "pending") throw alreadyHandled();

    await conn.query(
      "UPDATE wallet_deposits SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
      [action === "approve" ? "approved" : "rejected", note, req.user.id, deposit.id]
    );
    if (action === "approve") await wallet.creditDeposit(conn, deposit, req.user.id);

    await notify(conn, deposit.user_id, {
      type: "announcement",
      title: action === "approve"
        ? [`৳${money(deposit.amount)} আপনার ওয়ালেটে যোগ হয়েছে`, `৳${money(deposit.amount)} was added to your wallet`]
        : ["ব্যালেন্স যোগের অনুরোধ বাতিল হয়েছে", "Your add-balance request was rejected"],
      body: action === "approve" ? null : [note, note],
      link: "/wallet"
    });
  });

  await logActivity(req, `admin.deposit_${action}`, "wallet_deposit", req.params.id, note);
  send(req, res, { message: ["সিদ্ধান্ত সংরক্ষণ হয়েছে।", "Decision saved."] });
}

async function reviewWithdrawal(req, res) {
  const { action, note, payout_reference: reference } = req.body;
  if (action === "paid" && !reference) {
    const message = { bn: "যে TrxID দিয়ে টাকা পাঠিয়েছেন তা লিখুন।", en: "Enter the TrxID of the payment you sent." };
    throw ApiError.badRequest(message.bn, message.en, { payout_reference: message });
  }
  if (action === "reject" && !note) {
    throw ApiError.badRequest("বাতিলের কারণ লিখুন।", "Write the reason for rejecting.", { note: { bn: "কারণ লিখুন।", en: "Write a reason." } });
  }

  await withTransaction(async (conn) => {
    const [[withdrawal]] = await conn.query("SELECT * FROM wallet_withdrawals WHERE id = ? FOR UPDATE", [req.params.id]);
    if (!withdrawal) throw ApiError.notFound();
    if (withdrawal.status !== "pending") throw alreadyHandled();

    await conn.query(
      "UPDATE wallet_withdrawals SET status = ?, payout_reference = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
      [action === "paid" ? "paid" : "rejected", reference || null, note, req.user.id, withdrawal.id]
    );
    if (action === "paid") await wallet.completeWithdrawal(conn, withdrawal);
    else await wallet.refundWithdrawal(conn, withdrawal, req.user.id, note);

    await notify(conn, withdrawal.user_id, {
      type: "announcement",
      title: action === "paid"
        ? [`৳${money(withdrawal.amount)} আপনার ${withdrawal.method}-এ পাঠানো হয়েছে`, `৳${money(withdrawal.amount)} was sent to your ${withdrawal.method}`]
        : ["টাকা তোলার অনুরোধ বাতিল হয়েছে, টাকা ওয়ালেটে ফেরত", "Withdrawal rejected, money returned to your wallet"],
      body: action === "paid" ? [`TrxID: ${reference}`, `TrxID: ${reference}`] : [note, note],
      link: "/wallet"
    });
  });

  await logActivity(req, `admin.withdrawal_${action}`, "wallet_withdrawal", req.params.id, note || reference);
  send(req, res, { message: ["সিদ্ধান্ত সংরক্ষণ হয়েছে।", "Decision saved."] });
}

module.exports = {
  schemas,
  summary,
  transactions,
  myDeposits,
  myWithdrawals,
  createDeposit,
  createWithdrawal,
  adminSummary,
  adminDeposits,
  adminWithdrawals,
  reviewDeposit,
  reviewWithdrawal
};
