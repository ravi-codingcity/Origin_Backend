/**
 * ONE-TIME BOOTSTRAP — create the first IT Admin.
 *
 * This is NOT a seed script and it creates NO default account. It refuses to
 * run once an IT Admin already exists, and it has no fallback credentials:
 * the username and password must be supplied explicitly on the command line.
 *
 * After the first IT Admin exists, EVERY other account (including further IT
 * Admins) must be created from the User Management module inside the IT
 * Assets portal. There is no registration endpoint anywhere in the API.
 *
 * Usage:
 *   node utils/createItAdmin.js <username> <password> "<Full Name>"
 *   npm run create:it-admin -- <username> <password> "<Full Name>"
 *
 * To rotate a forgotten password, use --force (still requires an explicit
 * username + password, and only touches that one account):
 *   node utils/createItAdmin.js <username> <newPassword> "<Full Name>" --force
 */
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const PortalUser = require("../models/PortalUser");
const AuditLog = require("../models/AuditLog");

dotenv.config();

function usage(msg) {
  if (msg) console.error(`\nError: ${msg}`);
  console.error(
    `\nUsage:\n  node utils/createItAdmin.js <username> <password> "<Full Name>" [--force]\n`
  );
  process.exit(1);
}

(async () => {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const [username, password, ...nameParts] = args.filter((a) => a !== "--force");
  const name = nameParts.join(" ").trim() || "IT Administrator";

  if (!username || !password) usage("username and password are required.");
  if (username.length < 3) usage("username must be at least 3 characters.");
  if (password.length < 8) usage("password must be at least 8 characters.");

  try {
    await connectDB();

    const key = String(username).toLowerCase().trim();
    const existingAdmins = await PortalUser.countDocuments({ role: "it_admin" });
    let user = await PortalUser.findOne({ username: key });

    // Bootstrap only: refuse to mint additional admins from the CLI.
    if (existingAdmins > 0 && !force) {
      console.error(
        `\nAn IT Admin already exists (${existingAdmins} found).\n` +
          `Create further accounts from the User Management module in the IT Assets portal.\n` +
          `To reset this account's password instead, re-run with --force.\n`
      );
      process.exit(1);
    }

    if (user) {
      if (!force) {
        console.error(
          `\nUser "${key}" already exists. Re-run with --force to reset their password.\n`
        );
        process.exit(1);
      }
      await user.setPassword(password);
      user.role = "it_admin";
      user.department = "it_assets";
      user.isActive = true;
      user.name = name;
      await user.save();
      console.log(`IT Admin "${key}" updated — password reset.`);
    } else {
      user = new PortalUser({
        username: key,
        name,
        department: "it_assets",
        role: "it_admin",
        isActive: true,
      });
      await user.setPassword(password);
      await user.save();
      console.log(`IT Admin "${key}" created successfully.`);
    }

    await AuditLog.record({
      action: "USER_CREATED",
      actorUsername: "bootstrap-cli",
      actorRole: "system",
      targetId: user._id,
      targetUsername: user.username,
      targetDepartment: user.department,
      details: force
        ? "IT Admin password reset via bootstrap CLI"
        : "First IT Admin created via bootstrap CLI",
    });

    console.log(
      "\nSign in at /it-assets/login, then open the 'User Management' tab to create all other accounts."
    );
    process.exit(0);
  } catch (err) {
    console.error("Bootstrap failed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
})();
