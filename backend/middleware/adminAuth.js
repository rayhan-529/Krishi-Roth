
const jwt = require("jsonwebtoken");
const db = require("../config/db");

// Verify JWT and fetch the current user role from MySQL
async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Login required"
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = decoded.id ?? decoded.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Invalid token payload"
      });
    }

    const [rows] = await db.execute(
      "SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: "User not found"
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
        message: "Invalid or expired token"
      });
    }

    console.error("Authentication error:", error.message);
    return res.status(500).json({
      message: "Authentication failed"
    });
  }
}

// Only admins can access protected admin endpoints
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      message: "Access denied. Admin only."
    });
  }

  next();
}

module.exports = { verifyToken, requireAdmin };
