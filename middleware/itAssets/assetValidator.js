const { body, param, query } = require('express-validator');

const createAssetRules = [
  body('companyName')
    .optional()
    .isString().withMessage('companyName must be a string')
    .trim(),
  body('branch')
    .optional()
    .isString().withMessage('branch must be a string')
    .trim(),
  body('department')
    .optional()
    .isString().withMessage('department must be a string')
    .trim(),
  body('userName')
    .optional()
    .isString().withMessage('userName must be a string')
    .trim(),
  body('brand')
    .optional()
    .isString().withMessage('brand must be a string')
    .trim(),
  body('device')
    .optional()
    .isIn(['Desktop', 'Laptop', 'Printer', 'Scanner', 'Server', 'Router', 'Switch', 'Tablet', 'Phone', 'Monitor', 'Other'])
    .withMessage('Invalid device type'),
  body('deviceSerialNo')
    .optional()
    .isString().withMessage('deviceSerialNo must be a string')
    .trim(),
  body('operatingSystem')
    .optional()
    .isString().withMessage('operatingSystem must be a string')
    .trim(),
  body('dateOfPurchase')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('dateOfPurchase must be a valid date'),
  body('remark')
    .optional()
    .isString().withMessage('remark must be a string')
    .isLength({ max: 500 }).withMessage('remark must be at most 500 characters'),
  body('status')
    .optional()
    .isIn(['Active', 'Inactive', 'Under Maintenance', 'Disposed', 'Lost'])
    .withMessage('Invalid status'),
];

const updateAssetRules = [
  param('id').isMongoId().withMessage('Invalid asset ID'),
  ...createAssetRules,
];

const getAssetByIdRules = [
  param('id').isMongoId().withMessage('Invalid asset ID'),
];

const getAssetBySerialRules = [
  param('serialNumber')
    .notEmpty().withMessage('Serial number is required')
    .trim(),
];

const listAssetsRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('sortBy').optional().isString(),
  query('order').optional().isIn(['asc', 'desc']).withMessage('order must be asc or desc'),
];

const bulkCreateRules = [
  body('assets')
    .isArray({ min: 1, max: 5000 })
    .withMessage('assets must be an array with 1 to 5000 items'),
];

module.exports = {
  createAssetRules,
  updateAssetRules,
  getAssetByIdRules,
  getAssetBySerialRules,
  listAssetsRules,
  bulkCreateRules,
};
