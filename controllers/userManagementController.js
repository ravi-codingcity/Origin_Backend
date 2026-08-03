const PortalUser = require("../models/PortalUser");
const AuditLog = require("../models/AuditLog");
const {
  DEPARTMENTS,
  ROLES,
  DEPARTMENT_LABELS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  ROLE_PORTALS,
  LOCATIONS,
  DEFAULT_ROLE_FOR_PORTAL,
} = require("../models/PortalUser");

/**
 * User management — IT Admin only.
 *
 * The route layer already rejects anyone who is not an `it_admin`. IT Admins
 * may create and manage accounts for ALL portals (ISF, IT Assets, Origin
 * Charges, HR) and may assign any role, including promoting another IT Admin.
 *
 * There is no public registration path into this module.
 */

const ip = (req) => req.headers["x-forwarded-for"] || req.ip || "";

/** IT Admins administer every portal. */
function allowedDepartments() {
  return DEPARTMENTS;
}

/** IT Admins may grant any defined role. */
function assignableRoles() {
  return ROLES;
}

/** Guard: can `actor` act on `target`? */
function canActOn(actor, target) {
  if (String(actor._id) === String(target._id)) {
    return { ok: false, message: "You cannot perform this action on your own account" };
  }
  return { ok: true };
}

/** Never allow the last active IT Admin to be removed or demoted/disabled. */
async function isLastActiveItAdmin(user) {
  if (user.role !== "it_admin") return false;
  const others = await PortalUser.countDocuments({
    role: "it_admin",
    isActive: true,
    _id: { $ne: user._id },
  });
  return others === 0;
}

/* ------------------------------------------------------------------ */
/* GET /api/admin/users                                                */
/* ------------------------------------------------------------------ */
exports.listUsers = async (req, res, next) => {
  try {
    const actor = req.portalUser;
    const { department, role, status, search } = req.query;

    const query = { department: { $in: allowedDepartments(actor) } };

    if (department && allowedDepartments(actor).includes(department)) {
      query.department = department;
    }
    if (role && ROLES.includes(role)) query.role = role;
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;
    if (search && search.trim()) {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ username: rx }, { name: rx }, { email: rx }];
    }

    const users = await PortalUser.find(query).sort({ createdAt: -1 }).limit(500);

    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
};

/* ------------------------------------------------------------------ */
/* POST /api/admin/users                                               */
/* ------------------------------------------------------------------ */
exports.createUser = async (req, res, next) => {
  try {
    const actor = req.portalUser;
    const { username, name, email, password, department, role, location } = req.body;

    if (!username || !name || !password || !department) {
      return res.status(400).json({
        success: false,
        message: "username, name, password and department are required",
      });
    }
    if (String(password).length < 8) {
      return res
        .status(400)
        .json({ success: false, message: "Password must be at least 8 characters" });
    }
    if (!DEPARTMENTS.includes(department)) {
      return res.status(400).json({ success: false, message: "Invalid department" });
    }
    if (!allowedDepartments(actor).includes(department)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden: cannot create users in that department" });
    }

    const targetRole = role || DEFAULT_ROLE_FOR_PORTAL[department] || "it_department";
    if (!assignableRoles(actor).includes(targetRole)) {
      return res
        .status(403)
        .json({ success: false, message: `Forbidden: you cannot assign the "${targetRole}" role` });
    }

    // The role must actually grant access to the selected portal, otherwise the
    // user would be created unable to sign in anywhere.
    if (!(ROLE_PORTALS[targetRole] || []).includes(department)) {
      return res.status(400).json({
        success: false,
        message: `The "${ROLE_LABELS[targetRole] || targetRole}" role does not have access to ${
          DEPARTMENT_LABELS[department] || department
        }`,
      });
    }

    if (location && !LOCATIONS.includes(location)) {
      return res.status(400).json({ success: false, message: "Invalid location" });
    }

    const exists = await PortalUser.findOne({ username: String(username).toLowerCase() });
    if (exists) {
      return res.status(409).json({ success: false, message: "Username already exists" });
    }

    const user = new PortalUser({
      username,
      name,
      email: email || "",
      department,
      role: targetRole,
      location: location || "",
      isActive: true,
      createdBy: actor._id,
    });
    await user.setPassword(password);
    await user.save();

    await AuditLog.record({
      action: "USER_CREATED",
      actorId: actor._id,
      actorUsername: actor.username,
      actorRole: actor.role,
      targetId: user._id,
      targetUsername: user.username,
      targetDepartment: user.department,
      details: `Created ${user.role} in ${user.department}`,
      ipAddress: ip(req),
    });

    res.status(201).json({ success: true, message: "User created successfully", data: user });
  } catch (err) {
    next(err);
  }
};

/* ------------------------------------------------------------------ */
/* PUT /api/admin/users/:id                                            */
/* ------------------------------------------------------------------ */
exports.updateUser = async (req, res, next) => {
  try {
    const actor = req.portalUser;
    const user = await PortalUser.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const guard = canActOn(actor, user);
    if (!guard.ok) return res.status(403).json({ success: false, message: guard.message });

    const { name, email, department, role, location } = req.body;

    if (department !== undefined) {
      if (!DEPARTMENTS.includes(department)) {
        return res.status(400).json({ success: false, message: "Invalid department" });
      }
      if (!allowedDepartments(actor).includes(department)) {
        return res
          .status(403)
          .json({ success: false, message: "Forbidden: cannot move user to that department" });
      }
      user.department = department;
    }
    if (role !== undefined) {
      if (!assignableRoles(actor).includes(role)) {
        return res
          .status(403)
          .json({ success: false, message: `Forbidden: you cannot assign the "${role}" role` });
      }
      // Never leave the system without an IT Admin who can manage users.
      if (role !== "it_admin" && (await isLastActiveItAdmin(user))) {
        return res.status(400).json({
          success: false,
          message: "Cannot change the role of the last active IT Admin",
        });
      }
      user.role = role;
    }

    // The final role/portal pairing must be coherent, or the user could end up
    // unable to sign in to the portal they are assigned to.
    if (!(ROLE_PORTALS[user.role] || []).includes(user.department)) {
      return res.status(400).json({
        success: false,
        message: `The "${ROLE_LABELS[user.role] || user.role}" role does not have access to ${
          DEPARTMENT_LABELS[user.department] || user.department
        }`,
      });
    }

    if (location !== undefined) {
      if (location && !LOCATIONS.includes(location)) {
        return res.status(400).json({ success: false, message: "Invalid location" });
      }
      user.location = location || "";
    }
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;

    user.updatedBy = actor._id;
    await user.save();

    await AuditLog.record({
      action: "USER_UPDATED",
      actorId: actor._id,
      actorUsername: actor.username,
      actorRole: actor.role,
      targetId: user._id,
      targetUsername: user.username,
      targetDepartment: user.department,
      details: `Updated profile (role=${user.role}, department=${user.department})`,
      ipAddress: ip(req),
    });

    res.json({ success: true, message: "User updated successfully", data: user });
  } catch (err) {
    next(err);
  }
};

/* ------------------------------------------------------------------ */
/* POST /api/admin/users/:id/reset-password                            */
/* ------------------------------------------------------------------ */
exports.resetPassword = async (req, res, next) => {
  try {
    const actor = req.portalUser;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 8) {
      return res
        .status(400)
        .json({ success: false, message: "New password must be at least 8 characters" });
    }

    const user = await PortalUser.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // An IT Admin may reset any account's password, including their own.
    await user.setPassword(newPassword);
    user.updatedBy = actor._id;
    await user.save();

    await AuditLog.record({
      action: "PASSWORD_RESET",
      actorId: actor._id,
      actorUsername: actor.username,
      actorRole: actor.role,
      targetId: user._id,
      targetUsername: user.username,
      targetDepartment: user.department,
      details: "Password reset by administrator",
      ipAddress: ip(req),
    });

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    next(err);
  }
};

/* ------------------------------------------------------------------ */
/* PATCH /api/admin/users/:id/status   { isActive: boolean }           */
/* ------------------------------------------------------------------ */
exports.setUserStatus = async (req, res, next) => {
  try {
    const actor = req.portalUser;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, message: "isActive (boolean) is required" });
    }

    const user = await PortalUser.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const guard = canActOn(actor, user);
    if (!guard.ok) return res.status(403).json({ success: false, message: guard.message });

    // Never leave the system without an IT Admin who can manage users.
    if (!isActive && (await isLastActiveItAdmin(user))) {
      return res.status(400).json({
        success: false,
        message: "Cannot deactivate the last active IT Admin",
      });
    }

    user.isActive = isActive;
    user.updatedBy = actor._id;
    await user.save();

    await AuditLog.record({
      action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      actorId: actor._id,
      actorUsername: actor.username,
      actorRole: actor.role,
      targetId: user._id,
      targetUsername: user.username,
      targetDepartment: user.department,
      details: isActive ? "Account activated" : "Account deactivated",
      ipAddress: ip(req),
    });

    res.json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

/* ------------------------------------------------------------------ */
/* DELETE /api/admin/users/:id                                         */
/* ------------------------------------------------------------------ */
exports.deleteUser = async (req, res, next) => {
  try {
    const actor = req.portalUser;
    const user = await PortalUser.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const guard = canActOn(actor, user);
    if (!guard.ok) return res.status(403).json({ success: false, message: guard.message });

    // Never allow the last active IT Admin to be removed.
    if (await isLastActiveItAdmin(user)) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot delete the last active IT Admin account" });
    }

    const snapshot = {
      id: user._id,
      username: user.username,
      department: user.department,
      role: user.role,
    };
    await user.deleteOne();

    await AuditLog.record({
      action: "USER_DELETED",
      actorId: actor._id,
      actorUsername: actor.username,
      actorRole: actor.role,
      targetId: snapshot.id,
      targetUsername: snapshot.username,
      targetDepartment: snapshot.department,
      details: `Deleted ${snapshot.role} account`,
      ipAddress: ip(req),
    });

    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    next(err);
  }
};

/* ------------------------------------------------------------------ */
/* GET /api/admin/users/meta  – dropdown options for the UI            */
/* ------------------------------------------------------------------ */
exports.getMeta = async (req, res) => {
  const actor = req.portalUser;
  res.json({
    success: true,
    data: {
      departments: allowedDepartments(),
      departmentLabels: DEPARTMENT_LABELS,
      roles: assignableRoles(),
      roleLabels: ROLE_LABELS,
      rolePermissions: ROLE_PERMISSIONS,
      rolePortals: ROLE_PORTALS,
      defaultRoleForPortal: DEFAULT_ROLE_FOR_PORTAL,
      locations: LOCATIONS,
      me: {
        id: actor._id,
        username: actor.username,
        name: actor.name,
        role: actor.role,
        department: actor.department,
      },
    },
  });
};

/* ------------------------------------------------------------------ */
/* GET /api/admin/audit-logs                                           */
/* ------------------------------------------------------------------ */
exports.getAuditLogs = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

    // IT Admins administer every portal, so they see the whole trail.
    const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(limit);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    next(err);
  }
};
