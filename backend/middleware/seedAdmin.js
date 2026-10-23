
require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("../db");

async function createAdmin() {
  try {
    const name = process.env.ADMIN_NAME;
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!name || !email || !password || password.length < 12) {
      throw new Error(
        "Set ADMIN_NAME, ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters in .env"
      );
    }

    const [existing] = await pool.execute(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    const hashedPassword = await bcrypt.hash(password, 12);

    if (existing.length > 0) {
      await pool.execute(
        "UPDATE users SET name = ?, password = ?, role = 'admin' WHERE email = ?",
        [name, hashedPassword, email]
      );
      console.log("Existing account promoted to admin.");
    } else {
      await pool.execute(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')",
        [name, email, hashedPassword]
      );
      console.log("Admin account created successfully.");
    }
  } catch (error) {
    console.error("Admin creation failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

createAdmin();
