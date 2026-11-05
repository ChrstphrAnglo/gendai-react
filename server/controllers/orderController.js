const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Setting = require('../models/Setting');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logActivity = require('../utils/logActivity');
const DiningSession = require('../models/DiningSession');
const { round2, priceItems, createOrder, withItems } = require('../utils/orders');
const { confirmPayment, refreshTotal } = require('../utils/dining');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isStaff = (user) => user.role === 'admin' || user.role === 'staff';

// Customers may only touch their own orders; a miss looks like "not found" so ids can't be probed.
const loadOrderFor = async (req) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found', 'NOT_FOUND');
  if (!isStaff(req.user) && String(order.customer) !== String(req.user.id)) {
    throw new ApiError(404, 'Order not found', 'NOT_FOUND');
  }
  return order;
};

exports.create = asyncHandler(async (req, res) => {
  const { customerName, contactPhone, deliveryAddress, paymentMethod, items } = req.body;
  const { lines, subtotal } = await priceItems(items);
  const { deliveryFee } = await Setting.get();

  const order = await createOrder({
    channel: 'delivery',
    customer: req.user.id,
    customerName,
    contactPhone,
    deliveryAddress,
    paymentMethod,
    paymentStatus: 'unpaid',
    deliveryFee,
    totalAmount: round2(subtotal + deliveryFee),
  }, lines);

  const [full] = await withItems([order.toObject()]);
  res.status(201).json({ ...full, subtotal });
});

exports.list = asyncHandler(async (req, res) => {
  const { status, channel, from, to, search } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (channel) filter.channel = channel;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00`);
    if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999`);
  }
  if (search) {
    const rx = new RegExp(escapeRegex(String(search)), 'i');
    filter.$or = [{ customerName: rx }, { orderNo: rx }, { tableLabel: rx }];
  }
  const orders = await Order.find(filter).populate('handledBy', 'username').sort({ createdAt: -1 }).lean();
  res.json(await withItems(orders));
});

// The logged-in customer's own order history.
exports.mine = asyncHandler(async (req, res) => {
  const orders = await Order.find({ customer: req.user.id }).sort({ createdAt: -1 }).lean();
  res.json(await withItems(orders));
});

exports.get = asyncHandler(async (req, res) => {
  const order = await loadOrderFor(req);
  const [full] = await withItems([order.toObject()]);
  res.json(full);
});

// Which statuses each kind of order can be moved to by staff.
const STATUS_FLOW = {
  delivery: ['preparing', 'out_for_delivery', 'delivered', 'cancelled'],
  dine_in: ['preparing', 'ready', 'served', 'cancelled'],
  takeout: ['preparing', 'ready', 'completed', 'cancelled'],
};

exports.updateStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found', 'NOT_FOUND');
  const channel = order.channel || 'delivery';
  const next = req.body.status;
  if (!STATUS_FLOW[channel].includes(next)) {
    throw new ApiError(400, `A ${channel.replace('_', '-')} order cannot be set to "${next.replace(/_/g, ' ')}"`, 'INVALID_STATUS');
  }
  if (order.status === 'awaiting_payment' && next !== 'cancelled') {
    throw new ApiError(400, 'Confirm the payment first; the kitchen starts take-out orders once they are paid', 'AWAITING_PAYMENT');
  }
  const previous = order.status;
  order.status = next;
  order.handledBy = req.user.id;
  await order.save();
  if (order.session) {
    const session = await DiningSession.findById(order.session);
    if (session) await (await refreshTotal(session)).save();
  }
  await logActivity(req.user.id, 'ORDER_STATUS', `${order.orderNo}: ${previous} → ${order.status}`);
  const [full] = await withItems([order.toObject()]);
  res.json(full);
});

// Staff confirm the money arrived: cash collected, or a QR / bank transfer seen in the restaurant's account.
exports.markPaid = asyncHandler(async (req, res) => {
  let order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found', 'NOT_FOUND');
  // Dine-in / take-out orders are paid as a whole bill; settling it also releases take-outs to the kitchen.
  if (order.session && order.paymentStatus !== 'paid') {
    const session = await DiningSession.findById(order.session);
    if (session && session.status !== 'cancelled') {
      await confirmPayment(session, req.user.id);
      await logActivity(req.user.id, 'TABLE_PAID', `${session.code} (${session.tableLabel}) via ${order.orderNo}`);
      order = await Order.findById(order._id);
    }
  }
  if (order.paymentStatus !== 'paid') {
    order.paymentStatus = 'paid';
    order.handledBy = req.user.id;
    await order.save();
    await logActivity(req.user.id, 'ORDER_PAID', `${order.orderNo} marked as paid`);
  }
  const [full] = await withItems([order.toObject()]);
  res.json(full);
});

// The customer says they paid by QR Ph, GCash or bank transfer. Money goes straight to the restaurant's
// own account, so this only records the reference; staff confirm it arrived with markPaid.
exports.pay = asyncHandler(async (req, res) => {
  const order = await loadOrderFor(req);
  if (order.paymentMethod === 'cash') {
    throw new ApiError(400, 'Cash orders are paid on delivery', 'NOT_ONLINE_PAYMENT');
  }
  if (order.status === 'cancelled') throw new ApiError(400, 'This order was cancelled', 'ORDER_CANCELLED');
  if (order.paymentStatus !== 'paid') {
    order.paymentStatus = 'verifying';
    order.paymentReference = req.body.reference || order.paymentReference;
    await order.save();
  }
  const [full] = await withItems([order.toObject()]);
  res.json(full);
});

exports.remove = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found', 'NOT_FOUND');
  await OrderItem.deleteMany({ order: order._id });
  await order.deleteOne();
  await logActivity(req.user.id, 'ORDER_DELETE', order.orderNo);
  res.json({ message: 'Order deleted' });
});
