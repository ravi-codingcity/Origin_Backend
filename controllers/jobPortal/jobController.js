const { validationResult } = require("express-validator");
const Job = require("../../models/jobPortal/Job");

const sendValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: errors.array()[0].msg });
    return true;
  }
  return false;
};

// GET /api/job-portal/jobs  (public)  — optional ?status=active
exports.getJobs = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const jobs = await Job.find(filter).sort({ datePosted: -1 });
    return res.status(200).json({ jobs });
  } catch (err) {
    console.error("getJobs error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/job-portal/jobs/:id  (public)
exports.getJobById = async (req, res) => {
  if (sendValidation(req, res)) return;
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    return res.status(200).json({ job });
  } catch (err) {
    console.error("getJobById error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/job-portal/jobs  (HR only)
exports.createJob = async (req, res) => {
  if (sendValidation(req, res)) return;
  try {
    const job = await Job.create(req.body);
    return res.status(201).json(job);
  } catch (err) {
    console.error("createJob error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/job-portal/jobs/:id  (HR only)
exports.updateJob = async (req, res) => {
  if (sendValidation(req, res)) return;
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    return res.status(200).json(job);
  } catch (err) {
    console.error("updateJob error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/job-portal/jobs/:id  (HR only)
exports.deleteJob = async (req, res) => {
  if (sendValidation(req, res)) return;
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    return res.status(204).send();
  } catch (err) {
    console.error("deleteJob error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};
