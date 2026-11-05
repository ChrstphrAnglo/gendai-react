const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Category name is required'], unique: true, trim: true, maxlength: 50 },
  sortOrder: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
