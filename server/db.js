const mongoose = require('mongoose');

// One shared connection. On Vercel each warm function instance reuses it between requests
// instead of reconnecting every time.
let pending = null;

module.exports = function connect(uri = process.env.MONGODB_URI) {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!pending) {
    if (!uri) return Promise.reject(new Error('MONGODB_URI is not set'));
    pending = mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
      .then(() => mongoose.connection)
      .catch((err) => {
        pending = null; // let the next request try again
        throw err;
      });
  }
  return pending;
};
