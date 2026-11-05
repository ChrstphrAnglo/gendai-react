const mongoose = require('mongoose');

const deliveryAddressSchema = new mongoose.Schema({
  street: { type: String, trim: true, maxlength: 120 },
  barangay: { type: String, trim: true, maxlength: 80 },
  city: { type: String, trim: true, maxlength: 80 },
  notes: { type: String, trim: true, maxlength: 200 },
}, { _id: false });

// 'card' is kept only so orders placed before card payments were removed still load.
const PAYMENT_METHODS = ['cash', 'qrph', 'gcash', 'bank_transfer', 'card'];

// Status flow per channel:
//   delivery: preparing → out_for_delivery → delivered
//   dine_in:  preparing → ready → served
//   takeout:  awaiting_payment → preparing → ready → completed (picked up)
// Any order can be cancelled.
const STATUSES = ['awaiting_payment', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'served', 'completed', 'cancelled'];

const orderSchema = new mongoose.Schema({
  orderNo: { type: String, unique: true, required: true },
  channel: { type: String, enum: ['delivery', 'dine_in', 'takeout'], default: 'delivery', index: true },
  // Delivery orders belong to a customer account; dine-in and take-out guests have none.
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningSession', default: null, index: true },
  tableLabel: { type: String, trim: true, default: '' },
  customerName: { type: String, required: [true, 'Customer name is required'], trim: true, maxlength: 60 },
  contactPhone: { type: String, trim: true, maxlength: 20 },
  deliveryAddress: { type: deliveryAddressSchema },
  notes: { type: String, trim: true, maxlength: 200, default: '' },
  // Dine-in orders choose how to pay when the bill is settled, so the method starts empty.
  paymentMethod: { type: String, enum: [...PAYMENT_METHODS, null], default: null },
  // verifying: the guest says they paid by QR / bank transfer and staff still have to confirm it arrived.
  paymentStatus: { type: String, enum: ['unpaid', 'verifying', 'paid'], default: 'unpaid' },
  paymentReference: { type: String, trim: true, maxlength: 60, default: '' },
  status: { type: String, enum: STATUSES, default: 'preparing', index: true },
  deliveryFee: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
module.exports.STATUSES = STATUSES;
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
