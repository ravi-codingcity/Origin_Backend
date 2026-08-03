/**
 * Grant the IT Admin role to an EXISTING account.
 *
 * This creates nothing and changes no password — it only raises the role of a
 * user who already exists, so they can open User Management in the IT Assets
 * portal. Use it when the migration produced no IT Admin.
 *
 * Usage:
 *   node utils/promoteItAdmin.js <username>
 *   node utils/promoteItAdmin.js --list      # show who can manage users
 */
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const PortalUser = require("../models/PortalUser");
const AuditLog = require("../models/AuditLog");

dotenv.config();

(async () => {
  const args = process.argv.slice(2);
  const list = args.includes("--list");
  const username = args.find((a) => !a.startsWith("--"));

  if (!list && !username) {
    console.error(
      "\nUsage:\n  node utils/promoteItAdmin.js <username>\n  node utils/promoteItAdmin.js --list\n"
    );
    process.exit(1);
  }

  try {
    await connectDB();

    if (list) {
      const all = await PortalUser.find({}).sort({ department: 1, username: 1 });
      console.log(`\n${all.length} account(s) in the role-based system:\n`);
      all.forEach((u) =>
        console.log(
          `  ${u.isActive ? "●" : "○"} ${u.username.padEnd(18)} ${String(u.department).padEnd(16)} ${u.role}`
        )
      );
      const admins = all.filter((u) => u.role === "it_admin" && u.isActive);
      console.log(`\nActive IT Admins: ${admins.length || "NONE"}`);
      process.exit(0);
    }

    const key = String(username).toLowerCase().trim();
    const user = await PortalUser.findOne({ username: key });

    if (!user) {
      console.error(
        `\nNo account "${key}" in the role-based system yet.\n` +
          `Run the migration first:  node utils/migrateLegacyUsers.js\n`
      );
      process.exit(1);
    }

    user.role = "it_admin";
    user.department = "it_assets"; // User Management lives in the IT portal
    user.isActive = true;
    await user.save();

    await AuditLog.record({
      action: "USER_UPDATED",
      actorUsername: "promote-cli",
      actorRole: "system",
      targetId: user._id,
      targetUsername: user.username,
      targetDepartment: user.department,
      details: "Promoted to IT Admin via CLI",
    });

    console.log(
      `\n"${user.username}" is now an IT Admin.\n` +
        `Sign in at /it-assets/login — their existing password is unchanged.\n`
    );
    process.exit(0);
  } catch (err) {
    console.error("Promotion failed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
})();
