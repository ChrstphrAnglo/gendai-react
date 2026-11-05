const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logActivity = require('../utils/logActivity');

exports.list = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ sortOrder: 1, name: 1 }).lean();
  const counts = await MenuItem.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }]);
  const byId = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  res.json(categories.map((c) => ({ ...c, itemCount: byId[String(c._id)] || 0 })));
});

exports.create = asyncHandler(async (req, res) => {
  const category = await Category.create({ name: req.body.name, sortOrder: req.body.sortOrder });
  await logActivity(req.user.id, 'CATEGORY_CREATE', category.name);
  res.status(201).json(category);
});

exports.update = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found', 'NOT_FOUND');
  if (req.body.name !== undefined) category.name = req.body.name;
  if (req.body.sortOrder !== undefined) category.sortOrder = req.body.sortOrder;
  await category.save();
  await logActivity(req.user.id, 'CATEGORY_UPDATE', category.name);
  res.json(category);
});

exports.remove = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found', 'NOT_FOUND');
  const inUse = await MenuItem.countDocuments({ category: category._id });
  if (inUse > 0) {
    throw new ApiError(409, `Cannot delete "${category.name}": ${inUse} menu item(s) still use it`, 'CATEGORY_IN_USE');
  }
  await category.deleteOne();
  await logActivity(req.user.id, 'CATEGORY_DELETE', category.name);
  res.json({ message: 'Category deleted' });
});
