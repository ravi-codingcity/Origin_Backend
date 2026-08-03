const ShippingLine = require("../models/ShippingLine");
const { normalizeShippingLine, cleanDisplayName } = require("../models/ShippingLine");

/**
 * Shipping line suggestions for the Origin Charges module.
 * Users can pick an existing line or add a new one; duplicates are rejected
 * case-insensitively and whitespace-insensitively.
 */

/* ------------------------------------------------------------------ */
/* GET /api/origin/shipping-lines                                      */
/* ------------------------------------------------------------------ */
exports.listShippingLines = async (req, res, next) => {
  try {
    // Alphabetical, case-insensitive — normalizedName is already lowercase.
    const lines = await ShippingLine.find({}).sort({ normalizedName: 1 });
    res.json({
      success: true,
      count: lines.length,
      data: lines.map((l) => l.name),
    });
  } catch (err) {
    next(err);
  }
};

/* ------------------------------------------------------------------ */
/* POST /api/origin/shipping-lines   { name }                          */
/* ------------------------------------------------------------------ */
exports.createShippingLine = async (req, res, next) => {
  try {
    const raw = req.body?.name;
    const display = cleanDisplayName(raw);
    const normalized = normalizeShippingLine(raw);

    if (!normalized) {
      return res
        .status(400)
        .json({ success: false, message: "Shipping line name is required" });
    }
    if (display.length > 120) {
      return res.status(400).json({
        success: false,
        message: "Shipping line name must be 120 characters or fewer",
      });
    }

    // Duplicate check ignores case and extra whitespace.
    const existing = await ShippingLine.findOne({ normalizedName: normalized });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This Shipping Line already exists. Please select it from the dropdown.",
        data: existing.name,
      });
    }

    const line = await ShippingLine.create({
      name: display,
      createdBy: req.portalUser?._id || req.user?.id || null,
    });

    res.status(201).json({
      success: true,
      message: "Shipping line added successfully",
      data: line.name,
    });
  } catch (err) {
    // Unique index race: another request inserted the same value first.
    if (err && err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This Shipping Line already exists. Please select it from the dropdown.",
      });
    }
    next(err);
  }
};
