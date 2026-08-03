/**
 * Migrate every pre-existing portal account into the role-based system.
 *
 * NON-DESTRUCTIVE: the original collections are only read. No account is
 * deleted, and no password is changed — each user's existing bcrypt hash is
 * copied across verbatim, so current credentials keep working.
 *
 * Role mapping:
 *   it_users          "admin"   -> it_admin   (can manage users)
 *                     "manager" -> manager
 *                     "user"    -> user
 *   origin_users      (no role) -> admin      (full access to their portal)
 *   jobportal_hrusers "hr"      -> admin      (full access to their portal)
 *
 * Usage:
 *   node utils/migrateLegacyUsers.js --dry-run   # preview, changes nothing
 *   node utils/migrateLegacyUsers.js             # perform the migration
 */
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const PortalUser = require("../models/PortalUser");
const { migrateAllLegacyUsers } = require("./legacyUsers");

dotenv.config();

(async () => {
  const dryRun = process.argv.includes("--dry-run");

  try {
    await connectDB();
    console.log(
      dryRun
        ? "\nDRY RUN — no changes will be written.\n"
        : "\nMigrating existing accounts into the role-based system…\n"
    );

    const report = await migrateAllLegacyUsers({ dryRun });

    if (report.created.length) {
      console.log(`Carried over ${report.created.length} account(s):`);
      report.created.forEach((r) =>
        console.log(`   + ${r.username.padEnd(18)} ${r.department.padEnd(16)} role=${r.role}`)
      );
    } else {
      console.log("No new accounts to carry over.");
    }

    if (report.skipped.length) {
      console.log(`\nAlready migrated (${report.skipped.length}), left untouched:`);
      report.skipped.forEach((r) => console.log(`   = ${r.username} (${r.department})`));
    }

    if (report.conflicts.length) {
      console.log(`\nNeeds attention (${report.conflicts.length}):`);
      report.conflicts.forEach((r) =>
        console.log(`   ! ${r.username} (${r.department}) — ${r.reason}`)
      );
    }

    // Confirm somebody can actually manage users.
    const itAdmins = await PortalUser.find({ role: "it_admin", isActive: true });
    console.log(`\nActive IT Admins: ${itAdmins.length}`);
    itAdmins.forEach((u) => console.log(`   * ${u.username} (${u.name})`));

    if (!dryRun && itAdmins.length === 0) {
      console.log(
        "\nNo IT Admin found. Promote an existing user so they can manage accounts:\n" +
          "  node utils/promoteItAdmin.js <username>\n"
      );
    }

    if (dryRun) console.log("\nRe-run without --dry-run to apply.\n");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
})();
