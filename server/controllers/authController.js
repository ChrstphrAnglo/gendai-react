const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logActivity = require('../utils/logActivity');

const sign = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

const displayName = (user) => user.username || user.fullName || user.email;

exports.login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+password');
  if (!user || !user.isActive) throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  if (user.isLocked()) throw new ApiError(423, 'Account temporarily locked. Try again later.', 'ACCOUNT_LOCKED');

  if (!(await user.comparePassword(req.body.password))) {
    await user.registerFailedAttempt();
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }
  await user.registerSuccess();
  await logActivity(user._id, 'LOGIN', `${displayName(user)} logged in`);
  res.json({ message: 'Login successful', token: sign(user._id), user: user.toSafeJSON() });
});

// Self-service sign-up. Always creates a customer; staff accounts are made by an admin.
exports.register = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password } = req.body;
  if (await User.exists({ email })) {
    throw new ApiError(409, 'That email is already registered. Try logging in instead.', 'EMAIL_TAKEN');
  }
  const user = await User.create({ fullName, email, phone, password, role: 'customer' });
  res.status(201).json({ message: 'Account created', token: sign(user._id), user: user.toSafeJSON() });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  const { fullName, phone, address } = req.body;
  if (fullName !== undefined) user.fullName = fullName;
  if (phone !== undefined) user.phone = phone;
  if (address !== undefined) user.address = { ...(user.address?.toObject?.() || {}), ...address };
  await user.save();
  res.json({ user: user.toSafeJSON() });
});

exports.logout = asyncHandler(async (req, res) => {
  await logActivity(req.user.id, 'LOGOUT', `${req.user.username || 'customer'} logged out`);
  res.json({ message: 'Logout successful' });
});

exports.verify = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ isValid: true, user: user.toSafeJSON() });
});
