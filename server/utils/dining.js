const Order = require('../models/Order');
const DiningSession = require('../models/DiningSession');
const { round2, withItems } = require('./orders');

const LIVE = ['open', 'payment_pending'];

const makeCode = (kind) => `${kind === 'takeout' ? 'TO' : 'DI'}-${Math.floor(1000 + Math.random() * 9000)}`;

// Creates a session with a short code staff can read out ("TO-4821"), retrying on a collision.
const createSession = async (fields) => {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await DiningSession.create({ code: makeCode(fields.kind), ...fields });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  throw new Error('Could not generate a session code');
};

// Recomputes the bill from the session's orders (cancelled orders don't count).
const refreshTotal = async (session) => {
  const orders = await Order.find({ session: session._id, status: { $ne: 'cancelled' } }, 'totalAmount').lean();
  session.totalAmount = round2(orders.reduce((s, o) => s + o.totalAmount, 0));
  return session;
};

// Everything a guest or the front desk needs about one session.
const sessionView = async (session) => {
  const plain = session.toObject ? session.toObject() : session;
  delete plain.guestToken;
  const orders = await Order.find({ session: plain._id }).sort({ createdAt: 1 }).lean();
  return { ...plain, orders: await withItems(orders) };
};

// Staff saw the money arrive (or collected cash). Marks the bill paid and releases take-out orders to the kitchen.
const confirmPayment = async (session, userId) => {
  if (session.status === 'paid') return session;
  await refreshTotal(session);
  const method = session.paymentMethod || 'cash';
  session.status = 'paid';
  session.paymentMethod = method;
  session.paidAt = new Date();
  session.handledBy = userId;
  await session.save();

  await Order.updateMany(
    { session: session._id, status: { $ne: 'cancelled' } },
    { $set: { paymentStatus: 'paid', paymentMethod: method, paymentReference: session.paymentReference, handledBy: userId } }
  );
  await Order.updateMany({ session: session._id, status: 'awaiting_payment' }, { $set: { status: 'preparing' } });
  return session;
};

module.exports = { LIVE, createSession, refreshTotal, sessionView, confirmPayment };
