const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const { isfLogin, me } = require("../../controllers/portalAuthController");
const { requireAuth, requireDepartment } = require("../../middleware/portalAuth");
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

// Brute-force protection: 5 login attempts / minute / IP
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts, please try again later" },
});

/**
 * ISF accounts are created only by an Admin via /api/admin/users.
 * There is no registration endpoint.
 */
router.post("/login", loginLimiter, isfLogin);
router.get("/me", requireAuth, me);

// Every ISF filing route below requires an authenticated ISF user.
const isfAuth = [requireAuth, requireDepartment("isf")];

// Health/test
router.post("/test", (req, res) => {
  res.status(200).json({ success: true, message: "Test endpoint working", received: req.body });
});

// Raw array (frontend table convenience)
router.get("/all", isfAuth, getFormsArray);

// Search (must precede "/:id")
router.get("/search", isfAuth, searchRules, handleValidationErrors, searchForms);

// CRUD
router.post("/", isfAuth, formRules, handleValidationErrors, createForm);
router.get("/", isfAuth, getForms);
router.get("/:id", isfAuth, objectIdRules, handleValidationErrors, getFormById);
router.put("/:id", isfAuth, objectIdRules, formRules, handleValidationErrors, updateForm);
router.patch("/:id", isfAuth, objectIdRules, formRules, handleValidationErrors, patchForm);
router.delete("/:id", isfAuth, objectIdRules, handleValidationErrors, deleteForm);

module.exports = router;
