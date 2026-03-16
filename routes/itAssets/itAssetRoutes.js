const express = require('express');
const router = express.Router();
const multer = require('multer');
const ctrl = require('../../controllers/itAssets/itAssetController');
const {
  createAssetRules,
  updateAssetRules,
  getAssetByIdRules,
  getAssetBySerialRules,
  listAssetsRules,
  bulkCreateRules,
} = require('../../middleware/itAssets/assetValidator');

// Multer configured for in-memory buffer (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only .xlsx, .xls, and .csv files are allowed'));
  },
});

// --- Static routes first (before /:id) ---
router.get('/stats/navbar-counts', ctrl.getNavbarCounts);
router.get('/stats/overview', ctrl.getStats);
router.get('/filters', ctrl.getFilters);
router.get('/export', ctrl.exportAssets);
router.get('/generate-serial/:companyName', ctrl.generateSerial);
router.post('/bulk', bulkCreateRules, ctrl.bulkCreate);
router.post('/upload-excel', upload.single('file'), ctrl.uploadExcel);

// --- CRUD ---
router.get('/', listAssetsRules, ctrl.getAllAssets);
router.post('/', createAssetRules, ctrl.createAsset);
router.get('/serial/:serialNumber', getAssetBySerialRules, ctrl.getAssetBySerial);
router.get('/:id', getAssetByIdRules, ctrl.getAssetById);
router.put('/:id', updateAssetRules, ctrl.updateAsset);
router.delete('/:id', getAssetByIdRules, ctrl.deleteAsset);
router.delete('/:id/permanent', getAssetByIdRules, ctrl.permanentDeleteAsset);

module.exports = router;
