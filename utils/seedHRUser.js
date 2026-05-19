/**
 * Seed the first Job Portal HR user from environment variables.
 *
 *   SEED_HR_USER  – username to create
 *   SEED_HR_PASS  – plaintext password (hashed with bcrypt before storage)
 *
 * Run:  node utils/seedHRUser.js   (or: npm run seed:hr)
 *
 * Idempotent: if the username already exists it is left untouched.
 * Never hardcode credentials — supply them via the environment.
 */
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const HRUser = require("../models/jobPortal/HRUser");

dotenv.config();

(async () => {
  const username = process.env.SEED_HR_USER;
  const password = process.env.SEED_HR_PASS;

  if (!username || !password) {
    console.error("Missing SEED_HR_USER / SEED_HR_PASS in environment. Aborting.");
    process.exit(1);
  }

  try {
    await connectDB();

    const existing = await HRUser.findOne({ username });
    if (existing) {
      console.log(`HR user "${username}" already exists — nothing to do.`);
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await HRUser.create({ username, passwordHash, role: "hr" });

    console.log(`HR user "${username}" created successfully.`);
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
})();
