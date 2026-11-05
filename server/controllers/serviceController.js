// Staff side of dine-in and take-out: the kitchen ticket board and the front desk.
const Order = require('../models/Order');
const DiningSession = require('../models/DiningSession');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logActivity = require('../utils/logActivity');
const { withItems } = require('../utils/orders');
const { LIVE, sessionView, confirmPayment } = require('../utils/dining');

const peso = (n) => `₱${Number(n || 0).toFixed(2)}`;

const loadSession = async (id) => {
  const session = await DiningSession.findById(id);
  if (!session) throw new ApiError(404, 'Session not found', 'NOT_FOUND');
  return session;
};

// Everything the kitchen has to cook or hand over, oldest first. Unpaid take-out orders stay off the board.
exports.kitchen = asyncHandler(async (req, res) => {
  const orders = await Order.find({ status: { $in: ['preparing', 'ready'] } }).sort({ createdAt: 1 }).lean();
  res.json(await withItems(orders));
});

// Open tables, take-outs waiting for payment, and payment requests that need a person.
exports.frontDesk = asyncHandler(async (req, res) => {
  const live = await DiningSession.find({ status: { $in: LIVE } }).sort({ paymentRequestedAt: 1, createdAt: 1 });
  const views = (await Promise.all(live.map(sessionView))).filter((s) => s.orders.length > 0);
  const since = new Date(Date.now() - 12 * 3600 * 1000);
  const recent = await DiningSession.find({ status: 'paid', paidAt: { $gte: since } })
    .populate('handledBy', 'username').sort({ paidAt: -1 }).limit(15).lean();
  res.json({ sessions: views, recent });
});

// Small payload polled by every staff screen for the sidebar badges and alerts.
exports.summary = asyncHandler(async (req, res) => {
  const [requests, kitchen] = await Promise.all([
    DiningSession.find({ status: 'payment_pending' }, 'code kind tableLabel guestName paymentMethod totalAmount paymentRequestedAt').sort({ paymentRequestedAt: -1 }).lean(),
    Order.countDocuments({ status: 'preparing' }),
  ]);
  res.json({ paymentRequests: requests, kitchen });
});

exports.confirm = asyncHandler(async (req, res) => {
  const session = await loadSession(req.params.id);
  if (session.status === 'cancelled') throw new ApiError(400, 'This session was cancelled', 'SESSION_CANCELLED');
  const wasPaid = session.status === 'paid';
  await confirmPayment(session, req.user.id);
  if (!wasPaid) {
    await logActivity(req.user.id, 'TABLE_PAID', `${session.code} (${session.tableLabel}) ${session.paymentMethod} ${peso(session.totalAmount)}`);
  }
  res.json(await sessionView(session));
});

// Close a bill without payment (walk-out, test order, abandoned take-out). Its orders are cancelled.
exports.cancel = asyncHandler(async (req, res) => {
  const session = await loadSession(req.params.id);
  if (session.status === 'paid') throw new ApiError(400, 'A paid bill cannot be cancelled', 'SESSION_PAID');
  session.status = 'cancelled';
  session.handledBy = req.user.id;
  await session.save();
  await Order.updateMany({ session: session._id }, { $set: { status: 'cancelled', handledBy: req.user.id } });
  await logActivity(req.user.id, 'TABLE_CANCEL', `${session.code} (${session.tableLabel})`);
  res.json(await sessionView(session));
});
