const router = require('express').Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/tableController');

const id = param('id').isMongoId().withMessage('Invalid table id');
const label = (chain) => chain.trim().notEmpty().withMessage('Table name is required').isLength({ max: 30 }).withMessage('Table name is too long');

router.use(authenticate, authorize('admin'));

router.get('/', c.list);
router.post('/', [label(body('label')), body('sortOrder').optional().isInt({ min: 0 }).toInt()], validate, c.create);
router.put('/:id', [
  id,
  label(body('label').optional()),
  body('active').optional().isBoolean().withMessage('Active must be true or false').toBoolean(),
  body('sortOrder').optional().isInt({ min: 0 }).toInt(),
], validate, c.update);
router.post('/:id/regenerate', [id], validate, c.regenerate);
router.delete('/:id', [id], validate, c.remove);

module.exports = router;
