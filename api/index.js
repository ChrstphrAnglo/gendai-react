// Vercel serverless entry: every /api/* and /uploads/* request is rewritten here (see vercel.json)
// and handled by the same Express app that runs locally with `npm run server`.
const connect = require('../server/db');
const app = require('../server/app');

module.exports = async (req, res) => {
  if (!process.env.JWT_SECRET || !process.env.MONGODB_URI) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Server is not configured: set MONGODB_URI and JWT_SECRET in Vercel.', code: 'NOT_CONFIGURED' }));
    return;
  }
  try {
    await connect();
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Database is unavailable. Please try again shortly.', code: 'DB_UNAVAILABLE' }));
    return;
  }
  app(req, res);
};
