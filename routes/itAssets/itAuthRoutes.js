const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const { itAssetsLogin, me } = require("../../controllers/portalAuthController");
const { requireAuth } = require("../../middleware/portalAuth");

// Brute-force protection: 5 login attempts / minute / IP
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts, please try again later" },
});

/**
 * PUBLIC SIGNUP AND PUBLIC PASSWORD RESET HAVE BEEN REMOVED.
 *
 * IT Assets accounts are created and reset only by an Admin / IT Admin via
 * the protected user-management API (/api/admin/users). The previous
 * unauthenticated POST /reset-password allowed anyone to change any user's
 * password and has been deleted.
 */
router.post("/login", loginLimiter, itAssetsLogin);

// Session check (read-only; password changes are IT Admin only)
router.get("/me", requireAuth, me);

module.exports = router;
