const { body, param } = require("express-validator");

// Strip HTML tags / collapse whitespace from free-text fields
const stripHtml = (value) =>
  typeof value === "string"
    ? value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
    : value;

const loginRules = [
  body("username")
    .isString().withMessage("username is required")
    .trim()
    .notEmpty().withMessage("username is required")
    .isLength({ max: 120 }).withMessage("username too long"),
  body("password")
    .isString().withMessage("password is required")
    .notEmpty().withMessage("password is required")
    .isLength({ max: 200 }).withMessage("password too long"),
];

const signupRules = [
  body("username")
    .isString().withMessage("username is required")
    .trim()
    .notEmpty().withMessage("username is required")
    .isLength({ min: 3, max: 120 }).withMessage("username must be 3-120 characters"),
  body("password")
    .isString().withMessage("password is required")
    .isLength({ min: 8, max: 200 }).withMessage("password must be at least 8 characters"),
  body("signupSecret")
    .isString().withMessage("signupSecret is required")
    .notEmpty().withMessage("signupSecret is required"),
];

const createJobRules = [
  body("title")
    .isString().withMessage("title is required")
    .customSanitizer(stripHtml)
    .notEmpty().withMessage("title is required")
    .isLength({ max: 200 }).withMessage("title must be at most 200 characters"),
  body("location")
    .isString().withMessage("location is required")
    .customSanitizer(stripHtml)
    .notEmpty().withMessage("location is required")
    .isLength({ max: 160 }).withMessage("location must be at most 160 characters"),
  body("description")
    .isString().withMessage("description is required")
    .customSanitizer(stripHtml)
    .notEmpty().withMessage("description is required")
    .isLength({ max: 5000 }).withMessage("description must be at most 5000 characters"),
  body("department")
    .optional()
    .customSanitizer(stripHtml)
    .isLength({ max: 120 }).withMessage("department must be at most 120 characters"),
  body("experience")
    .optional()
    .customSanitizer(stripHtml)
    .isLength({ max: 80 }).withMessage("experience must be at most 80 characters"),
  body("salaryRange")
    .optional()
    .customSanitizer(stripHtml)
    .isLength({ max: 120 }).withMessage("salaryRange must be at most 120 characters"),
  body("employmentType")
    .optional()
    .isIn(["Full-time", "Part-time", "Contract", "Internship", "Temporary"])
    .withMessage("Invalid employmentType"),
  body("status")
    .optional()
    .isIn(["active", "inactive"]).withMessage("Invalid status"),
  body("responsibilities")
    .optional()
    .isArray().withMessage("responsibilities must be an array"),
  body("responsibilities.*")
    .optional()
    .customSanitizer(stripHtml)
    .isLength({ max: 500 }).withMessage("each responsibility must be at most 500 characters"),
  body("requirements")
    .optional()
    .isArray().withMessage("requirements must be an array"),
  body("requirements.*")
    .optional()
    .customSanitizer(stripHtml)
    .isLength({ max: 500 }).withMessage("each requirement must be at most 500 characters"),
];

const updateJobRules = [
  param("id").isMongoId().withMessage("Invalid job ID"),
  ...createJobRules.map((rule) => rule), // same field rules
];

const jobIdRules = [param("id").isMongoId().withMessage("Invalid job ID")];

module.exports = {
  loginRules,
  signupRules,
  createJobRules,
  updateJobRules,
  jobIdRules,
};
