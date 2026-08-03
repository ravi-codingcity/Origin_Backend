const mongoose = require("mongoose");

/**
 * Shipping lines available to the Origin Charges module.
 *
 * Users may pick an existing line or type a new one. To keep the list clean,
 * every entry is stored twice:
 *   name           – the display value, exactly as the user typed it
 *   normalizedName – lowercase, trimmed, inner whitespace collapsed
 *
 * `normalizedName` carries a unique index, so "MAERSK", "Maersk", "maersk"
 * and "MAERSK  " can never coexist as separate records.
 */

/** Canonical form used for duplicate detection. */
function normalizeShippingLine(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Tidy the value we display: trimmed, inner whitespace collapsed. */
function cleanDisplayName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

const shippingLineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PortalUser",
      default: null,
    },
    // Static entries shipped with the app vs. lines added by users.
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Keep the two fields in sync no matter how the document is created.
shippingLineSchema.pre("validate", function (next) {
  if (this.name) {
    this.name = cleanDisplayName(this.name);
    this.normalizedName = normalizeShippingLine(this.name);
  }
  next();
});

const ShippingLine = mongoose.model("ShippingLine", shippingLineSchema);

module.exports = ShippingLine;
module.exports.normalizeShippingLine = normalizeShippingLine;
module.exports.cleanDisplayName = cleanDisplayName;
