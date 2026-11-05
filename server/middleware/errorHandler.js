const multer = require('multer');

const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}`, code: 'NOT_FOUND' });
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return res.status(400).json({ message: errors[0]?.message || 'Validation failed', code: 'VALIDATION_ERROR', errors });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid ${err.path}`, code: 'INVALID_ID' });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    return res.status(409).json({ message: `That ${field} already exists`, code: 'DUPLICATE' });
  }
  if (err instanceof multer.MulterError || err.message === 'Only image files are allowed') {
    return res.status(400).json({ message: err.message, code: 'UPLOAD_ERROR' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body', code: 'BAD_JSON' });
  }
  if (err.status) {
    return res.status(err.status).json({ message: err.message, code: err.code });
  }

  console.error(err);
  res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
};

module.exports = { notFound, errorHandler };
