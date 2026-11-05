const Table = require('../models/Table');
const DiningSession = require('../models/DiningSession');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logActivity = require('../utils/logActivity');

const load = async (id) => {
  const table = await Table.findById(id);
  if (!table) throw new ApiError(404, 'Table not found', 'NOT_FOUND');
  return table;
};

const duplicate = (err) => {
  if (err.code === 11000) throw new ApiError(409, 'A table with that name already exists', 'DUPLICATE_TABLE');
  throw err;
};

exports.list = asyncHandler(async (req, res) => {
  res.json(await Table.find().sort({ sortOrder: 1, label: 1 }));
});

exports.create = asyncHandler(async (req, res) => {
  const count = await Table.countDocuments();
  const table = await Table.create({ label: req.body.label, sortOrder: req.body.sortOrder ?? count }).catch(duplicate);
  await logActivity(req.user.id, 'TABLE_CREATE', table.label);
  res.status(201).json(table);
});

exports.update = asyncHandler(async (req, res) => {
  const table = await load(req.params.id);
  ['label', 'active', 'sortOrder'].forEach((f) => {
    if (req.body[f] !== undefined) table[f] = req.body[f];
  });
  await table.save().catch(duplicate);
  await logActivity(req.user.id, 'TABLE_UPDATE', table.label);
  res.json(table);
});

// A new token makes the old printed QR code stop working (e.g. a code was photographed and misused).
exports.regenerate = asyncHandler(async (req, res) => {
  const table = await load(req.params.id);
  table.token = Table.newToken();
  await table.save();
  await logActivity(req.user.id, 'TABLE_NEW_QR', table.label);
  res.json(table);
});

exports.remove = asyncHandler(async (req, res) => {
  const table = await load(req.params.id);
  if (await DiningSession.exists({ table: table._id })) {
    throw new ApiError(409, 'This table has order history. Turn it off instead of deleting it.', 'TABLE_IN_USE');
  }
  await table.deleteOne();
  await logActivity(req.user.id, 'TABLE_DELETE', table.label);
  res.json({ message: 'Table deleted' });
});
