const express = require('express');
const router = express.Router();
const { recordVisit, getCount } = require('../controllers/visitorController');

// POST — increment visitor count (call on page load)
router.post('/hit', recordVisit);

// GET — read current count without incrementing
router.get('/count', getCount);

module.exports = router;
