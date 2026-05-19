const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const hrUserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: "hr" },
  },
  { timestamps: true }
);

// Compare a plaintext candidate against the stored bcrypt hash
hrUserSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

const HRUser = mongoose.model("JobPortal_HRUser", hrUserSchema);

module.exports = HRUser;
