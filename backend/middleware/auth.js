

const jwt = require("jsonwebtoken");
const pool = require("../db");

// Verify token and fetch the current user from MySQL
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      message: "লগইন করুন। Token পাওয়া যায়নি।"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.execute(
      "SELECT id, name, email, role FROM users WHERE id = ?",
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: "ব্যবহারকারী পাওয়া যায়নি।"
      });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Token ভুল অথবা মেয়াদ শেষ। আবার লগইন করুন।"
      });
    }

    console.error("Authentication error:", error.message);
    return res.status(500).json({
      message: "Authentication যাচাই করা যায়নি।"
    });
  }
}

// Allow only administrators
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      message: "এই কাজটি শুধু Admin করতে পারবেন।"
    });
  }

  next();
}

module.exports = {
  authenticateToken,
  requireAdmin
};
