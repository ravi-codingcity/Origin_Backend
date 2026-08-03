const jwt = require("jsonwebtoken");
const PortalUser = require("../models/PortalUser");
const { ROLE_PORTALS } = require("../models/PortalUser");
const AuditLog = require("../models/AuditLog");
const { migrateLegacyUserOnLogin } = require("../utils/legacyUsers");

/**
 * Unified sign-in for every OmTrans portal.
 *
 * All portals authenticate against the single PortalUser collection, scoped by
 * department. Accounts are created exclusively by an administrator — there is
 * no registration endpoint anywhere in this API.
 *
 * Super admins and admins may sign in to any portal so they can administer it.
 */

const ip = (req) => req.headers["x-forwarded-for"] || req.ip || "";

function signToken(user) {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      role: user.role,
      department: user.department,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

/**
 * Builds a login handler bound to one department.
 * @param {string} department        one of the PortalUser departments
 * @param {function} shape           maps (user, token) -> response body
 */
function makeLoginHandler(department, shape) {
  return async (req, res, next) => {
    try {
      // The Origin Charges UI posts its username in an `email` field.
      const identifier = req.body.username || req.body.email;
      const { password } = req.body;

      if (!identifier || !password) {
        return res
          .status(400)
          .json({ success: false, message: "Username and password are required" });
      }

      const key = String(identifier).toLowerCase().trim();
      let user = await PortalUser.findOne({ username: key });

      // Uniform message so the endpoint can't be used to enumerate usernames.
      const invalid = () => {
        AuditLog.record({
          action: "LOGIN_FAILED",
          actorUsername: key,
          targetDepartment: department,
          details: "Invalid credentials",
          ipAddress: ip(req),
        });
        return res
          .status(401)
          .json({ success: false, message: "Invalid username or password" });
      };

      if (user) {
        const isMatch = await user.comparePassword(password);
        if (!isMatch) return invalid();
      } else {
        // Backward compatibility: the account may pre-date role-based auth and
        // still live in this portal's original collection. Verify against the
        // stored bcrypt hash and carry the account across on first successful
        // sign-in. The password itself is never changed.
        user = await migrateLegacyUserOnLogin(department, key, password);
        if (!user) return invalid();
      }

      if (!user.isActive) {
        await AuditLog.record({
          action: "LOGIN_FAILED",
          actorId: user._id,
          actorUsername: user.username,
          targetDepartment: department,
          details: "Account deactivated",
          ipAddress: ip(req),
        });
        return res.status(403).json({
          success: false,
          message: "Your account has been deactivated. Please contact your administrator.",
        });
      }

      // Portal gate — driven by the user's role (IT Admin reaches all four).
      if (!user.canAccessPortal(department)) {
        await AuditLog.record({
          action: "LOGIN_FAILED",
          actorId: user._id,
          actorUsername: user.username,
          actorRole: user.role,
          targetDepartment: department,
          details: `Denied: role "${user.role}" has no access to ${department}`,
          ipAddress: ip(req),
        });
        return res
          .status(403)
          .json({ success: false, message: "You do not have access to this portal" });
      }

      user.lastLoginAt = new Date();
      await user.save();

      await AuditLog.record({
        action: "LOGIN_SUCCESS",
        actorId: user._id,
        actorUsername: user.username,
        actorRole: user.role,
        targetDepartment: department,
        details: `Signed in to ${department}`,
        ipAddress: ip(req),
      });

      const token = signToken(user);
      return res.status(200).json(shape(user, token));
    } catch (err) {
      next(err);
    }
  };
}

/* ------------------------------------------------------------------ */
/* Per-portal handlers — response shapes match the existing frontends. */
/* ------------------------------------------------------------------ */

// IT Assets: frontend reads res.data.data and uses data.token as Bearer.
exports.itAssetsLogin = makeLoginHandler("it_assets", (user, token) => ({
  success: true,
  message: "Login successful",
  data: {
    userId: user._id,
    username: user.username,
    name: user.name,
    role: user.role,
    department: user.department,
    location: user.location || "",
    permissions: user.getPermissions(),
    allowedPortals: ROLE_PORTALS[user.role] || [],
    token,
  },
}));

// Job Portal (HR): frontend reads { token, message }.
exports.hrPortalLogin = makeLoginHandler("hr_portal", (user, token) => ({
  token,
  message: "Login successful",
  user: {
    id: user._id,
    username: user.username,
    name: user.name,
    role: user.role,
    permissions: user.getPermissions(),
  },
}));

// Origin Charges / Freight Pro: frontend reads data.token.
exports.originLogin = makeLoginHandler("origin_charges", (user, token) => ({
  token,
  message: "Login successful",
  role: user.role,
  username: user.username,
  name: user.name,
  permissions: user.getPermissions(),
}));

// ISF Filing: new endpoint (this portal previously had no backend auth).
exports.isfLogin = makeLoginHandler("isf", (user, token) => ({
  success: true,
  token,
  message: "Login successful",
  user: {
    id: user._id,
    username: user.username,
    name: user.name,
    role: user.role,
    permissions: user.getPermissions(),
  },
}));

/* ------------------------------------------------------------------ */
/* Session helpers                                                     */
/* ------------------------------------------------------------------ */

/** GET /me — current user, used by the frontends to validate a stored token. */
exports.me = async (req, res) => {
  const u = req.portalUser;
  res.json({
    success: true,
    data: {
      id: u._id,
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
    },
  });
};

/**
 * SELF-SERVICE PASSWORD CHANGE HAS BEEN REMOVED.
 *
 * Users cannot change or reset their own password. Password management is
 * exclusively an IT Admin function, performed from User Management in the IT
 * Assets portal:
 *   POST /api/admin/users                    (set the password at creation)
 *   POST /api/admin/users/:id/reset-password (reset an existing password)
 * Both routes are guarded by requireAuth + requireUserManager ("it_admin").
 */

exports.signToken = signToken;
