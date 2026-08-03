/**
 * Migrate the ISF Filing Portal from its old hardcoded login to a real,
 * database-backed account.
 *
 * The ISF portal used to authenticate against credentials written directly in
 * the frontend source. That check has been removed; the portal now posts to
 * /api/isf-filing/login and is validated against the database like every other
 * portal. This script creates the one ISF account so that login keeps working.
 *
 * The password is bcrypt-hashed (cost 12) before storage — it is never written
 * in plain text.
 *
 * SAFETY: this only creates/updates a user document. It never touches the
 * `isf_filings` collection, so all historical ISF records are preserved.
 *
 * Usage:
 *   node utils/createIsfUser.js                       # username admin, legacy password
 *   node utils/createIsfUser.js <username> <password> # explicit credentials
 *   node utils/createIsfUser.js <username> <password> --force   # reset existing
 */
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const PortalUser = require("../models/PortalUser");
const AuditLog = require("../models/AuditLog");

dotenv.config();

// Legacy credentials the ISF portal used before database authentication.
// Kept as the default purely so the existing user's login continues to work.
const LEGACY_USERNAME = "admin";
const LEGACY_PASSWORD = "2025";

(async () => {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const positional = args.filter((a) => !a.startsWith("--"));
  const username = (positional[0] || LEGACY_USERNAME).toLowerCase().trim();
  const password = positional[1] || LEGACY_PASSWORD;
  const name = positional.slice(2).join(" ") || "ISF User";

  try {
    await connectDB();

    // Confirm the historical filings are present and will be left alone.
    const filings = await mongoose.connection.db
      .collection("isf_filings")
      .countDocuments();
    console.log(`\nISF records in database: ${filings} (not modified by this script)`);

    let user = await PortalUser.findOne({ username });

    if (user && !force) {
      console.log(
        `\nUser "${username}" already exists (${user.department}/${user.role}).` +
          `\nRe-run with --force to reset their password.\n`
      );
      process.exit(0);
    }

    if (user) {
      await user.setPassword(password);
      user.department = "isf";
      user.role = "isf";
      user.isActive = true;
      await user.save();
      console.log(`\nISF user "${username}" updated — password reset.`);
    } else {
      user = new PortalUser({
        username,
        name,
        department: "isf",
        role: "isf",
        isActive: true,
      });
      await user.setPassword(password);
      await user.save();
      console.log(`\nISF user "${username}" created.`);
    }

    await AuditLog.record({
      action: user.isNew ? "USER_CREATED" : "USER_UPDATED",
      actorUsername: "isf-migration-cli",
      actorRole: "system",
      targetId: user._id,
      targetUsername: user.username,
      targetDepartment: "isf",
      details: "ISF account migrated from hardcoded login to database auth",
    });

    console.log(
      `  username : ${user.username}\n` +
        `  role     : ${user.role} (ISF Filing Portal only)\n` +
        `  password : stored as a bcrypt hash (never plain text)\n` +
        `\nSign in at /isf/login. All ${filings} existing ISF records remain accessible.`
    );

    if (password.length < 8) {
      console.log(
        `\n  WARNING: "${username}" has a ${password.length}-character password.\n` +
          `  It works, but it is weak. Change it from User Management in the IT\n` +
          `  Assets portal (IT Admin) or with:\n` +
          `    node utils/createIsfUser.js ${username} <stronger-password> --force\n`
      );
    }

    process.exit(0);
  } catch (err) {
    console.error("ISF user migration failed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
})();
