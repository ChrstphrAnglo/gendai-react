const MenuItem = require('../models/MenuItem');
const Category = require('../models/Category');
const OrderItem = require('../models/OrderItem');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logActivity = require('../utils/logActivity');
const storage = require('../utils/storage');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const removeFile = (name) => storage.remove(name);

exports.list = asyncHandler(async (req, res) => {
  const { search, category, available } = req.query;
  const filter = {};
  if (search) filter.name = new RegExp(escapeRegex(String(search)), 'i');
  if (category) filter.category = category;
  if (available === 'true' || available === 'false') filter.available = available === 'true';
  const items = await MenuItem.find(filter).populate('category', 'name').sort({ name: 1 });
  res.json(items);
});

exports.get = asyncHandler(async (req, res) => {
  const item = await MenuItem.findById(req.params.id).populate('category', 'name');
  if (!item) throw new ApiError(404, 'Menu item not found', 'NOT_FOUND');
  res.json(item);
});

exports.create = asyncHandler(async (req, res) => {
  let image = '';
  try {
    if (!(await Category.exists({ _id: req.body.category }))) {
      throw new ApiError(400, 'Category does not exist', 'INVALID_CATEGORY');
    }
    if (req.file) image = await storage.save(req.file);
    const item = await MenuItem.create({
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      category: req.body.category,
      available: req.body.available !== undefined ? req.body.available : true,
      image,
    });
    await logActivity(req.user.id, 'MENU_CREATE', item.name);
    res.status(201).json(await item.populate('category', 'name'));
  } catch (err) {
    await removeFile(image);
    throw err;
  }
});

exports.update = asyncHandler(async (req, res) => {
  let image = '';
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) throw new ApiError(404, 'Menu item not found', 'NOT_FOUND');
    if (req.body.category && !(await Category.exists({ _id: req.body.category }))) {
      throw new ApiError(400, 'Category does not exist', 'INVALID_CATEGORY');
    }
    ['name', 'description', 'price', 'category', 'available'].forEach((f) => {
      if (req.body[f] !== undefined) item[f] = req.body[f];
    });
    const oldImage = item.image;
    if (req.file) {
      image = await storage.save(req.file);
      item.image = image;
    }
    await item.save();
    if (image && oldImage && oldImage !== image) removeFile(oldImage);
    await logActivity(req.user.id, 'MENU_UPDATE', item.name);
    res.json(await item.populate('category', 'name'));
  } catch (err) {
    await removeFile(image);
    throw err;
  }
});

// Items that appear in past orders are hidden (soft delete) so order history stays intact.
exports.remove = asyncHandler(async (req, res) => {
  const item = await MenuItem.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Menu item not found', 'NOT_FOUND');
  if (await OrderItem.exists({ menuItem: item._id })) {
    item.available = false;
    await item.save();
    await logActivity(req.user.id, 'MENU_HIDE', `${item.name} (has order history)`);
    return res.json({ message: 'Item is used in past orders, so it was marked unavailable instead of deleted', softDeleted: true });
  }
  await item.deleteOne();
  removeFile(item.image);
  await logActivity(req.user.id, 'MENU_DELETE', item.name);
  res.json({ message: 'Menu item deleted', softDeleted: false });
});
