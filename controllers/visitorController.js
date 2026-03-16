const Visitor = require('../models/Visitor');

// POST /api/visitor/hit — increment and return count
exports.recordVisit = async (req, res, next) => {
  try {
    const visitor = await Visitor.findOneAndUpdate(
      { site: 'omtrans' },
      { $inc: { count: 1 } },
      { new: true, upsert: true }
    );
    res.json({ success: true, count: visitor.count });
  } catch (err) {
    next(err);
  }
};

// GET /api/visitor/count — get current count without incrementing
exports.getCount = async (req, res, next) => {
  try {
    const visitor = await Visitor.findOne({ site: 'omtrans' }).lean();
    res.json({ success: true, count: visitor ? visitor.count : 0 });
  } catch (err) {
    next(err);
  }
};
