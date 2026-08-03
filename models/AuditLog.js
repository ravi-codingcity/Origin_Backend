const mongoose = require("mongoose");

/**
 * Append-only audit trail for user-management actions.
 *
 * Every privileged operation (create / update / password reset / activate /
 * deactivate / delete / login) is recorded here so account changes can be
 * traced back to the admin who made them.
 */
const AUDIT_ACTIONS = [
  "USER_CREATED",
  "USER_UPDATED",
  "PASSWORD_RESET",
  "USER_ACTIVATED",
  "USER_DEACTIVATED",
  "USER_DELETED",
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
];

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },

    // Who performed the action (null for failed/anonymous login attempts)
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "PortalUser", default: null },
    actorUsername: { type: String, default: "system" },
    actorRole: { type: String, default: "" },

    // Who the action was performed on
    targetId: { type: mongoose.Schema.Types.ObjectId, ref: "PortalUser", default: null },
    targetUsername: { type: String, default: "" },
    targetDepartment: { type: String, default: "" },

    details: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

/**
 * Fire-and-forget writer. Auditing must never break the request it records,
 * so failures are swallowed and logged to the console only.
 */
auditLogSchema.statics.record = async function (entry) {
  try {
    await this.create(entry);
  } catch (err) {
    console.error("Audit log write failed:", err.message);
  }
};

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

module.exports = AuditLog;
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
