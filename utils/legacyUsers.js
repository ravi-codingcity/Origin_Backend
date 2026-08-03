const bcrypt = require("bcryptjs");
const PortalUser = require("../models/PortalUser");
const ITUser = require("../models/itAssets/ITUser");
const OriginUser = require("../models/User");
const HRUser = require("../models/jobPortal/HRUser");

/**
 * Backward-compatibility bridge for accounts created before role-based auth.
 *
 * Every portal used to keep its users in its own collection with its own field
 * names. Authentication now runs against the unified `PortalUser` collection,
 * so those accounts are carried across WITHOUT changing anyone's password:
 * the original bcrypt hash is copied verbatim, so existing credentials keep
 * working exactly as before.
 *
 * Nothing is ever deleted from the legacy collections — they are only read.
 *
 * Migration happens two ways:
 *   1. In bulk, via `npm run migrate:users`
 *   2. Lazily, the first time a legacy user signs in successfully
 */

/**
 * How each portal's legacy collection maps onto the new model.
 *  model      – the legacy mongoose model
 *  hashField  – the field holding the bcrypt hash
 *  mapRole    – legacy role -> new role
 */
const LEGACY_SOURCES = {
  it_assets: {
    label: "IT Assets Management Portal",
    model: ITUser,
    hashField: "password",
    // Existing IT "admin" accounts become IT Admins (cross-portal + user
    // management); everyone else becomes IT Department.
    mapRole: (legacy) => (legacy?.role === "admin" ? "it_admin" : "it_department"),
  },
  origin_charges: {
    label: "Origin Charges Portal",
    model: OriginUser,
    hashField: "password",
    // Origin Charges users carry the Export role.
    mapRole: () => "export",
  },
  hr_portal: {
    label: "OmTrans HR Portal",
    model: HRUser,
    hashField: "passwordHash",
    mapRole: () => "hr",
  },
  // The ISF portal never had server-side accounts (its old login was hardcoded
  // in the frontend), so there is nothing to migrate for it.
  isf: null,
};

/** Case-insensitive exact match, so "OmTrans_HR" still resolves. */
function ciExact(value) {
  return new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

/** Find a legacy record for a given portal + username. */
async function findLegacyUser(department, username) {
  const source = LEGACY_SOURCES[department];
  if (!source) return null;
  return source.model.findOne({ username: ciExact(username) });
}

/**
 * Build (but do not save) a PortalUser from a legacy record, reusing the
 * existing bcrypt hash so the user's current password stays valid.
 */
function buildPortalUser(department, legacy) {
  const source = LEGACY_SOURCES[department];
  const hash = legacy[source.hashField];

  return new PortalUser({
    username: String(legacy.username).toLowerCase().trim(),
    name: legacy.name || legacy.username,
    // Some legacy rows stored the username in `email`; only keep real addresses.
    email: legacy.email && String(legacy.email).includes("@") ? legacy.email : "",
    passwordHash: hash,
    department,
    role: source.mapRole(legacy),
    isActive: true,
    // Keep the link to the old account so records created under that id
    // (createdBy) remain visible to this user.
    legacyUserId: legacy._id,
    createdAt: legacy.createdAt,
  });
}

/**
 * Lazy migration used by the login flow.
 *
 * Looks the username up in the portal's legacy collection, verifies the
 * supplied password against the stored hash, and — only on success — creates
 * the matching PortalUser record. Returns the new PortalUser, or null if the
 * user does not exist there / the password is wrong.
 */
async function migrateLegacyUserOnLogin(department, username, password) {
  const source = LEGACY_SOURCES[department];
  if (!source) return null;

  const legacy = await findLegacyUser(department, username);
  if (!legacy) return null;

  const hash = legacy[source.hashField];
  if (!hash || typeof hash !== "string") return null;

  const isMatch = await bcrypt.compare(password, hash);
  if (!isMatch) return null;

  const key = String(legacy.username).toLowerCase().trim();

  // Guard against a username that already exists under another portal.
  const clash = await PortalUser.findOne({ username: key });
  if (clash) return clash;

  const user = buildPortalUser(department, legacy);
  await user.save();
  console.log(
    `[migration] Carried over "${key}" from ${source.label} as role "${user.role}".`
  );
  return user;
}

/**
 * Bulk migration of every legacy account.
 * Idempotent: usernames already present in PortalUser are left untouched.
 */
async function migrateAllLegacyUsers({ dryRun = false } = {}) {
  const report = { created: [], skipped: [], conflicts: [] };

  for (const [department, source] of Object.entries(LEGACY_SOURCES)) {
    if (!source) continue;

    const legacyUsers = await source.model.find({});
    for (const legacy of legacyUsers) {
      const key = String(legacy.username).toLowerCase().trim();
      const hash = legacy[source.hashField];

      if (!hash || typeof hash !== "string" || !hash.startsWith("$2")) {
        report.conflicts.push({
          username: key,
          department,
          reason: "missing or non-bcrypt password hash",
        });
        continue;
      }

      const existing = await PortalUser.findOne({ username: key });
      if (existing) {
        if (existing.department === department) {
          report.skipped.push({ username: key, department, reason: "already migrated" });
        } else {
          report.conflicts.push({
            username: key,
            department,
            reason: `username already used by the ${existing.department} portal`,
          });
        }
        continue;
      }

      const user = buildPortalUser(department, legacy);
      if (!dryRun) await user.save();
      report.created.push({ username: key, department, role: user.role });
    }
  }

  return report;
}

module.exports = {
  LEGACY_SOURCES,
  findLegacyUser,
  migrateLegacyUserOnLogin,
  migrateAllLegacyUsers,
};
