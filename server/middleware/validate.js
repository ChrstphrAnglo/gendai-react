const { validationResult } = require('express-validator');

// Run after a chain of express-validator checks.
module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  res.status(400).json({ message: errors[0].message, code: 'VALIDATION_ERROR', errors });
};
