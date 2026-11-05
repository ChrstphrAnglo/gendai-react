/**
 * One-time migration from the dine-in system to delivery ordering. Safe to re-run.
 * Run from the server folder:  npm run migrate
 *
 *  - rebuilds the user indexes (customers have no username)
 *  - ready -> out_for_delivery, completed -> delivered
 *  - fills deliveryFee (0) and paymentStatus on existing orders
 *  - creates the settings document with the default delivery fee
 * Nothing is deleted. The old orderType/tableNumber values stay on old orders but are no longer read.
 */
const path = require('path');
const { createRequire } = require('module');

const serverDir = path.join(__dirname, '..', 'server');
const serverRequire = createRequire(path.join(serverDir, 'package.json'));
serverRequire('dotenv').config({ path: path.join(serverDir, '.env') });
const mongoose = serverRequire('mongoose');

const User = require(path.join(serverDir, 'models/User'));
const Setting = require(path.join(serverDir, 'models/Setting'));

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  const orders = mongoose.connection.db.collection('orders');

  await User.syncIndexes();
  console.log('User indexes rebuilt.');

  const ready = await orders.updateMany({ status: 'ready' }, { $set: { status: 'out_for_delivery' } });
  const completed = await orders.updateMany({ status: 'completed' }, { $set: { status: 'delivered' } });
  console.log(`Statuses: ${ready.modifiedCount} ready -> out_for_delivery, ${completed.modifiedCount} completed -> delivered.`);

  const fee = await orders.updateMany({ deliveryFee: { $exists: false } }, { $set: { deliveryFee: 0 } });
  const paid = await orders.updateMany({ paymentStatus: { $exists: false }, status: 'delivered' }, { $set: { paymentStatus: 'paid' } });
  const unpaid = await orders.updateMany({ paymentStatus: { $exists: false } }, { $set: { paymentStatus: 'unpaid' } });
  console.log(`Orders updated: ${fee.modifiedCount} fees, ${paid.modifiedCount} paid, ${unpaid.modifiedCount} unpaid.`);

  const settings = await Setting.get();
  console.log(`Delivery fee setting: ${settings.deliveryFee}`);

  await mongoose.disconnect();
}

migrate().catch((err) => { console.error('Migration failed:', err); process.exit(1); });
