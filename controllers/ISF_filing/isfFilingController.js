const ISFFiling = require("../../models/ISF_filing/isfFilingModel");
const { FIELDS } = require("../../middleware/ISF_filing/isfFilingValidator");

// Default fields used by free-text search when none are specified
const DEFAULT_SEARCH_FIELDS = [
  "manufacturer_supplier",
  "seller",
  "buyer",
  "mbl_no",
  "hbl_no",
  "container_no",
  "invoice_number",
];

// CREATE - POST /
exports.createForm = async (req, res) => {
  try {
    const formData = {};
    FIELDS.forEach((field) => {
      formData[field] = req.body[field] || "";
    });

    const savedForm = await new ISFFiling(formData).save();

    return res.status(201).json({
      success: true,
      message: "Form created successfully",
      data: savedForm,
    });
  } catch (error) {
    console.error("Create ISF form error:", error.message);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to create form",
      details: error.message,
    });
  }
};

// READ ALL (wrapped) - GET /
exports.getForms = async (req, res) => {
  try {
    const forms = await ISFFiling.find().sort({ createdAt: -1 }).exec();
    return res.status(200).json({
      success: true,
      message: `Retrieved ${forms.length} forms successfully`,
      count: forms.length,
      data: forms,
    });
  } catch (error) {
    console.error("Get ISF forms error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "Failed to retrieve forms",
      details: error.message,
    });
  }
};

// READ ALL (raw array) - GET /all
exports.getFormsArray = async (req, res) => {
  try {
    const forms = await ISFFiling.find().sort({ createdAt: -1 });
    return res.status(200).json(forms);
  } catch (error) {
    console.error("Get ISF forms (array) error:", error.message);
    return res.status(500).json({
      error: "Failed to get forms",
      message: error.message,
    });
  }
};

// SEARCH - GET /search
exports.searchForms = async (req, res) => {
  try {
    const searchQuery = req.query.q;
    const searchFields = req.query.fields
      ? req.query.fields.split(",").map((f) => f.trim())
      : DEFAULT_SEARCH_FIELDS;

    const searchCriteria = {
      $or: searchFields.map((field) => ({
        [field]: { $regex: searchQuery, $options: "i" },
      })),
    };

    const forms = await ISFFiling.find(searchCriteria)
      .sort("-createdAt")
      .limit(50)
      .exec();

    return res.status(200).json({
      success: true,
      message: `Found ${forms.length} forms matching your search`,
      data: forms,
      searchQuery,
      searchFields,
    });
  } catch (error) {
    console.error("Search ISF forms error:", error.message);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to search forms",
    });
  }
};

// READ ONE - GET /:id
exports.getFormById = async (req, res) => {
  try {
    const form = await ISFFiling.findById(req.params.id);
    if (!form) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "Form not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Form retrieved successfully",
      data: form,
    });
  } catch (error) {
    console.error("Get ISF form error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "Failed to retrieve form",
      details: error.message,
    });
  }
};

// UPDATE (full) - PUT /:id
exports.updateForm = async (req, res) => {
  try {
    const updates = {};
    FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const form = await ISFFiling.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!form) {
      return res.status(404).json({ error: "Not Found", message: "Form not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Form updated successfully",
      data: form,
    });
  } catch (error) {
    console.error("Update ISF form error:", error.message);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation Error",
        message: "Please check your input data",
        details: Object.values(error.errors).map((e) => ({ field: e.path, message: e.message })),
      });
    }
    return res.status(500).json({ error: "Internal Server Error", message: "Failed to update form" });
  }
};

// PARTIAL UPDATE - PATCH /:id
exports.patchForm = async (req, res) => {
  try {
    const updates = {};
    FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: "No valid fields provided for update",
      });
    }

    const form = await ISFFiling.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!form) {
      return res.status(404).json({ error: "Not Found", message: "Form not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Form updated successfully",
      data: form,
    });
  } catch (error) {
    console.error("Patch ISF form error:", error.message);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation Error",
        message: "Please check your input data",
        details: Object.values(error.errors).map((e) => ({ field: e.path, message: e.message })),
      });
    }
    return res.status(500).json({ error: "Internal Server Error", message: "Failed to update form" });
  }
};

// DELETE - DELETE /:id
exports.deleteForm = async (req, res) => {
  try {
    const form = await ISFFiling.findByIdAndDelete(req.params.id);
    if (!form) {
      return res.status(404).json({ error: "Not Found", message: "Form not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Form deleted successfully",
      data: { deletedForm: form.getSummary() },
    });
  } catch (error) {
    console.error("Delete ISF form error:", error.message);
    return res.status(500).json({ error: "Internal Server Error", message: "Failed to delete form" });
  }
};
