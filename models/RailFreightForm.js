const mongoose = require("mongoose");

const railFreightFormSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    por: {
      type: String,
      required: true,
      trim: true,
    },
    pol: {
      type: String,
      required: true,
      trim: true,
    },

    shipping_lines: {
      type: String,
      required: true,
      trim: true,
    },
    container_type: {
      type: String,
      required: true,
      trim: true,
    },
    weight20ft0_10: {
      type: String,
      default: 0,
    },
    weight20ft10_20: {
      type: String,
      default: 0,
    },
    weight20ft20Plus: {
      type: String,
      default: 0,
    },
    weight40ft10_20: {
      type: String,
      default: 0,
    },
    weight40ft20Plus: {
      type: String,
      default: 0,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("RailFreightForm", railFreightFormSchema);
