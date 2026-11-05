const router = require('express').Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/categoryController');

const id = param('id').isMongoId().withMessage('Invalid category id');
const sortOrder = body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer').toInt();
const nameLen = (chain) => chain.isLength({ max: 50 }).withMessage('Name is too long');

router.get('/', c.list);
router.post('/', authenticate, authorize('admin'),
  [nameLen(body('name').trim().notEmpty().withMessage('Category name is required')), sortOrder],
  validate, c.create);
router.put('/:id', authenticate, authorize('admin'),
  [id, nameLen(body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty')), sortOrder],
  validate, c.update);
router.delete('/:id', authenticate, authorize('admin'), [id], validate, c.remove);

module.exports = router;
