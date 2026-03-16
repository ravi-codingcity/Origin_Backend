const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema(
  {
    site: {
      type: String,
      required: true,
      unique: true,
      default: 'omtrans',
      index: true,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Visitor', visitorSchema);
