// Public guest API for the table QR codes (no login).
const router = require('express').Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const rateLimit = require('../middleware/rateLimit');
const c = require('../controllers/dineController');
const { PAYMENT_METHODS } = require('../models/DiningSession');

// Generous: a whole restaurant shares one Wi-Fi IP address.
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 400 });
const tableToken = (chain) => chain.isString().trim().isLength({ min: 6, max: 40 }).withMessage('Invalid table code');

router.get('/tables/:token', [tableToken(param('token'))], validate, c.table);

router.post('/sessions', limiter, [
  tableToken(body('tableToken')),
  body('kind').isIn(['dine_in', 'takeout']).withMessage('Choose dine in or take out'),
], validate, c.start);

router.use(c.guestSession);

router.get('/session', c.current);

router.post('/session/orders', limiter, [
  body('items').isArray({ min: 1, max: 50 }).withMessage('Your order is empty'),
  body('items.*.menuItem').isMongoId().withMessage('Invalid menu item'),
  body('items.*.quantity').isInt({ min: 1, max: 50 }).withMessage('Quantity must be between 1 and 50').toInt(),
  body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 200 }).withMessage('Notes are too long'),
  body('guestName').optional({ values: 'falsy' }).trim().isLength({ max: 60 }).withMessage('Name is too long'),
], validate, c.order);

router.post('/session/payment', [
  body('method').isIn(PAYMENT_METHODS).withMessage('Choose a payment method'),
  body('reference').optional({ values: 'falsy' }).trim().isLength({ max: 60 }).withMessage('Reference number is too long'),
], validate, c.requestPayment);

router.delete('/session/payment', c.cancelPaymentRequest);

module.exports = router;
