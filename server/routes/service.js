// Kitchen board and front desk (staff + admin).
const router = require('express').Router();
const { param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/serviceController');

const id = param('id').isMongoId().withMessage('Invalid session id');

router.use(authenticate, authorize('admin', 'staff'));

router.get('/kitchen', c.kitchen);
router.get('/front-desk', c.frontDesk);
router.get('/summary', c.summary);
router.post('/sessions/:id/confirm', [id], validate, c.confirm);
router.post('/sessions/:id/cancel', [id], validate, c.cancel);

module.exports = router;
