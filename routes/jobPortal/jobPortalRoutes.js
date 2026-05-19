const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const jobAuth = require("../../middleware/jobPortal/jobAuth");
const {
  loginRules,
  createJobRules,
  updateJobRules,
  jobIdRules,
} = require("../../middleware/jobPortal/jobValidator");
const { login } = require("../../controllers/jobPortal/jobAuthController");
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

// --- Auth ---
router.post("/login", loginLimiter, loginRules, login);

// --- Public reads ---
router.get("/jobs", getJobs);
router.get("/jobs/:id", jobIdRules, getJobById);

// --- HR-protected writes ---
router.post("/jobs", jobAuth, createJobRules, createJob);
router.put("/jobs/:id", jobAuth, updateJobRules, updateJob);
router.delete("/jobs/:id", jobAuth, jobIdRules, deleteJob);

module.exports = router;
