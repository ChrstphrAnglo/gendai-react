require('dotenv').config();
const connectDB = require('./config');
const User = require('./models/User');
const app = require('./app');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  // Rebuild the username index so customers (who have no username) don't collide.
  try {
    await User.syncIndexes();
  } catch (err) {
    console.error('Could not sync user indexes:', err.message);
  }
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
});
