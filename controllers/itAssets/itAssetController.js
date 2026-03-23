const { validationResult } = require('express-validator');
const XLSX = require('xlsx');
const Asset = require('../../models/itAssets/ITAsset');

// Column header mapping for Excel/CSV import
const COLUMN_MAP = {
  'company name': 'companyName', company: 'companyName', organization: 'companyName',
  branch: 'branch', location: 'branch', site: 'branch', office: 'branch',
  department: 'department', dept: 'department', division: 'department',
  'user name': 'userName', user: 'userName', 'employee name': 'userName', 'assigned to': 'userName',
  brand: 'brand', make: 'brand', manufacturer: 'brand',
  device: 'device', 'device type': 'device', type: 'device', category: 'device',
  'device serial no': 'deviceSerialNo', 'device s.no': 'deviceSerialNo', 'serial no': 'deviceSerialNo',
  'date of purchase': 'dateOfPurchase', 'purchase date': 'dateOfPurchase', date: 'dateOfPurchase',
  os: 'operatingSystem', 'operating system': 'operatingSystem',
  remark: 'remark', remarks: 'remark', notes: 'remark', comment: 'remark',
  status: 'status', state: 'status', condition: 'status',
};

function mapRow(raw) {
  const mapped = {};
  for (const [header, value] of Object.entries(raw)) {
    const key = COLUMN_MAP[header.trim().toLowerCase()];
    if (key) mapped[key] = value != null ? String(value).trim() : undefined;
  }
  return mapped;
}

function fillDefaults(obj) {
  obj.companyName = obj.companyName || 'NA';
  obj.branch = obj.branch || 'NA';
  obj.department = obj.department || 'NA';
  obj.userName = obj.userName || 'NA';
  obj.brand = obj.brand || 'NA';
  obj.deviceSerialNo = obj.deviceSerialNo || 'NA';
  obj.operatingSystem = obj.operatingSystem || 'NA';
  obj.status = obj.status || 'Active';
  if (!obj.device || !Asset.DEVICE_TYPES.includes(obj.device)) obj.device = 'Other';
  return obj;
}

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
}

// ---------- CRUD ----------

// POST /api/v1/assets
exports.createAsset = async (req, res, next) => {
  try {
    if (!handleValidation(req, res)) return;
    const data = fillDefaults({ ...req.body });
    if (!req.body.createdBy) {
      return res.status(400).json({ success: false, message: 'createdBy (userId) is required' });
    }
    data.createdBy = req.body.createdBy;

    // Retry loop to handle duplicate serial number race conditions
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        data.serialNumber = await Asset.generateSerialNumber(data.companyName);
        const asset = await Asset.create(data);
        return res.status(201).json({ success: true, data: asset });
      } catch (err) {
        if (err.code === 11000 && attempt < MAX_RETRIES) continue; // duplicate key — retry
        throw err;
      }
    }
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/assets
exports.getAllAssets = async (req, res, next) => {
  try {
    if (!handleValidation(req, res)) return;

    const {
      page = 1, limit = 20, sortBy = 'createdAt', order = 'desc',
      search, companyName, branch, department, status, device, brand,
      dateFrom, dateTo,
    } = req.query;

    const filter = { isDeleted: false };

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { serialNumber: regex }, { companyName: regex },
        { branch: regex }, { department: regex },
        { userName: regex }, { brand: regex },
        { deviceSerialNo: regex },
      ];
    }
    if (companyName) filter.companyName = { $in: companyName.split(',').map((s) => new RegExp(`^${s.trim()}$`, 'i')) };
    if (branch) filter.branch = new RegExp(`^${branch}$`, 'i');
    if (department) filter.department = new RegExp(`^${department}$`, 'i');
    if (status) filter.status = status;
    if (device) filter.device = device;
    if (brand) filter.brand = new RegExp(`^${brand}$`, 'i');
    if (dateFrom || dateTo) {
      filter.dateOfPurchase = {};
      if (dateFrom) filter.dateOfPurchase.$gte = new Date(dateFrom);
      if (dateTo) filter.dateOfPurchase.$lte = new Date(dateTo);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;
    const sortOrder = order === 'asc' ? 1 : -1;

    const [assets, total] = await Promise.all([
      Asset.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limitNum).lean(),
      Asset.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: assets,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/assets/:id
exports.getAssetById = async (req, res, next) => {
  try {
    if (!handleValidation(req, res)) return;
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    res.json({ success: true, data: asset });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/assets/:id
exports.updateAsset = async (req, res, next) => {
  try {
    if (!handleValidation(req, res)) return;
    const { serialNumber, createdBy, isDeleted, ...updateData } = req.body;
    const asset = await Asset.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      updateData,
      { new: true, runValidators: true },
    );
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    res.json({ success: true, data: asset });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/assets/:id  (soft delete)
exports.deleteAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { new: true },
    );
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    res.json({ success: true, message: 'Asset soft-deleted', data: asset });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/assets/:id/permanent
exports.permanentDeleteAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findByIdAndDelete(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    res.json({ success: true, message: 'Asset permanently deleted' });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/assets/serial/:serialNumber
exports.getAssetBySerial = async (req, res, next) => {
  try {
    if (!handleValidation(req, res)) return;
    const asset = await Asset.findOne({ serialNumber: req.params.serialNumber, isDeleted: false });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    res.json({ success: true, data: asset });
  } catch (err) {
    next(err);
  }
};

// ---------- Stats / Filters / Export ----------

// GET /api/v1/assets/stats/overview
// GET /api/v1/itAssets/assets/stats/navbar-counts
exports.getNavbarCounts = async (req, res, next) => {
  try {
    const result = await Asset.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: null,
          totalAssets: { $sum: 1 },
          totalLaptops: { $sum: { $cond: [{ $eq: ['$device', 'Laptop'] }, 1, 0] } },
          totalDesktops: { $sum: { $cond: [{ $eq: ['$device', 'Desktop'] }, 1, 0] } },
          totalPrinters: { $sum: { $cond: [{ $eq: ['$device', 'Printer'] }, 1, 0] } },
        },
      },
    ]);

    const counts = result[0] || { totalAssets: 0, totalLaptops: 0, totalDesktops: 0, totalPrinters: 0 };
    delete counts._id;

    res.json({ success: true, data: counts });
  } catch (err) {
    next(err);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const [statusCounts, deviceCounts, companyCounts, totalActive, totalAll] = await Promise.all([
      Asset.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Asset.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$device', count: { $sum: 1 } } },
      ]),
      Asset.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$companyName', count: { $sum: 1 } } },
      ]),
      Asset.countDocuments({ isDeleted: false }),
      Asset.countDocuments({}),
    ]);

    res.json({
      success: true,
      data: {
        totalActive,
        totalAll,
        totalDeleted: totalAll - totalActive,
        byStatus: statusCounts,
        byDevice: deviceCounts,
        byCompany: companyCounts,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/assets/filters
exports.getFilters = async (req, res, next) => {
  try {
    const [companies, branches, departments, brands, devices, statuses] = await Promise.all([
      Asset.distinct('companyName', { isDeleted: false }),
      Asset.distinct('branch', { isDeleted: false }),
      Asset.distinct('department', { isDeleted: false }),
      Asset.distinct('brand', { isDeleted: false }),
      Asset.distinct('device', { isDeleted: false }),
      Asset.distinct('status', { isDeleted: false }),
    ]);
    res.json({ success: true, data: { companies, branches, departments, brands, devices, statuses } });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/assets/export
exports.exportAssets = async (req, res, next) => {
  try {
    const filter = { isDeleted: false };
    if (req.query.companyName) filter.companyName = req.query.companyName;
    if (req.query.branch) filter.branch = req.query.branch;
    if (req.query.department) filter.department = req.query.department;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.device) filter.device = req.query.device;

    const assets = await Asset.find(filter).sort({ createdAt: -1 }).lean();

    // Build rows with clean column headers
    const rows = assets.map((a, i) => ({
      'S.No': i + 1,
      'Serial Number': a.serialNumber || '',
      'Company Name': a.companyName || '',
      'Branch': a.branch || '',
      'Department': a.department || '',
      'User Name': a.userName || '',
      'Brand': a.brand || '',
      'Device': a.device || '',
      'Device Serial No': a.deviceSerialNo || '',
      'Operating System': a.operatingSystem || '',
      'Date of Purchase': a.dateOfPurchase ? new Date(a.dateOfPurchase).toLocaleDateString('en-IN') : '',
      'Status': a.status || '',
      'Remark': a.remark || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto-fit column widths based on content
    const headers = Object.keys(rows[0] || {});
    worksheet['!cols'] = headers.map((h) => {
      let maxLen = h.length;
      for (const row of rows) {
        const val = String(row[h] || '');
        if (val.length > maxLen) maxLen = val.length;
      }
      return { wch: Math.min(maxLen + 2, 40) };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IT Assets');

    // Write to buffer as a real xlsx file
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = `IT_Assets_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/assets/generate-serial/:companyName
exports.generateSerial = async (req, res, next) => {
  try {
    const serial = await Asset.generateSerialNumber(req.params.companyName);
    res.json({ success: true, data: { serialNumber: serial } });
  } catch (err) {
    next(err);
  }
};

// ---------- Bulk ----------

// POST /api/v1/assets/bulk
exports.bulkCreate = async (req, res, next) => {
  try {
    if (!handleValidation(req, res)) return;
    const { assets, createdBy } = req.body;
    if (!createdBy) return res.status(400).json({ success: false, message: 'createdBy is required' });

    const results = [];
    for (const item of assets) {
      const data = fillDefaults({ ...item });
      data.serialNumber = await Asset.generateSerialNumber(data.companyName);
      data.createdBy = createdBy;
      results.push(data);
    }

    const created = await Asset.insertMany(results, { ordered: false });
    res.status(201).json({ success: true, count: created.length, data: created });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/assets/upload-excel
exports.uploadExcel = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded. Use field name "file".' });
    }
    const { createdBy } = req.body;
    if (!createdBy) return res.status(400).json({ success: false, message: 'createdBy is required' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'File contains no data rows' });
    }
    if (rows.length > 5000) {
      return res.status(400).json({ success: false, message: 'Maximum 5000 records per upload' });
    }

    const docs = [];
    for (const raw of rows) {
      const mapped = fillDefaults(mapRow(raw));
      mapped.serialNumber = await Asset.generateSerialNumber(mapped.companyName);
      mapped.createdBy = createdBy;
      docs.push(mapped);
    }

    const created = await Asset.insertMany(docs, { ordered: false });
    res.status(201).json({ success: true, count: created.length, data: created });
  } catch (err) {
    next(err);
  }
};
