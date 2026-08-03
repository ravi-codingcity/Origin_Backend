/**
 * Link each migrated account back to its original per-portal account id.
 *
 * WHY: records created before role-based auth store `createdBy` as the user's
 * OLD account id (origin_users / it_users / jobportal_hrusers). Migration gave
 * everyone a brand-new PortalUser `_id`, so ownership lookups stopped matching
 * and users could no longer see their own historical data.
 *
 * Rather than rewrite hundreds of historical records, this stores the old id on
 * the user as `legacyUserId`. Ownership queries then match either id, so old
 * and new records are both visible.
 *
 * NON-DESTRUCTIVE: only sets `legacyUserId` on user documents. No form, filing
 * or asset record is read-modified, and no account is created or deleted.
 *
 * Usage:
 *   node utils/linkLegacyIds.js --dry-run
 *   node utils/linkLegacyIds.js
 */
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const PortalUser = require("../models/PortalUser");
const ITUser = require("../models/itAssets/ITUser");
const OriginUser = require("../models/User");
const HRUser = require("../models/jobPortal/HRUser");

dotenv.config();

const SOURCES = [
  ["it_assets", ITUser],
  ["origin_charges", OriginUser],
  ["hr_portal", HRUser],
];

(async () => {
  const dryRun = process.argv.includes("--dry-run");

  try {
    await connectDB();
    console.log(
      dryRun ? "\nDRY RUN — no changes will be written.\n" : "\nLinking legacy account ids…\n"
    );

    let linked = 0;
    let already = 0;
    let missing = 0;

    for (const [department, Model] of SOURCES) {
      for (const legacy of await Model.find({})) {
        const key = String(legacy.username).toLowerCase().trim();
        const user = await PortalUser.findOne({ username: key });

        if (!user) {
          console.log(`   ? ${key.padEnd(14)} (${department}) — no PortalUser, skipped`);
          missing++;
          continue;
        }
        if (user.legacyUserId && String(user.legacyUserId) === String(legacy._id)) {
          already++;
          continue;
        }

        console.log(
          `   + ${key.padEnd(14)} ${department.padEnd(16)} legacyId=${legacy._id}`
        );
        if (!dryRun) {
          user.legacyUserId = legacy._id;
          await user.save();
        }
        linked++;
      }
    }

    console.log(`\nLinked: ${linked}   Already linked: ${already}   No account: ${missing}`);

    // Show how many historical records each user can now see.
    if (!dryRun) {
      const db = mongoose.connection.db;
      console.log("\nHistorical records now visible per user:");
      for (const u of await PortalUser.find({ department: "origin_charges" }).sort({ username: 1 })) {
        const ids = u.ownerIds();
        const forms = await db
          .collection("origin_forms")
          .countDocuments({ createdBy: { $in: ids } });
        const rail = await db
          .collection("railfreightforms")
          .countDocuments({ createdBy: { $in: ids } });
        console.log(
          `   ${u.username.padEnd(12)} origin=${String(forms).padStart(4)}  railfreight=${String(rail).padStart(4)}`
        );
      }
    } else {
      console.log("\nRe-run without --dry-run to apply.\n");
    }

    process.exit(0);
  } catch (err) {
    console.error("Linking failed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
})();
