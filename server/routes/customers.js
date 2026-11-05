const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate, authorize('admin'));

// Read-only customer list with order counts.
router.get('/', asyncHandler(async (req, res) => {
  const [customers, counts] = await Promise.all([
    User.find({ role: 'customer' }).sort({ createdAt: -1 }).lean(),
    Order.aggregate([
      { $match: { customer: { $ne: null } } },
      { $group: { _id: '$customer', orders: { $sum: 1 } } },
    ]),
  ]);
  const byCustomer = Object.fromEntries(counts.map((c) => [String(c._id), c.orders]));
  res.json(customers.map((u) => ({
    id: u._id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    isActive: u.isActive,
    orders: byCustomer[String(u._id)] || 0,
    createdAt: u.createdAt,
  })));
}));

module.exports = router;
