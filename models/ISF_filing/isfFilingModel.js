const mongoose = require("mongoose");

const isfFilingSchema = new mongoose.Schema(
  {
    manufacturer_supplier: { type: String, trim: true, default: "" },
    seller: { type: String, trim: true, default: "" },
    buyer: { type: String, trim: true, default: "" },
    ship_to: { type: String, trim: true, default: "" },
    invoice_number: { type: String, trim: true, default: "" },
    invoice_date: { type: String, trim: true, default: "" },
    container_stuffing_location: { type: String, trim: true, default: "" },
    consolidator_export_forwarder: { type: String, trim: true, default: "" },
    country_origin: { type: String, trim: true, default: "" },
    htn: { type: String, trim: true, default: "" },
    vessel_name_voyage_number: { type: String, trim: true, default: "" },
    mbl_no: { type: String, trim: true, default: "" },
    hbl_no: { type: String, trim: true, default: "" },
    scac_code: { type: String, trim: true, default: "" },
    ams_no: { type: String, trim: true, default: "" },
    vessel_etd_port: { type: String, trim: true, default: "" },
    vessel_eta_port: { type: String, trim: true, default: "" },
    vessel_etd_date: { type: String, trim: true, default: "" },
    vessel_eta_date: { type: String, trim: true, default: "" },
    container_no: { type: String, trim: true, default: "" },
    commodity_description_of_goods: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for common query/sort paths
isfFilingSchema.index({ createdAt: -1 });
isfFilingSchema.index({ mbl_no: 1 });
isfFilingSchema.index({ hbl_no: 1 });
isfFilingSchema.index({ container_no: 1 });
isfFilingSchema.index({ vessel_etd_date: 1 });
isfFilingSchema.index({ vessel_eta_date: 1 });
isfFilingSchema.index({ invoice_date: 1 });

// Convenience virtual for the string id
isfFilingSchema.virtual("formId").get(function () {
  return this._id.toHexString();
});

// Normalise certain fields to uppercase before save
isfFilingSchema.pre("save", function (next) {
  ["scac_code", "country_origin"].forEach((field) => {
    if (this[field]) {
      this[field] = this[field].toUpperCase();
    }
  });
  next();
});

isfFilingSchema.statics.getFormsPaginated = function (page = 1, limit = 10, sortBy = "-createdAt") {
  const skip = (page - 1) * limit;
  return this.find().sort(sortBy).skip(skip).limit(limit).exec();
};

isfFilingSchema.methods.getSummary = function () {
  return {
    id: this._id,
    mbl_no: this.mbl_no,
    hbl_no: this.hbl_no,
    container_no: this.container_no,
    seller: this.seller,
    buyer: this.buyer,
    invoice_date: this.invoice_date,
    vessel_etd_date: this.vessel_etd_date,
    vessel_eta_date: this.vessel_eta_date,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const ISFFiling = mongoose.model("ISF_Filing", isfFilingSchema);

module.exports = ISFFiling;
