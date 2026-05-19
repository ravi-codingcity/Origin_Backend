const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const HRUser = require("../../models/jobPortal/HRUser");

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
