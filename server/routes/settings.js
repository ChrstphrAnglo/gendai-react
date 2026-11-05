const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { authenticate, authorize } = require('../middleware/auth');
const Setting = require('../models/Setting');
const asyncHandler = require('../utils/asyncHandler');
const logActivity = require('../utils/logActivity');
const storage = require('../utils/storage');

const PAYMENT_TEXT = ['qrphName', 'gcashName', 'gcashNumber', 'bankName', 'bankAccountName', 'bankAccountNumber'];
const PAYMENT_IMAGES = ['qrphImage', 'gcashImage'];

// Payment details are public on purpose: guests need the QR codes and account numbers to pay.
const publicView = (s) => {
  const p = s.payment || {};
  return {
    deliveryFee: s.deliveryFee,
    payment: Object.fromEntries([...PAYMENT_TEXT, ...PAYMENT_IMAGES].map((k) => [k, p[k] || ''])),
  };
};

// Public: checkout and the table payment screen read the fee and the payment details.
router.get('/', asyncHandler(async (req, res) => {
  res.json(publicView(await Setting.get()));
}));

router.put('/', authenticate, authorize('admin'), [
  body('deliveryFee').isFloat({ min: 0, max: 10000 }).withMessage('Delivery fee must be between 0 and 10,000').toFloat(),
], validate, asyncHandler(async (req, res) => {
  const settings = await Setting.get();
  const previous = settings.deliveryFee;
  settings.deliveryFee = req.body.deliveryFee;
  await settings.save();
  await logActivity(req.user.id, 'SETTINGS_UPDATE', `delivery fee ${previous} → ${settings.deliveryFee}`);
  res.json(publicView(settings));
}));

// Multipart: text fields, optional new QR images, and removeQrphImage / removeGcashImage flags.
router.put('/payment', authenticate, authorize('admin'),
  upload.fields(PAYMENT_IMAGES.map((name) => ({ name, maxCount: 1 }))),
  [
    body('qrphName').optional().trim().isLength({ max: 80 }).withMessage('Name is too long'),
    body('gcashName').optional().trim().isLength({ max: 80 }).withMessage('Name is too long'),
    body('gcashNumber').optional({ values: 'falsy' }).trim().matches(/^[0-9+\-\s]{7,20}$/).withMessage('Enter a valid GCash number'),
    body('bankName').optional().trim().isLength({ max: 80 }).withMessage('Bank name is too long'),
    body('bankAccountName').optional().trim().isLength({ max: 80 }).withMessage('Account name is too long'),
    body('bankAccountNumber').optional({ values: 'falsy' }).trim().matches(/^[0-9\-\s]{4,40}$/).withMessage('Enter a valid account number'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const settings = await Setting.get();
    const payment = settings.payment || {};
    const old = [];

    PAYMENT_TEXT.forEach((k) => { if (req.body[k] !== undefined) payment[k] = req.body[k]; });
    for (const k of PAYMENT_IMAGES) {
      const file = req.files?.[k]?.[0];
      const removeFlag = `remove${k.charAt(0).toUpperCase()}${k.slice(1)}`;
      if (file) {
        old.push(payment[k]);
        payment[k] = await storage.save(file);
      } else if (req.body[removeFlag] === 'true') {
        old.push(payment[k]);
        payment[k] = '';
      }
    }

    settings.payment = payment;
    await settings.save();
    old.filter(Boolean).forEach((name) => storage.remove(name));
    await logActivity(req.user.id, 'SETTINGS_UPDATE', 'payment details updated');
    res.json(publicView(settings));
  }));

module.exports = router;
