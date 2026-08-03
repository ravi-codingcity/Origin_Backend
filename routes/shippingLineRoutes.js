const express = require("express");
const router = express.Router();

const { requireAuth, requirePortal } = require("../middleware/portalAuth");
const {
  listShippingLines,
  createShippingLine,
} = require("../controllers/shippingLineController");

// Shipping lines belong to the Origin Charges module.
// (IT Admins pass requirePortal by design.)
const originAuth = [requireAuth, requirePortal("origin_charges")];

router.get("/", originAuth, listShippingLines);
router.post("/", originAuth, createShippingLine);

module.exports = router;
