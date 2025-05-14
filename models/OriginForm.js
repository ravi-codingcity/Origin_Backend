const mongoose = require("mongoose");

const formSchema = new mongoose.Schema(
  {
    name: { type: String,  },
    por: { type: String, required: true },
    pol: { type: String, required: true },
    shipping_lines: { type: String, required: true },
    container_type: { type: String, required: true },
    bl_fees: { type: String },
    thc: { type: String },
    muc: { type: String },
    toll: { type: String },
    
    currency: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // Reference to User model
  },
  { timestamps: true }
);

const Form = mongoose.model("Origin_Form", formSchema);

module.exports = Form;
