const express = require("express");
const router = express.Router();

const {
  formRules,
  objectIdRules,
  searchRules,
  handleValidationErrors,
} = require("../../middleware/ISF_filing/isfFilingValidator");
const {
  createForm,
  getForms,
  getFormsArray,
  searchForms,
  getFormById,
  updateForm,
  patchForm,
  deleteForm,
} = require("../../controllers/ISF_filing/isfFilingController");

// Health/test
router.post("/test", (req, res) => {
  res.status(200).json({ success: true, message: "Test endpoint working", received: req.body });
});

// Raw array (frontend table convenience)
router.get("/all", getFormsArray);

// Search (must precede "/:id")
router.get("/search", searchRules, handleValidationErrors, searchForms);

// CRUD
router.post("/", formRules, handleValidationErrors, createForm);
router.get("/", getForms);
router.get("/:id", objectIdRules, handleValidationErrors, getFormById);
router.put("/:id", objectIdRules, formRules, handleValidationErrors, updateForm);
router.patch("/:id", objectIdRules, formRules, handleValidationErrors, patchForm);
router.delete("/:id", objectIdRules, handleValidationErrors, deleteForm);

module.exports = router;
