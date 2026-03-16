const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

  res.json({
    success: true,
    message: 'IT Assets API is running',
    timestamp: new Date().toISOString(),
    database: dbStatus[dbState] || 'unknown',
    uptime: process.uptime(),
  });
});

module.exports = router;
