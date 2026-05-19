const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    department: { type: String, trim: true, maxlength: 120, default: "" },
    location: { type: String, required: true, trim: true, maxlength: 160 },
    employmentType: {
      type: String,
      enum: ["Full-time", "Part-time", "Contract", "Internship", "Temporary"],
      default: "Full-time",
    },
    experience: { type: String, trim: true, maxlength: 80, default: "" },
    salaryRange: { type: String, trim: true, maxlength: 120, default: "" },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    responsibilities: { type: [String], default: [] },
    requirements: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    datePosted: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Job = mongoose.model("JobPortal_Job", jobSchema);

module.exports = Job;
