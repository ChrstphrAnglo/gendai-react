const crypto = require('crypto');
const mongoose = require('mongoose');

// One guest visit from a table QR code, with no login.
//   dine_in: the table's running bill. Every phone that scans the table joins it; it can hold several orders
//            (rounds) and is paid once at the end.
//   takeout: a single order that is paid before the kitchen starts it.
// Guests prove they belong to a session with `guestToken`, which is only handed to devices that scanned the QR.
const PAYMENT_METHODS = ['qrph', 'gcash', 'bank_transfer', 'cash'];

const diningSessionSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  kind: { type: String, enum: ['dine_in', 'takeout'], required: true },
  table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true, index: true },
  tableLabel: { type: String, required: true },
  guestToken: { type: String, required: true, unique: true, select: false, default: () => crypto.randomBytes(24).toString('base64url') },
  guestName: { type: String, trim: true, maxlength: 60, default: '' },
  // open → payment_pending (guest picked a method) → paid; or cancelled by staff.
  status: { type: String, enum: ['open', 'payment_pending', 'paid', 'cancelled'], default: 'open', index: true },
  paymentMethod: { type: String, enum: [...PAYMENT_METHODS, null], default: null },
  paymentReference: { type: String, trim: true, maxlength: 60, default: '' },
  paymentRequestedAt: { type: Date, default: null },
  paidAt: { type: Date, default: null },
  totalAmount: { type: Number, default: 0, min: 0 },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('DiningSession', diningSessionSchema);
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
