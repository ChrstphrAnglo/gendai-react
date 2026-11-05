const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const MenuItem = require('../models/MenuItem');
const ApiError = require('./ApiError');

const round2 = (n) => Math.round(n * 100) / 100;

const makeOrderNo = () => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `GD-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
};

// Merge duplicate lines, then price everything from the database, never from the client.
const priceItems = async (items) => {
  const qtyById = new Map();
  items.forEach((i) => qtyById.set(String(i.menuItem), (qtyById.get(String(i.menuItem)) || 0) + i.quantity));
  const menuItems = await MenuItem.find({ _id: { $in: [...qtyById.keys()] } });
  if (menuItems.length !== qtyById.size) throw new ApiError(400, 'One or more items no longer exist', 'INVALID_ITEM');
  const unavailable = menuItems.find((m) => !m.available);
  if (unavailable) throw new ApiError(400, `"${unavailable.name}" is currently unavailable`, 'ITEM_UNAVAILABLE');

  const lines = menuItems.map((m) => {
    const quantity = Math.min(qtyById.get(String(m._id)), 50);
    return { menuItem: m._id, quantity, unitPrice: m.price, subtotal: round2(m.price * quantity) };
  });
  return { lines, subtotal: round2(lines.reduce((sum, l) => sum + l.subtotal, 0)) };
};

// Creates the order (retrying on an order-number collision) and its line items.
const createOrder = async (fields, lines) => {
  let order;
  for (let attempt = 0; attempt < 5 && !order; attempt++) {
    try {
      order = await Order.create({ orderNo: makeOrderNo(), ...fields });
    } catch (err) {
      if (err.code !== 11000) throw err; // order number collision: try another
    }
  }
  if (!order) throw new ApiError(500, 'Could not generate an order number, please retry', 'ORDER_NO_FAILED');

  try {
    await OrderItem.insertMany(lines.map((l) => ({ ...l, order: order._id })));
  } catch (err) {
    await order.deleteOne(); // standalone MongoDB has no transactions, so undo by hand
    throw err;
  }
  return order;
};

// Attach each order's line items (with menu item name) in a single extra query.
const withItems = async (orders) => {
  const ids = orders.map((o) => o._id);
  const items = await OrderItem.find({ order: { $in: ids } }).populate('menuItem', 'name image').lean();
  const byOrder = {};
  items.forEach((i) => { (byOrder[String(i.order)] ||= []).push(i); });
  return orders.map((o) => ({ ...o, items: byOrder[String(o._id)] || [] }));
};

module.exports = { round2, priceItems, createOrder, withItems };
