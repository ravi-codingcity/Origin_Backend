const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const {
  loginRules,
  createJobRules,
  updateJobRules,
  jobIdRules,
} = require("../../middleware/jobPortal/jobValidator");
const { hrPortalLogin, me } = require("../../controllers/portalAuthController");
const { requireAuth, requireDepartment } = require("../../middleware/portalAuth");

// HR writes require a valid token AND membership of the HR portal
// (admins/super admins pass through requireDepartment by design).
const hrAuth = [requireAuth, requireDepartment("hr_portal")];
const {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
} = require("../../controllers/jobPortal/jobController");

// Brute-force protection on login: 5 requests / minute / IP
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later" },
});

/**
 * PUBLIC / SECRET-GATED SIGNUP HAS BEEN REMOVED.
 * HR Portal accounts are created only by an Admin via the protected
 * user-management API (/api/admin/users).
 */

// --- Auth ---
router.post("/login", loginLimiter, loginRules, hrPortalLogin);
router.get("/me", requireAuth, me);

// --- Public reads ---
router.get("/jobs", getJobs);
router.get("/jobs/:id", jobIdRules, getJobById);

// --- HR-protected writes ---
router.post("/jobs", hrAuth, createJobRules, createJob);
router.put("/jobs/:id", hrAuth, updateJobRules, updateJob);
router.delete("/jobs/:id", hrAuth, jobIdRules, deleteJob);

module.exports = router;
