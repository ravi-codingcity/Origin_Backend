const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const { originLogin, me } = require("../controllers/portalAuthController");
const { requireAuth } = require("../middleware/portalAuth");

// Brute-force protection: 5 login attempts / minute / IP
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later" },
});

/**
 * PUBLIC REGISTRATION HAS BEEN REMOVED.
 * Origin Charges (Freight Pro) accounts are created only by an Admin via the
 * protected user-management API (/api/admin/users).
 */
router.post("/login", loginLimiter, originLogin);

// Session check (read-only; password changes are IT Admin only)
router.get("/me", requireAuth, me);

// Session logout (kept for backward compatibility with the existing UI)
router.get("/logout", (req, res) => {
  if (req.session) {
    return req.session.destroy((err) => {
      if (err) return res.status(500).json({ msg: "Error logging out" });
      res.status(200).json({ msg: "Logout successful" });
    });
  }
  res.status(200).json({ msg: "Logout successful" });
});

module.exports = router;
