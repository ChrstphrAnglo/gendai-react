const router = require('express').Router();
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/userController');

const id = param('id').isMongoId().withMessage('Invalid user id');

// express-validator chains are mutable, so build a fresh chain per route (never share + .optional()).
const email = () => body('email').trim().isEmail().withMessage('Enter a valid email');
const role = () => body('role').isIn(['admin', 'staff']).withMessage('Role must be admin or staff');
const password = () => body('password')
  .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  .matches(/[A-Za-z]/).withMessage('Password needs a letter')
  .matches(/\d/).withMessage('Password needs a number');

router.use(authenticate, authorize('admin'));

router.get('/', [
  query('role').optional().isIn(['admin', 'staff']).withMessage('Invalid role filter'),
], validate, c.list);

router.post('/', [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers and underscores'),
  email(), password(), role(),
], validate, c.create);

router.put('/:id', [
  id,
  email().optional(),
  role().optional(),
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false').toBoolean(),
  password().optional({ values: 'falsy' }),
], validate, c.update);

router.delete('/:id', [id], validate, c.remove);

module.exports = router;
