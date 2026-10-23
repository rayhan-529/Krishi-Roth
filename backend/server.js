
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require('./routes/adminRoutes');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/admin', adminRoutes);

// Home route
app.get("/", (req, res) => {
  res.json({
    message: "Krishi Roth API is running"
  });
});

// MySQL connection health check
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      message: "Krishi Roth API is running",
      database: "MySQL connected"
    });
  } catch (error) {
    console.error("MySQL connection error:", error.message);

    res.status(500).json({
      message: "MySQL connection failed"
    });
  }
});

// Authentication routes
app.use("/api/auth", authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found"
  });
});




// Add after express.json() and other middleware
app.use("/api/admin", adminRoutes);


// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);

  res.status(500).json({
    message: "Internal server error"
  });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Krishi Roth API running at http://localhost:${PORT}`);
});
