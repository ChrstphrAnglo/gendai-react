const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const MenuItem = require('../models/MenuItem');
const ActivityLog = require('../models/ActivityLog');
const asyncHandler = require('../utils/asyncHandler');

// Cancelled orders never count as sales, nor do take-out orders that were never paid for.
const COUNTED = { $nin: ['cancelled', 'awaiting_payment'] };
const CHANNEL_LABEL = { delivery: 'Delivery', dine_in: 'Dine in', takeout: 'Take out' };

const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const range = (from, to) => {
  const r = {};
  if (from) r.$gte = new Date(`${from}T00:00:00`);
  if (to) r.$lte = new Date(`${to}T23:59:59.999`);
  return Object.keys(r).length ? r : undefined;
};

exports.dashboard = asyncHandler(async (req, res) => {
  const today = dayStart(new Date());
  const weekAgo = dayStart(new Date(Date.now() - 6 * 86400000));

  const [todayAgg, statusAgg, daily, topItems, menuCount, unavailable] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: today }, status: COUNTED } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
    ]),
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { createdAt: { $gte: weekAgo }, status: COUNTED } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
    ]),
    OrderItem.aggregate([
      { $lookup: { from: 'orders', localField: 'order', foreignField: '_id', as: 'o' } },
      { $unwind: '$o' },
      { $match: { 'o.status': COUNTED } },
      { $group: { _id: '$menuItem', quantity: { $sum: '$quantity' }, revenue: { $sum: '$subtotal' } } },
      { $sort: { quantity: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'menuitems', localField: '_id', foreignField: '_id', as: 'm' } },
      { $unwind: '$m' },
      { $project: { _id: 1, name: '$m.name', quantity: 1, revenue: 1 } },
    ]),
    MenuItem.countDocuments(),
    MenuItem.countDocuments({ available: false }),
  ]);

  const byDay = Object.fromEntries(daily.map((d) => [d._id, d]));
  const series = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    series.push({ date: key, revenue: byDay[key]?.revenue || 0, orders: byDay[key]?.orders || 0 });
  }

  res.json({
    today: { revenue: todayAgg[0]?.revenue || 0, orders: todayAgg[0]?.orders || 0 },
    statusCounts: Object.fromEntries(statusAgg.map((s) => [s._id, s.n])),
    revenueSeries: series,
    topItems,
    menu: { total: menuCount, unavailable },
  });
});

// Sales report: grouped by day or by category, with grand totals.
exports.sales = asyncHandler(async (req, res) => {
  const { from, to, groupBy = 'day' } = req.query;
  const createdAt = range(from, to);
  const match = { status: COUNTED, ...(createdAt && { createdAt }) };

  let rows;
  if (groupBy === 'channel') {
    rows = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$channel', 'delivery'] },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          deliveryFees: { $sum: { $ifNull: ['$deliveryFee', 0] } },
        },
      },
      { $sort: { revenue: -1 } },
    ]);
    rows = rows.map((r) => ({ label: CHANNEL_LABEL[r._id] || r._id, orders: r.orders, revenue: r.revenue, deliveryFees: r.deliveryFees }));
  } else if (groupBy === 'category') {
    rows = await OrderItem.aggregate([
      { $lookup: { from: 'orders', localField: 'order', foreignField: '_id', as: 'o' } },
      { $unwind: '$o' },
      { $match: Object.fromEntries(Object.entries(match).map(([k, v]) => [`o.${k}`, v])) },
      { $lookup: { from: 'menuitems', localField: 'menuItem', foreignField: '_id', as: 'm' } },
      { $unwind: '$m' },
      { $lookup: { from: 'categories', localField: 'm.category', foreignField: '_id', as: 'c' } },
      { $unwind: '$c' },
      { $group: { _id: '$c.name', orders: { $addToSet: '$order' }, itemsSold: { $sum: '$quantity' }, revenue: { $sum: '$subtotal' } } },
      { $project: { _id: 0, label: '$_id', orders: { $size: '$orders' }, itemsSold: 1, revenue: 1 } },
      { $sort: { revenue: -1 } },
    ]);
  } else {
    rows = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          deliveryFees: { $sum: { $ifNull: ['$deliveryFee', 0] } },
        },
      },
      { $project: { _id: 0, label: '$_id', orders: 1, revenue: 1, deliveryFees: 1 } },
      { $sort: { label: 1 } },
    ]);
  }

  const totals = rows.reduce((t, r) => ({
    orders: t.orders + r.orders,
    revenue: Math.round((t.revenue + r.revenue) * 100) / 100,
    itemsSold: t.itemsSold + (r.itemsSold || 0),
    deliveryFees: Math.round((t.deliveryFees + (r.deliveryFees || 0)) * 100) / 100,
  }), { orders: 0, revenue: 0, itemsSold: 0, deliveryFees: 0 });

  res.json({ groupBy, from: from || null, to: to || null, rows, totals, generatedAt: new Date() });
});

exports.bestSellers = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const createdAt = range(from, to);

  const rows = await OrderItem.aggregate([
    { $lookup: { from: 'orders', localField: 'order', foreignField: '_id', as: 'o' } },
    { $unwind: '$o' },
    { $match: { 'o.status': COUNTED, ...(createdAt && { 'o.createdAt': createdAt }) } },
    { $group: { _id: '$menuItem', quantity: { $sum: '$quantity' }, revenue: { $sum: '$subtotal' } } },
    { $sort: { quantity: -1, revenue: -1 } },
    { $limit: limit },
    { $lookup: { from: 'menuitems', localField: '_id', foreignField: '_id', as: 'm' } },
    { $unwind: '$m' },
    { $lookup: { from: 'categories', localField: 'm.category', foreignField: '_id', as: 'c' } },
    { $unwind: '$c' },
    { $project: { _id: 1, name: '$m.name', category: '$c.name', quantity: 1, revenue: 1 } },
  ]);

  const totals = rows.reduce((t, r) => ({
    quantity: t.quantity + r.quantity,
    revenue: Math.round((t.revenue + r.revenue) * 100) / 100,
  }), { quantity: 0, revenue: 0 });

  res.json({ from: from || null, to: to || null, rows, totals, generatedAt: new Date() });
});

exports.activity = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const logs = await ActivityLog.find().populate('user', 'username role').sort({ createdAt: -1 }).limit(limit);
  res.json(logs);
});
