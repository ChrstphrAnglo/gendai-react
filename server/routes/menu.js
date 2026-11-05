const router = require('express').Router();
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/menuController');

const id = param('id').isMongoId().withMessage('Invalid menu item id');
const nameLen = (chain) => chain.isLength({ max: 100 }).withMessage('Name is too long');
const description = body('description').optional().trim().isLength({ max: 500 }).withMessage('Description is too long');
const available = body('available').optional().isBoolean().withMessage('Available must be true or false').toBoolean();

// Multer runs first so multipart fields are in req.body before validation.
const createRules = [
  nameLen(body('name').trim().notEmpty().withMessage('Name is required')),
  description,
  body('price').isFloat({ min: 0 }).withMessage('Price must be a number ≥ 0').toFloat(),
  body('category').isMongoId().withMessage('Pick a valid category'),
  available,
];
const updateRules = [
  id,
  nameLen(body('name').optional().trim().notEmpty().withMessage('Name cannot be empty')),
  description,
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a number ≥ 0').toFloat(),
  body('category').optional().isMongoId().withMessage('Pick a valid category'),
  available,
];

router.get('/', [query('category').optional().isMongoId().withMessage('Invalid category id')], validate, c.list);
router.get('/:id', [id], validate, c.get);
router.post('/', authenticate, authorize('admin'), upload.single('image'), createRules, validate, c.create);
router.put('/:id', authenticate, authorize('admin'), upload.single('image'), updateRules, validate, c.update);
router.delete('/:id', authenticate, authorize('admin'), [id], validate, c.remove);

module.exports = router;
