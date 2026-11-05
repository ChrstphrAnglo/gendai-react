const mongoose = require('mongoose');

const DEFAULT_DELIVERY_FEE = 50;

// Where guests send money. The QR images are the restaurant's own static QR Ph / GCash codes,
// so payments land directly in the restaurant's accounts and staff confirm them by hand.
const paymentSchema = new mongoose.Schema({
  qrphImage: { type: String, default: '' },
  qrphName: { type: String, trim: true, maxlength: 80, default: '' },
  gcashImage: { type: String, default: '' },
  gcashName: { type: String, trim: true, maxlength: 80, default: '' },
  gcashNumber: { type: String, trim: true, maxlength: 20, default: '' },
  bankName: { type: String, trim: true, maxlength: 80, default: '' },
  bankAccountName: { type: String, trim: true, maxlength: 80, default: '' },
  bankAccountNumber: { type: String, trim: true, maxlength: 40, default: '' },
}, { _id: false });

// A single document holds the app-wide settings.
const settingSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  deliveryFee: { type: Number, default: DEFAULT_DELIVERY_FEE, min: 0, max: 10000 },
  payment: { type: paymentSchema, default: () => ({}) },
}, { timestamps: true });

// Returns the settings document, creating it with defaults on first use.
settingSchema.statics.get = function get() {
  return this.findOneAndUpdate(
    { key: 'main' },
    { $setOnInsert: { key: 'main', deliveryFee: DEFAULT_DELIVERY_FEE } },
    { upsert: true, returnDocument: 'after' }
  );
};

module.exports = mongoose.model('Setting', settingSchema);
module.exports.DEFAULT_DELIVERY_FEE = DEFAULT_DELIVERY_FEE;
