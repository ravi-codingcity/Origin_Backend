const jwt = require("jsonwebtoken");
const PortalUser = require("../models/PortalUser");

/**
 * Shared authentication / authorisation middleware for every OmTrans portal.
 *
 * Status codes are deliberate and relied upon by the frontends:
 *   401 – missing / invalid / expired token, or the account is deactivated
 *   403 – valid token, but the role or department is not permitted
 */

/** Extract a Bearer token from the Authorization header. */
function getToken(req) {
  const header = req.header("Authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/**
 * Verifies the JWT, loads the user, and rejects deactivated accounts.
 * Populates req.portalUser with the live DB record (never the raw token).
 */
async function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Always re-read the user so revoked/deactivated accounts are rejected
    // immediately rather than staying valid until the token expires.
    const user = await PortalUser.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "Account no longer exists" });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: "Account is deactivated" });
    }

    req.portalUser = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Token is not valid" });
  }
}

/** Allow only the listed roles. Usage: requireRole("super_admin", "admin") */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.portalUser) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    if (!roles.includes(req.portalUser.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden: insufficient permissions" });
    }
    next();
  };
}

/**
 * Restrict a route to one portal.
 *
 * Access is derived from the user's ROLE (see ROLE_PORTALS):
 *   isf           -> ISF Filing Portal
 *   it_department -> IT Assets Management Portal
 *   export        -> Origin Charges Portal
 *   hr            -> OmTrans HR Portal
 *   it_admin      -> all four portals
 */
function requireDepartment(portal) {
  return (req, res, next) => {
    if (!req.portalUser) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    if (!req.portalUser.canAccessPortal(portal)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden: no access to this module" });
    }
    next();
  };
}

/** Alias that reads better at call sites. */
const requirePortal = requireDepartment;

/**
 * Guards the User Management module.
 * ONLY IT Admins may create, modify, reset, activate/deactivate or delete
 * accounts — for any portal.
 */
const requireUserManager = requireRole("it_admin");

/** Enforce a specific capability from the role permission matrix. */
function requirePermission(capability) {
  return (req, res, next) => {
    if (!req.portalUser) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    const perms = req.portalUser.getPermissions();
    if (!perms[capability]) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: your role does not permit this action",
      });
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
  requireDepartment,
  requirePortal,
  requireUserManager,
  requirePermission,
  getToken,
};
