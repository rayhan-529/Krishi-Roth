
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/adminAuth');

// সব Admin API-তে Token এবং Admin Role যাচাই
router.use(verifyToken, requireAdmin);

// GET /api/admin/me
router.get('/me', (req, res) => {
  res.json({
    message: 'Admin verified successfully',
    user: {
      id: req.user.id,
      role: req.user.role,
      name: req.user.name,
    },
  });
});

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        COUNT(*) AS totalUsers,
        SUM(CASE WHEN role = 'farmer' THEN 1 ELSE 0 END) AS totalFarmers,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS totalAdmins
      FROM users
    `);

    res.json({
      totalUsers: Number(rows[0].totalUsers || 0),
      totalFarmers: Number(rows[0].totalFarmers || 0),
      totalAdmins: Number(rows[0].totalAdmins || 0),
    });
  } catch (error) {
    console.error('Admin stats error:', error.message);
    res.status(500).json({ message: 'Dashboard statistics load failed' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT id, name, email, role
      FROM users
      ORDER BY id DESC
    `);

    res.json({ users });
  } catch (error) {
    console.error('Admin users error:', error.message);
    res.status(500).json({ message: 'Users could not be loaded' });
  }
});

module.exports = router;
