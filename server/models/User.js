const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const LOCK_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const addressSchema = new mongoose.Schema({
  street: { type: String, trim: true, maxlength: 120 },
  barangay: { type: String, trim: true, maxlength: 80 },
  city: { type: String, trim: true, maxlength: 80 },
  notes: { type: String, trim: true, maxlength: 200 },
}, { _id: false });

const userSchema = new mongoose.Schema({
  // Staff and admin accounts have a username; customers sign up with just an email.
  username: {
    type: String, trim: true,
    required: [function usernameRequired() { return this.role !== 'customer'; }, 'Username is required'],
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores'],
  },
  email: {
    type: String, required: [true, 'Email is required'], unique: true, trim: true, lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  password: { type: String, required: [true, 'Password is required'], minlength: 8, select: false },
  role: { type: String, enum: ['admin', 'staff', 'customer'], default: 'staff' },
  fullName: { type: String, trim: true, maxlength: 60 },
  phone: { type: String, trim: true, maxlength: 20 },
  address: { type: addressSchema, default: () => ({}) },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
}, { timestamps: true });

// Unique only among accounts that have a username, so customers (no username) never collide.
userSchema.index({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: 'string' } } });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};
userSchema.methods.registerFailedAttempt = async function () {
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= MAX_ATTEMPTS) this.lockUntil = new Date(Date.now() + LOCK_MS);
  await this.save();
};
userSchema.methods.registerSuccess = async function () {
  this.failedLoginAttempts = 0;
  this.lockUntil = null;
  this.lastLogin = new Date();
  await this.save();
};
userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    role: this.role,
    fullName: this.fullName,
    phone: this.phone,
    address: this.address || {},
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
