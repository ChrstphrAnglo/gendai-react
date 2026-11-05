const crypto = require('crypto');
const mongoose = require('mongoose');

// A physical table. Its QR code links to /t/<token>; the token is random so table URLs can't be guessed.
const newToken = () => crypto.randomBytes(9).toString('base64url');

const tableSchema = new mongoose.Schema({
  label: { type: String, required: [true, 'Table name is required'], trim: true, maxlength: 30, unique: true },
  token: { type: String, required: true, unique: true, default: newToken },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Table', tableSchema);
module.exports.newToken = newToken;
