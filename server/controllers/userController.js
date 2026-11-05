const User = require('../models/User');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logActivity = require('../utils/logActivity');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.list = asyncHandler(async (req, res) => {
  const { search, role } = req.query;
  // Customers have their own read-only list; this one is staff and admin accounts only.
  const filter = { role: role || { $in: ['admin', 'staff'] } };
  if (search) {
    const rx = new RegExp(escapeRegex(String(search)), 'i');
    filter.$or = [{ username: rx }, { email: rx }];
  }
  const users = await User.find(filter).sort({ createdAt: -1 });
  res.json(users.map((u) => u.toSafeJSON()));
});

exports.create = asyncHandler(async (req, res) => {
  const { username, email, password, role } = req.body;
  const user = await User.create({ username, email, password, role });
  await logActivity(req.user.id, 'USER_CREATE', `${user.username} (${user.role})`);
  res.status(201).json(user.toSafeJSON());
});

exports.update = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found', 'NOT_FOUND');
  const isSelf = String(user._id) === String(req.user.id);
  if (isSelf && (req.body.role === 'staff' || req.body.isActive === false)) {
    throw new ApiError(400, "You can't demote or deactivate your own account", 'SELF_MODIFY');
  }
  ['email', 'role', 'isActive'].forEach((f) => { if (req.body[f] !== undefined) user[f] = req.body[f]; });
  if (req.body.password) {
    user.password = req.body.password;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
  }
  await user.save();
  await logActivity(req.user.id, 'USER_UPDATE', user.username);
  res.json(user.toSafeJSON());
});

exports.remove = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found', 'NOT_FOUND');
  if (String(user._id) === String(req.user.id)) throw new ApiError(400, "You can't delete your own account", 'SELF_MODIFY');
  if (await Order.exists({ handledBy: user._id })) {
    throw new ApiError(409, 'This user has handled orders. Deactivate the account instead of deleting it.', 'USER_IN_USE');
  }
  await user.deleteOne();
  await logActivity(req.user.id, 'USER_DELETE', user.username);
  res.json({ message: 'User deleted' });
});
