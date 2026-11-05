const router = require('express').Router();
const { query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/reportController');

const dates = [
  query('from').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid from date'),
  query('to').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid to date'),
];

router.use(authenticate);

router.get('/dashboard', authorize('admin', 'staff'), c.dashboard);
router.get('/sales', authorize('admin'), [
  ...dates, query('groupBy').optional().isIn(['day', 'category', 'channel']).withMessage('groupBy must be day, category or channel'),
], validate, c.sales);
router.get('/best-sellers', authorize('admin'), [
  ...dates, query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be 1-50'),
], validate, c.bestSellers);
router.get('/activity', authorize('admin'), c.activity);

module.exports = router;
