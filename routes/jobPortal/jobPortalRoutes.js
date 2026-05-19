const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const jobAuth = require("../../middleware/jobPortal/jobAuth");
const {
  loginRules,
  createJobRules,
  updateJobRules,
  jobIdRules,
  signupRules,
} = require("../../middleware/jobPortal/jobValidator");
const { login, signup } = require("../../controllers/jobPortal/jobAuthController");
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

// Abuse protection on the hidden signup endpoint: 3 requests / 15 min / IP
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many signup attempts, please try again later" },
});

// --- Auth ---
router.post("/login", loginLimiter, loginRules, login);
router.post("/signup", signupLimiter, signupRules, signup);

// --- Public reads ---
router.get("/jobs", getJobs);
router.get("/jobs/:id", jobIdRules, getJobById);

// --- HR-protected writes ---
router.post("/jobs", jobAuth, createJobRules, createJob);
router.put("/jobs/:id", jobAuth, updateJobRules, updateJob);
router.delete("/jobs/:id", jobAuth, jobIdRules, deleteJob);

module.exports = router;
