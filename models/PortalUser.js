const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * Unified user account for every OmTrans internal portal.
 *
 * ACCOUNT CREATION IS RESTRICTED TO IT ADMINS.
 * There is no public registration, no self sign-up and no default/seed
 * accounts. Accounts exist only because an IT Admin created them from the
 * User Management module in the IT Assets portal.
 *
 * Access is driven by ROLE:
 *   isf           -> ISF Filing Portal only
 *   it_department -> IT Assets Management Portal only
 *   export        -> Origin Charges Portal only
 *   hr            -> OmTrans HR Portal only
 *   it_admin      -> ALL FOUR portals + User Management (the only such role)
 */

// The four portals.
const PORTALS = ["isf", "it_assets", "origin_charges", "hr_portal"];
// `department` is the user's home portal; kept as an alias for readability.
const DEPARTMENTS = PORTALS;

const DEPARTMENT_LABELS = {
  isf: "ISF Filing Portal",
  it_assets: "IT Assets Management Portal",
  origin_charges: "Origin Charges Portal",
  hr_portal: "OmTrans HR Portal",
};

const ROLES = ["it_admin", "it_department", "isf", "export", "hr"];

const ROLE_LABELS = {
  it_admin: "IT Admin",
  it_department: "IT Department",
  isf: "ISF",
  export: "Export",
  hr: "HR",
};

/**
 * Which portals each role may sign in to.
 * IT Admin is the ONLY role with cross-portal access.
 */
const ROLE_PORTALS = {
  it_admin: [...PORTALS],
  it_department: ["it_assets"],
  isf: ["isf"],
  export: ["origin_charges"],
  hr: ["hr_portal"],
};

/**
 * Capabilities per role.
 *
 * Every role keeps FULL access to the day-to-day features of its own portal —
 * existing functionality is unchanged. The only elevated capabilities are
 * cross-portal access and user management, which belong to IT Admin alone.
 */
const ROLE_PERMISSIONS = {
  it_admin: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canExport: true,
    canManageUsers: true,
    canAccessAllPortals: true,
  },
  it_department: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canExport: true,
    canManageUsers: false,
    canAccessAllPortals: false,
  },
  isf: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canExport: true,
    canManageUsers: false,
    canAccessAllPortals: false,
  },
  export: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canExport: true,
    canManageUsers: false,
    canAccessAllPortals: false,
  },
  hr: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canExport: true,
    canManageUsers: false,
    canAccessAllPortals: false,
  },
};

/** Office locations (primarily used by the IT Assets portal). */
const LOCATIONS = ["Delhi", "Mumbai"];

/** Default role suggested for each portal when creating a user. */
const DEFAULT_ROLE_FOR_PORTAL = {
  isf: "isf",
  it_assets: "it_department",
  origin_charges: "export",
  hr_portal: "hr",
};

const portalUserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    passwordHash: { type: String, required: true },

    // Home portal. Access is ultimately decided by ROLE_PORTALS[role].
    department: { type: String, enum: DEPARTMENTS, required: true, index: true },
    role: { type: String, enum: ROLES, default: "it_department", index: true },

    // Office location — optional, used by the IT Assets portal (Delhi/Mumbai).
    location: { type: String, enum: [...LOCATIONS, ""], default: "" },

    isActive: { type: Boolean, default: true, index: true },

    /**
     * _id of this person's original per-portal account (origin_users,
     * it_users, jobportal_hrusers) before role-based auth.
     *
     * Historical records store `createdBy` as that old id, so ownership
     * queries must match EITHER this user's PortalUser _id (new records) OR
     * this legacy id (existing records). Keeping the link here means no
     * historical document has to be rewritten.
     */
    legacyUserId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    // Audit trail helpers
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "PortalUser", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "PortalUser", default: null },
    lastLoginAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/** Set a new plaintext password — always bcrypt-hashed, never stored raw. */
portalUserSchema.methods.setPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(plainPassword, salt);
  this.passwordChangedAt = new Date();
};

portalUserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

/** Only IT Admins may manage user accounts. */
portalUserSchema.methods.canManageUsers = function () {
  return this.role === "it_admin";
};

/** Can this user sign in to the given portal? */
portalUserSchema.methods.canAccessPortal = function (portal) {
  const allowed = ROLE_PORTALS[this.role] || [];
  return allowed.includes(portal);
};

portalUserSchema.methods.getPermissions = function () {
  return ROLE_PERMISSIONS[this.role] || ROLE_PERMISSIONS.it_department;
};

/**
 * Every id this user may own records under.
 *
 * Records created before role-based auth reference the person's legacy
 * per-portal account id; records created since reference their PortalUser id.
 * Ownership lookups must consider both, e.g.
 *   Form.find({ createdBy: { $in: user.ownerIds() } })
 */
portalUserSchema.methods.ownerIds = function () {
  const ids = [this._id];
  if (this.legacyUserId) ids.push(this.legacyUserId);
  return ids;
};

/** True if the given createdBy value belongs to this user. */
portalUserSchema.methods.ownsRecord = function (createdBy) {
  if (!createdBy) return false;
  return this.ownerIds().some((id) => String(id) === String(createdBy));
};

// Never leak the hash; expose resolved permissions + portal access instead.
portalUserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  obj.permissions = ROLE_PERMISSIONS[this.role] || ROLE_PERMISSIONS.it_department;
  obj.allowedPortals = ROLE_PORTALS[this.role] || [];
  return obj;
};

const PortalUser = mongoose.model("PortalUser", portalUserSchema);

module.exports = PortalUser;
module.exports.PORTALS = PORTALS;
module.exports.DEPARTMENTS = DEPARTMENTS;
module.exports.DEPARTMENT_LABELS = DEPARTMENT_LABELS;
module.exports.ROLES = ROLES;
module.exports.ROLE_LABELS = ROLE_LABELS;
module.exports.ROLE_PORTALS = ROLE_PORTALS;
module.exports.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
module.exports.LOCATIONS = LOCATIONS;
module.exports.DEFAULT_ROLE_FOR_PORTAL = DEFAULT_ROLE_FOR_PORTAL;
