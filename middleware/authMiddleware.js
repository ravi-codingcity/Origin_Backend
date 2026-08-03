const jwt = require("jsonwebtoken");
const PortalUser = require("../models/PortalUser");

/**
 * Auth guard for the Origin Charges / Rail Freight form routes.
 *
 * Those controllers read `req.user.id`, so this middleware normalises the JWT
 * payload into that shape. It accepts the current token format
 * ({ id, username, role, department }) as well as the legacy nested
 * ({ user: { id } }) format so old sessions do not hard-fail.
 *
 * Deactivated or deleted accounts are rejected immediately.
 */
module.exports = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.user?.id;

    if (!userId) {
      return res.status(401).json({ msg: "Token is not valid" });
    }

    // Re-read the account so revoked access takes effect immediately.
    const user = await PortalUser.findById(userId);
    if (user) {
      if (!user.isActive) {
        return res.status(401).json({ msg: "Account is deactivated" });
      }
      req.portalUser = user;
      req.user = {
        id: String(user._id),
        username: user.username,
        role: user.role,
        department: user.department,
        // Pre-role-based-auth records store the user's OLD account id in
        // `createdBy`. Expose both so ownership checks match historical data
        // as well as anything created since.
        legacyId: user.legacyUserId ? String(user.legacyUserId) : null,
        ownerIds: user.ownerIds(),
      };
      return next();
    }

    // Legacy token whose user is not in PortalUser — keep the id so existing
    // records remain accessible, but grant no elevated role.
    req.user = {
      id: String(userId),
      role: decoded.role || "user",
      legacyId: null,
      ownerIds: [userId],
    };
    next();
  } catch (err) {
    res.status(401).json({ msg: "Token is not valid" });
  }
};
