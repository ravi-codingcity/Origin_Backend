const express = require("express");
const router = express.Router();
// Update the auth middleware path - it's likely in a different location
const auth = require("../middleware/authMiddleware");
const {
  createForm,
  editForm,
  deleteForm,
  getAllForms,
  getUserForms,
} = require("../controllers/RailfreightformController");

// Create new rail freight form (protected route)
router.post("/create", auth, createForm);

// Get all rail freight forms
router.get("/all", getAllForms);

// Get user's rail freight forms (protected route)
router.get("/user", auth, getUserForms);

// Edit a rail freight form (protected route)
router.put("/:id", auth, editForm);

// Delete a rail freight form (protected route)
router.delete("/:id", auth, deleteForm);

module.exports = router;
