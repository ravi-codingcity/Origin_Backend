const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const { requireAuth, requireUserManager } = require("../middleware/portalAuth");
const ctrl = require("../controllers/userManagementController");

// Throttle write operations to blunt scripted abuse of an admin token.
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please slow down" },
});

// EVERY route below requires a valid token AND a user-management role.
router.use(requireAuth, requireUserManager);

router.get("/users/meta", ctrl.getMeta);
router.get("/users", ctrl.listUsers);
router.post("/users", writeLimiter, ctrl.createUser);
router.put("/users/:id", writeLimiter, ctrl.updateUser);
router.post("/users/:id/reset-password", writeLimiter, ctrl.resetPassword);
router.patch("/users/:id/status", writeLimiter, ctrl.setUserStatus);
router.delete("/users/:id", writeLimiter, ctrl.deleteUser);

router.get("/audit-logs", ctrl.getAuditLogs);

module.exports = router;
