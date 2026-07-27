const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const DB_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

// GET /health — liveness: responds 200 whenever the API process is up
router.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;

  res.json({
    success: true,
    status: 'ok',
    message: 'API backend is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: DB_STATES[dbState] || 'unknown',
  });
});

// GET /health/ready — readiness: 503 unless dependencies (DB) are usable
router.get('/ready', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbConnected = dbState === 1;

  res.status(dbConnected ? 200 : 503).json({
    success: dbConnected,
    status: dbConnected ? 'ready' : 'not ready',
    message: dbConnected
      ? 'API backend and database are ready'
      : 'Database is not connected',
    timestamp: new Date().toISOString(),
    database: DB_STATES[dbState] || 'unknown',
  });
});

module.exports = router;
