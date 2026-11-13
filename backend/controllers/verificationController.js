/**
 * Account verification.
 *   User:  send a verification request with an identity document
 *   Admin: list requests, open the document privately, approve or reject
 *
 * The document is kept inside the database and is only ever sent to an
 * admin through an authenticated request. It is never public.
 */
const fs = require("fs");
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { getPagination, paginate } = require("../utils/pagination");
const { sqlFilter } = require("../utils/sqlFilter");
const { withTransaction } = require("../services/transaction");
const { notify } = require("../services/notificationService");
const { logActivity } = require("../services/activityService");

const DOCUMENT_TYPES = ["nid", "birth_certificate", "trade_license", "driving_license", "vehicle_registration", "other"];

const schemas = {
  create: {
    document_type: v.enum(DOCUMENT_TYPES).required(),
    document_number_last4: v.string().pattern(/^[0-9A-Za-z]{4}$/, {
      bn: "নম্বরের শেষ ৪টি অক্ষর/সংখ্যা দিন।",
      en: "Enter the last 4 characters of the number."
    }),
    note: v.string().max(500)
  },
  review: {
    status: v.enum(["approved", "rejected"]).required(),
    admin_note: v.string().max(500)
  },
  adminList: {
    status: v.enum(["pending", "approved", "rejected"]),
    q: v.string().max(100),
    page: v.integer(),
    limit: v.integer()
  }
};

const SAFE_COLUMNS = `uv.id, uv.user_id, uv.document_type, uv.document_number_last4, uv.document_name,
  uv.document_mime, uv.document_size, uv.note, uv.status, uv.admin_note, uv.reviewed_at, uv.created_at`;

async function create(req, res) {
  if (!req.file) {
    const message = { bn: "একটি ডকুমেন্ট (ছবি বা PDF) বেছে নিন।", en: "Choose a document (image or PDF)." };
    throw ApiError.badRequest(message.bn, message.en, { document: message });
  }

  if (req.user.verification_status === "verified") {
    throw ApiError.badRequest("আপনার অ্যাকাউন্ট আগেই যাচাই করা হয়েছে।", "Your account is already verified.");
  }

  const [pending] = await db.query(
    "SELECT id FROM user_verifications WHERE user_id = ? AND status = 'pending' LIMIT 1",
    [req.user.id]
  );
  if (pending.length > 0) {
    throw ApiError.conflict(
      "আপনার একটি আবেদন যাচাইয়ের অপেক্ষায় আছে।",
      "You already have a verification request waiting for review."
    );
  }

  const data = req.body;
  const buffer = await fs.promises.readFile(req.file.path);
  fs.promises.unlink(req.file.path).catch(() => {});

  const id = await withTransaction(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO user_verifications
         (user_id, document_type, document_number_last4, document_name, document_mime, document_size, document_data, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        data.document_type,
        data.document_number_last4,
        String(req.file.originalname || "document").slice(0, 150),
        req.file.mimetype,
        buffer.length,
        buffer,
        data.note
      ]
    );
    await conn.query("UPDATE users SET verification_status = 'pending' WHERE id = ?", [req.user.id]);

    const [admins] = await conn.query("SELECT id FROM users WHERE role = 'admin' AND is_blocked = 0");
    for (const admin of admins) {
      await notify(conn, admin.id, {
        type: "verification",
        title: ["নতুন যাচাই আবেদন", "New verification request"],
        body: [`${req.user.name} যাচাইয়ের আবেদন করেছেন।`, `${req.user.name} requested verification.`],
        link: "/admin/verifications",
        entityType: "verification",
        entityId: result.insertId
      });
    }
    return result.insertId;
  });

  await logActivity(req, "verification.request", "verification", id);
  const [rows] = await db.query(`SELECT ${SAFE_COLUMNS} FROM user_verifications uv WHERE uv.id = ?`, [id]);
  send(req, res, {
    status: 201,
    message: ["যাচাইয়ের আবেদন পাঠানো হয়েছে।", "Verification request sent."],
    data: rows[0]
  });
}

async function mine(req, res) {
  const [rows] = await db.query(
    `SELECT ${SAFE_COLUMNS} FROM user_verifications uv WHERE uv.user_id = ? ORDER BY uv.created_at DESC`,
    [req.user.id]
  );
  send(req, res, { data: rows });
}

async function adminList(req, res) {
  const filter = sqlFilter();
  if (req.q.status) filter.add("uv.status = ?", req.q.status);
  filter.search(req.q.q, ["u.name", "u.phone", "u.email"]);

  const { rows, meta } = await paginate(db, {
    selectSql: `SELECT ${SAFE_COLUMNS}, u.name AS user_name, u.phone AS user_phone, u.email AS user_email,
                       u.role AS user_role, u.verification_status AS user_verification, r.name AS reviewer_name`,
    fromSql: `FROM user_verifications uv JOIN users u ON u.id = uv.user_id
              LEFT JOIN users r ON r.id = uv.reviewed_by ${filter.where}`,
    params: filter.params,
    orderSql: "ORDER BY FIELD(uv.status, 'pending') DESC, uv.created_at DESC",
    paging: getPagination(req.query, 20)
  });
  send(req, res, { data: rows, meta });
}

/** Streams the private document to an admin. */
async function document(req, res) {
  const [rows] = await db.query(
    "SELECT document_name, document_mime, document_data FROM user_verifications WHERE id = ?",
    [req.params.id]
  );
  const doc = rows[0];
  if (!doc) throw ApiError.notFound();

  await logActivity(req, "verification.view_document", "verification", req.params.id);
  res.set({
    "Content-Type": doc.document_mime,
    "Content-Disposition": `inline; filename="verification-${req.params.id}${doc.document_mime === "application/pdf" ? ".pdf" : ""}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.send(doc.document_data);
}

async function review(req, res) {
  const { status, admin_note: note } = req.body;

  if (status === "rejected" && !note) {
    const message = { bn: "বাতিলের কারণ লিখুন।", en: "Write the reason for rejection." };
    throw ApiError.badRequest(message.bn, message.en, { admin_note: message });
  }

  await withTransaction(async (conn) => {
    const [rows] = await conn.query("SELECT id, user_id, status FROM user_verifications WHERE id = ? FOR UPDATE", [
      req.params.id
    ]);
    const request = rows[0];
    if (!request) throw ApiError.notFound();
    if (request.status !== "pending") {
      throw ApiError.badRequest("এই আবেদনের সিদ্ধান্ত আগেই দেওয়া হয়েছে।", "This request has already been reviewed.");
    }

    await conn.query(
      "UPDATE user_verifications SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
      [status, note, req.user.id, request.id]
    );
    await conn.query("UPDATE users SET verification_status = ? WHERE id = ?", [
      status === "approved" ? "verified" : "rejected",
      request.user_id
    ]);

    await notify(conn, request.user_id, {
      type: "verification",
      title:
        status === "approved"
          ? ["আপনার অ্যাকাউন্ট যাচাই করা হয়েছে ✓", "Your account is verified ✓"]
          : ["আপনার যাচাই আবেদন গ্রহণ করা হয়নি", "Your verification request was rejected"],
      body: note ? [note, note] : null,
      link: "/profile",
      entityType: "verification",
      entityId: request.id
    });
  });

  await logActivity(req, `verification.${status}`, "verification", req.params.id);
  send(req, res, {
    message: status === "approved" ? ["অ্যাকাউন্ট যাচাই করা হয়েছে।", "Account verified."] : ["আবেদন বাতিল করা হয়েছে।", "Request rejected."]
  });
}

module.exports = { schemas, create, mine, adminList, document, review, DOCUMENT_TYPES };
