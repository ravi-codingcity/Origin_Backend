const { body, param, query, validationResult } = require("express-validator");

// All ISF filing text fields
const FIELDS = [
  "manufacturer_supplier",
  "seller",
  "buyer",
  "ship_to",
  "invoice_number",
  "invoice_date",
  "container_stuffing_location",
  "consolidator_export_forwarder",
  "country_origin",
  "htn",
  "vessel_name_voyage_number",
  "mbl_no",
  "hbl_no",
  "scac_code",
  "ams_no",
  "vessel_etd_port",
  "vessel_eta_port",
  "vessel_etd_date",
  "vessel_eta_date",
  "container_no",
  "commodity_description_of_goods",
];

// Strip HTML tags and collapse whitespace
const stripHtml = (value) =>
  typeof value === "string"
    ? value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
    : value;

// Every field is optional; sanitise and cap length when present.
const formRules = FIELDS.map((field) =>
  body(field)
    .optional()
    .customSanitizer(stripHtml)
    .isLength({ max: 2000 })
    .withMessage(`${field} must be at most 2000 characters`)
);

const objectIdRules = [
  param("id").isMongoId().withMessage("Invalid form ID format"),
];

const searchRules = [
  query("q")
    .notEmpty().withMessage("Search query is required")
    .isLength({ min: 2 }).withMessage("Search query must be at least 2 characters long"),
  query("fields")
    .optional()
    .custom((value) => value.split(",").every((f) => FIELDS.includes(f.trim())))
    .withMessage("Invalid search fields"),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Please check your input data",
      details: errors.array(),
    });
  }
  next();
};

module.exports = {
  FIELDS,
  formRules,
  objectIdRules,
  searchRules,
  handleValidationErrors,
};
