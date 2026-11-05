const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const authenticate = asyncHandler(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw new ApiError(401, 'Access denied. No token provided.', 'NO_TOKEN');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    throw new ApiError(401, expired ? 'Token expired' : 'Invalid token', expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN');
  }

  const user = await User.findById(decoded.userId);
  if (!user || !user.isActive) throw new ApiError(401, 'Invalid or deactivated account', 'INVALID_ACCOUNT');
  req.user = { id: user._id, username: user.username, role: user.role };
  next();
});

// authorize('admin') or authorize('admin', 'staff'); must run after authenticate
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new ApiError(403, 'You do not have permission to do that.', 'FORBIDDEN'));
  }
  next();
};

module.exports = { authenticate, authorize };
