/**
 * Re-map accounts onto the portal-specific role names.
 *
 * Old generic roles (admin / manager / user / viewer / hr) become the role that
 * matches the portal the account belongs to:
 *
 *   ISF Filing Portal            -> isf
 *   IT Assets Management Portal  -> it_department   (it_admin is preserved)
 *   Origin Charges Portal        -> export
 *   OmTrans HR Portal            -> hr
 *
 * IT Admins keep `it_admin`, which is the only role with cross-portal access
 * and User Management rights.
 *
 * NON-DESTRUCTIVE: only the `role` field changes. No password is touched and no
 * account is created or deleted. Safe to re-run.
 *
 * Usage:
 *   node utils/migrateRoles.js --dry-run
 *   node utils/migrateRoles.js
 */
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const PortalUser = require("../models/PortalUser");
const {
  ROLES,
  ROLE_PORTALS,
  DEFAULT_ROLE_FOR_PORTAL,
} = require("../models/PortalUser");

dotenv.config();

(async () => {
  const dryRun = process.argv.includes("--dry-run");

  try {
    await connectDB();
    console.log(
      dryRun
        ? "\nDRY RUN — no changes will be written.\n"
        : "\nRe-mapping accounts onto portal-specific roles…\n"
    );

    // Read raw docs so documents with now-invalid enum values still load.
    const col = mongoose.connection.db.collection("portalusers");
    const docs = await col.find({}).toArray();

    let changed = 0;
    let kept = 0;

    for (const d of docs) {
      const portal = d.department;
      const current = d.role;

      // IT Admin is preserved as-is — it is the cross-portal admin role.
      let target =
        current === "it_admin" ? "it_admin" : DEFAULT_ROLE_FOR_PORTAL[portal];

      if (!target || !ROLES.includes(target)) {
        console.log(`   ! ${d.username}: unknown portal "${portal}", skipped`);
        continue;
      }

      // Sanity: the chosen role must grant access to that portal.
      if (!(ROLE_PORTALS[target] || []).includes(portal)) {
        console.log(`   ! ${d.username}: "${target}" has no access to ${portal}, skipped`);
        continue;
      }

      if (current === target) {
        kept++;
        continue;
      }

      console.log(
        `   ~ ${String(d.username).padEnd(16)} ${String(portal).padEnd(16)} ${String(
          current
        ).padEnd(14)} -> ${target}`
      );
      if (!dryRun) {
        await col.updateOne({ _id: d._id }, { $set: { role: target } });
      }
      changed++;
    }

    console.log(`\nUpdated: ${changed}   Already correct: ${kept}`);

    if (!dryRun) {
      const summary = await PortalUser.aggregate([
        { $group: { _id: { portal: "$department", role: "$role" }, n: { $sum: 1 } } },
        { $sort: { "_id.portal": 1, "_id.role": 1 } },
      ]);
      console.log("\nFinal role distribution:");
      summary.forEach((s) =>
        console.log(`   ${String(s._id.portal).padEnd(16)} ${String(s._id.role).padEnd(14)} ${s.n}`)
      );

      const admins = await PortalUser.countDocuments({ role: "it_admin", isActive: true });
      console.log(`\nActive IT Admins (cross-portal + user management): ${admins}`);
    } else {
      console.log("\nRe-run without --dry-run to apply.\n");
    }

    process.exit(0);
  } catch (err) {
    console.error("Role migration failed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
})();
