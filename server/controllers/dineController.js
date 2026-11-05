// Guest side of the table QR codes. No accounts: a device proves it belongs to a session with the
// X-Guest-Token header it received when it scanned the table's QR code.
const Table = require('../models/Table');
const DiningSession = require('../models/DiningSession');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { priceItems, createOrder } = require('../utils/orders');
const { LIVE, createSession, refreshTotal, sessionView } = require('../utils/dining');

const findTable = async (token) => {
  const table = await Table.findOne({ token, active: true });
  if (!table) throw new ApiError(404, 'This QR code is no longer valid. Please ask our staff for help.', 'TABLE_NOT_FOUND');
  return table;
};

// Middleware: loads the guest's session from the X-Guest-Token header.
exports.guestSession = asyncHandler(async (req, res, next) => {
  const token = req.get('x-guest-token');
  const session = token && await DiningSession.findOne({ guestToken: token });
  if (!session) throw new ApiError(401, 'Your table session has ended. Please scan the QR code again.', 'NO_GUEST_SESSION');
  req.dining = session;
  next();
});

exports.table = asyncHandler(async (req, res) => {
  const table = await findTable(req.params.token);
  res.json({ label: table.label });
});

// Dine in: join the table's open bill (or open one). Take out: always a fresh session.
exports.start = asyncHandler(async (req, res) => {
  const table = await findTable(req.body.tableToken);
  const { kind } = req.body;

  let session = kind === 'dine_in'
    ? await DiningSession.findOne({ table: table._id, kind: 'dine_in', status: { $in: LIVE } }).select('+guestToken')
    : null;
  if (!session) session = await createSession({ kind, table: table._id, tableLabel: table.label });

  res.status(201).json({ guestToken: session.guestToken, session: await sessionView(session) });
});

exports.current = asyncHandler(async (req, res) => {
  res.json(await sessionView(req.dining));
});

// Send an order to the kitchen (dine in) or place a take-out order that waits for payment.
exports.order = asyncHandler(async (req, res) => {
  const { dining: session } = req;
  const { items, notes, guestName } = req.body;
  if (session.status === 'payment_pending') {
    throw new ApiError(409, 'Your bill is being settled. Cancel the payment request to order more.', 'BILL_PENDING');
  }
  if (session.status !== 'open') throw new ApiError(409, 'This session is closed. Please scan the QR code again.', 'SESSION_CLOSED');

  const takeout = session.kind === 'takeout';
  if (takeout && await Order.exists({ session: session._id, status: { $ne: 'cancelled' } })) {
    throw new ApiError(409, 'This take-out order was already placed.', 'ALREADY_ORDERED');
  }
  if (takeout && !guestName) throw new ApiError(400, 'Enter a name so we can call you when it is ready', 'NAME_REQUIRED');

  if (guestName) session.guestName = guestName;
  const { lines, subtotal } = await priceItems(items);
  await createOrder({
    channel: session.kind,
    session: session._id,
    tableLabel: session.tableLabel,
    customerName: session.guestName || `Table ${session.tableLabel}`,
    notes: notes || '',
    status: takeout ? 'awaiting_payment' : 'preparing',
    paymentStatus: 'unpaid',
    totalAmount: subtotal,
  }, lines);

  await refreshTotal(session);
  await session.save();
  res.status(201).json(await sessionView(session));
});

// Guest chose how to pay. QR / bank methods mean "I sent the money"; cash means "come collect it".
exports.requestPayment = asyncHandler(async (req, res) => {
  const { dining: session } = req;
  const { method, reference } = req.body;
  if (!LIVE.includes(session.status)) throw new ApiError(409, 'This bill is already settled.', 'SESSION_CLOSED');
  await refreshTotal(session);
  if (session.totalAmount <= 0) throw new ApiError(400, 'There is nothing to pay yet.', 'EMPTY_BILL');

  session.status = 'payment_pending';
  session.paymentMethod = method;
  session.paymentReference = method === 'cash' ? '' : (reference || '');
  session.paymentRequestedAt = new Date();
  await session.save();

  await Order.updateMany(
    { session: session._id, status: { $ne: 'cancelled' } },
    { $set: { paymentMethod: method, paymentStatus: method === 'cash' ? 'unpaid' : 'verifying', paymentReference: session.paymentReference } }
  );
  res.json(await sessionView(session));
});

// Guest changed their mind (e.g. wants to order dessert first).
exports.cancelPaymentRequest = asyncHandler(async (req, res) => {
  const { dining: session } = req;
  if (session.status === 'payment_pending') {
    session.status = 'open';
    session.paymentRequestedAt = null;
    await session.save();
    await Order.updateMany({ session: session._id, paymentStatus: 'verifying' }, { $set: { paymentStatus: 'unpaid' } });
  }
  res.json(await sessionView(session));
});
