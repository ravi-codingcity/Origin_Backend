const mongoose = require('mongoose');

const DEVICE_TYPES = ['Desktop', 'Laptop', 'Printer', 'Scanner', 'Server', 'Router', 'Switch', 'Tablet', 'Phone', 'Monitor', 'Other'];
const STATUS_TYPES = ['Active', 'Inactive', 'Under Maintenance', 'Disposed', 'Lost'];

const COMPANY_PREFIX_MAP = {
  omtrans: 'OMT',
  tgl: 'TGL',
  omtrax: 'OMX',
};

function getPrefix(companyName) {
  if (!companyName || companyName.trim() === '' || companyName.trim().toUpperCase() === 'NA') {
    return 'GEN';
  }
  const key = companyName.trim().toLowerCase();
  if (COMPANY_PREFIX_MAP[key]) return COMPANY_PREFIX_MAP[key];
  return companyName.trim().substring(0, 3).toUpperCase();
}

const assetSchema = new mongoose.Schema(
  {
    serialNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    companyName: {
      type: String,
      default: 'NA',
      trim: true,
      index: true,
    },
    branch: {
      type: String,
      default: 'NA',
      trim: true,
      index: true,
    },
    department: {
      type: String,
      default: 'NA',
      trim: true,
      index: true,
    },
    userName: {
      type: String,
      default: 'NA',
      trim: true,
    },
    brand: {
      type: String,
      default: 'NA',
      trim: true,
      index: true,
    },
    device: {
      type: String,
      enum: DEVICE_TYPES,
      default: 'Other',
    },
    deviceSerialNo: {
      type: String,
      default: 'NA',
      trim: true,
    },
    operatingSystem: {
      type: String,
      default: 'NA',
      trim: true,
    },
    dateOfPurchase: {
      type: Date,
      default: Date.now,
    },
    remark: {
      type: String,
      default: '',
      maxlength: 500,
    },
    status: {
      type: String,
      enum: STATUS_TYPES,
      default: 'Active',
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IT_User',
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index for serial number generation queries
assetSchema.index({ serialNumber: 1, companyName: 1 });

/**
 * Generate next serial number for a given company.
 * Format: PREFIX-DDMMYYYY-XXX (sequence is global per prefix, not per date).
 */
assetSchema.statics.generateSerialNumber = async function (companyName) {
  const prefix = getPrefix(companyName);
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const dateStr = `${dd}${mm}${yyyy}`;

  // Find ALL serial numbers for this prefix and determine highest sequence numerically
  const regex = new RegExp(`^${prefix}-\\d{8}-(\\d{3,})$`);
  const allMatches = await this.find({ serialNumber: regex })
    .select('serialNumber')
    .lean();

  let maxSeq = 0;
  for (const doc of allMatches) {
    const parts = doc.serialNumber.split('-');
    const seq = parseInt(parts[2], 10);
    if (seq > maxSeq) maxSeq = seq;
  }

  const seqStr = String(maxSeq + 1).padStart(3, '0');
  return `${prefix}-${dateStr}-${seqStr}`;
};

assetSchema.statics.DEVICE_TYPES = DEVICE_TYPES;
assetSchema.statics.STATUS_TYPES = STATUS_TYPES;
assetSchema.statics.getPrefix = getPrefix;

const Asset = mongoose.model('IT_Asset', assetSchema);

module.exports = Asset;
