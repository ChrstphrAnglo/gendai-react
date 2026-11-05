const router = require('express').Router();
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/orderController');
const { STATUSES } = require('../models/Order');

const id = param('id').isMongoId().withMessage('Invalid order id');
// Card payments are not offered; 'card' stays in the model only for old orders.
const DELIVERY_PAYMENTS = ['cash', 'qrph', 'gcash', 'bank_transfer'];

const createRules = [
  body('customerName').trim().notEmpty().withMessage('Recipient name is required').isLength({ max: 60 }).withMessage('Name is too long'),
  body('contactPhone').trim().matches(/^[0-9+()\-\s]{7,20}$/).withMessage('Enter a valid contact number'),
  body('deliveryAddress.street').trim().notEmpty().withMessage('Street address is required').isLength({ max: 120 }).withMessage('Street address is too long'),
  body('deliveryAddress.barangay').trim().notEmpty().withMessage('Barangay is required').isLength({ max: 80 }).withMessage('Barangay is too long'),
  body('deliveryAddress.city').trim().notEmpty().withMessage('City is required').isLength({ max: 80 }).withMessage('City is too long'),
  body('deliveryAddress.notes').optional({ values: 'falsy' }).trim().isLength({ max: 200 }).withMessage('Delivery notes are too long'),
  body('paymentMethod').isIn(DELIVERY_PAYMENTS).withMessage('Choose a payment method'),
  body('items').isArray({ min: 1, max: 50 }).withMessage('Your order is empty'),
  body('items.*.menuItem').isMongoId().withMessage('Invalid menu item'),
  body('items.*.quantity').isInt({ min: 1, max: 50 }).withMessage('Quantity must be between 1 and 50').toInt(),
];

router.use(authenticate);

// Customers
router.post('/', authorize('customer'), createRules, validate, c.create);
router.get('/mine', authorize('customer'), c.mine);
router.post('/:id/pay', authorize('customer'), [
  id, body('reference').optional({ values: 'falsy' }).trim().isLength({ max: 60 }).withMessage('Reference number is too long'),
], validate, c.pay);

// Customers (own orders) and staff
router.get('/:id', [id], validate, c.get);

// Staff and admin
router.get('/', authorize('admin', 'staff'), [
  query('status').optional().isIn(STATUSES).withMessage('Invalid status'),
  query('channel').optional().isIn(['delivery', 'dine_in', 'takeout']).withMessage('Invalid order type'),
  query('from').optional().isISO8601().withMessage('Invalid from date'),
  query('to').optional().isISO8601().withMessage('Invalid to date'),
], validate, c.list);
router.put('/:id/status', authorize('admin', 'staff'), [
  id, body('status').isIn(STATUSES).withMessage('Status must be one of: ' + STATUSES.join(', ')),
], validate, c.updateStatus);
router.put('/:id/paid', authorize('admin', 'staff'), [id], validate, c.markPaid);
router.delete('/:id', authorize('admin'), [id], validate, c.remove);

module.exports = router;
