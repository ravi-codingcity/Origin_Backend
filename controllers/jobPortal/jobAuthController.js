const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const HRUser = require("../../models/jobPortal/HRUser");

// POST /api/job-portal/signup
// Hidden (unlinked) HR account creation, gated by a shared secret.
// Body: { username, password, signupSecret }
exports.signup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const configuredSecret = process.env.HR_SIGNUP_SECRET;
  if (!configuredSecret) {
    // Fail closed: never allow open signup if the secret isn't configured.
    return res.status(503).json({ message: "Signup is disabled" });
  }

  const { username, password, signupSecret } = req.body;

  if (signupSecret !== configuredSecret) {
    return res.status(403).json({ message: "Invalid signup secret" });
  }

  try {
    const existing = await HRUser.findOne({ username });
    if (existing) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await HRUser.create({ username, passwordHash, role: "hr" });

    return res.status(201).json({ message: "HR account created successfully" });
  } catch (err) {
    console.error("Job portal signup error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/job-portal/login
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Invalid username or password" });
  }

  const { username, password } = req.body;

  try {
    const user = await HRUser.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.status(200).json({ token, message: "Login successful" });
  } catch (err) {
    console.error("Job portal login error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};
