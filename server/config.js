const connect = require('./db');

// Local server start-up: connect once, or stop with a clear message.
module.exports = async function connectDB() {
  try {
    await connect();
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
};
