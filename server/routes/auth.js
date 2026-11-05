const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const rateLimit = require('../middleware/rateLimit');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/authController');

const authLimiter = rateLimit({ max: 30 });
const email = () => body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false });
const phone = () => body('phone').trim().matches(/^[0-9+()\-\s]{7,20}$/).withMessage('Enter a valid phone number');
const addressField = (name, max) => body(`address.${name}`).optional({ values: 'falsy' }).trim().isLength({ max }).withMessage(`${name} is too long`);

router.post('/login',
  authLimiter,
  [email(), body('password').notEmpty().withMessage('Password is required')],
  validate, c.login);

router.post('/register',
  authLimiter,
  [
    body('fullName').trim().isLength({ min: 2, max: 60 }).withMessage('Enter your full name (2-60 characters)'),
    email(),
    phone(),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Za-z]/).withMessage('Password needs a letter')
      .matches(/\d/).withMessage('Password needs a number'),
  ],
  validate, c.register);

router.put('/profile', authenticate, [
  body('fullName').optional().trim().isLength({ min: 2, max: 60 }).withMessage('Enter your full name (2-60 characters)'),
  body('phone').optional().trim().matches(/^[0-9+()\-\s]{7,20}$/).withMessage('Enter a valid phone number'),
  addressField('street', 120), addressField('barangay', 80), addressField('city', 80), addressField('notes', 200),
], validate, c.updateProfile);

router.post('/logout', authenticate, c.logout);
router.get('/verify', authenticate, c.verify);

module.exports = router;
