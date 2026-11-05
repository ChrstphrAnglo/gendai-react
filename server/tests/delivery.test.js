// Run with:  npm test   (needs MongoDB; uses its own database, never the real one)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
const TEST_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/gendai_test';
if (new URL(TEST_URI).pathname.replace('/', '') === 'gendai') {
  throw new Error('Refusing to run tests against the real "gendai" database.');
}

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const app = require('../app');
const User = require('../models/User');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Setting = require('../models/Setting');

let server;
let base;
let ramen;
let soldOut;

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

const login = async (email, password) => (await call('POST', '/auth/login', { body: { email, password } })).body.token;
const signup = async (n) => {
  const { status, body } = await call('POST', '/auth/register', {
    body: { fullName: `Customer ${n}`, email: `c${n}@test.dev`, phone: '0917 000 0000', password: 'Passw0rd!' },
  });
  assert.equal(status, 201);
  return body.token;
};

const orderBody = (overrides = {}) => ({
  customerName: 'Maria Santos',
  contactPhone: '0917 123 4567',
  deliveryAddress: { street: '12 Rizal St.', barangay: 'San Antonio', city: 'Makati', notes: 'Blue gate' },
  paymentMethod: 'cash',
  items: [{ menuItem: String(ramen._id), quantity: 2 }],
  ...overrides,
});

before(async () => {
  await mongoose.connect(TEST_URI);
  await mongoose.connection.dropDatabase();
  await User.syncIndexes();

  await User.create({ username: 'admin', email: 'admin@test.dev', password: 'Admin123!', role: 'admin' });
  await User.create({ username: 'staff', email: 'staff@test.dev', password: 'Staff123!', role: 'staff' });
  const cat = await Category.create({ name: 'Ramen', sortOrder: 0 });
  ramen = await MenuItem.create({ name: 'Shoyu Ramen', price: 280, category: cat._id, available: true });
  soldOut = await MenuItem.create({ name: 'Sukiyaki', price: 380, category: cat._id, available: false });

  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('register creates a logged-in customer, and the role cannot be chosen', async () => {
  const res = await call('POST', '/auth/register', {
    body: { fullName: 'Ana Reyes', email: 'ana@test.dev', phone: '0918 111 2222', password: 'Passw0rd!', role: 'admin' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.role, 'customer');
  assert.ok(res.body.token);
  assert.equal((await call('GET', '/auth/verify', { token: res.body.token })).body.user.email, 'ana@test.dev');
});

test('register rejects a duplicate email and weak passwords', async () => {
  const dup = await call('POST', '/auth/register', {
    body: { fullName: 'Ana Again', email: 'ANA@test.dev', phone: '0918 111 2222', password: 'Passw0rd!' },
  });
  assert.equal(dup.status, 409);

  const weak = await call('POST', '/auth/register', {
    body: { fullName: 'Weak', email: 'weak@test.dev', phone: '0918 111 2222', password: 'short' },
  });
  assert.equal(weak.status, 400);
});

test('several customers can sign up without a username', async () => {
  await signup('multi1');
  await signup('multi2');
  await signup('multi3');
});

test('login works by email for customers and staff, and fails on a wrong password', async () => {
  assert.ok(await login('ana@test.dev', 'Passw0rd!'));
  assert.ok(await login('staff@test.dev', 'Staff123!'));
  const bad = await call('POST', '/auth/login', { body: { email: 'ana@test.dev', password: 'nope-nope1' } });
  assert.equal(bad.status, 401);
});

test('five wrong passwords lock the account', async () => {
  await signup('lock');
  for (let i = 0; i < 5; i++) {
    await call('POST', '/auth/login', { body: { email: 'clock@test.dev', password: 'wrong-pass1' } });
  }
  const locked = await call('POST', '/auth/login', { body: { email: 'clock@test.dev', password: 'Passw0rd!' } });
  assert.equal(locked.status, 423);
});

test('profile update saves the default address', async () => {
  const token = await signup('profile');
  const res = await call('PUT', '/auth/profile', {
    token, body: { phone: '0999 888 7777', address: { street: '5 Mabini', barangay: 'Poblacion', city: 'Makati' } },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.address.city, 'Makati');
  assert.equal(res.body.user.phone, '0999 888 7777');
});

test('placing an order prices items and the delivery fee on the server', async () => {
  const token = await signup('buyer');
  const res = await call('POST', '/orders', {
    token,
    body: orderBody({ items: [{ menuItem: String(ramen._id), quantity: 2, unitPrice: 1, price: 1 }], totalAmount: 1, deliveryFee: 0 }),
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.deliveryFee, 50);
  assert.equal(res.body.totalAmount, 2 * 280 + 50);
  assert.equal(res.body.status, 'preparing');
  assert.equal(res.body.paymentStatus, 'unpaid');
  assert.equal(res.body.items[0].unitPrice, 280);
  assert.equal(res.body.deliveryAddress.street, '12 Rizal St.');
});

test('ordering requires a customer login and a complete delivery address', async () => {
  assert.equal((await call('POST', '/orders', { body: orderBody() })).status, 401);

  const staffToken = await login('staff@test.dev', 'Staff123!');
  assert.equal((await call('POST', '/orders', { token: staffToken, body: orderBody() })).status, 403);

  const token = await signup('noaddr');
  const missing = await call('POST', '/orders', { token, body: orderBody({ deliveryAddress: { street: '', barangay: '', city: '' } }) });
  assert.equal(missing.status, 400);
});

test('unavailable and unknown items are rejected', async () => {
  const token = await signup('items');
  const out = await call('POST', '/orders', { token, body: orderBody({ items: [{ menuItem: String(soldOut._id), quantity: 1 }] }) });
  assert.equal(out.status, 400);
  assert.equal(out.body.code, 'ITEM_UNAVAILABLE');

  const ghost = await call('POST', '/orders', {
    token, body: orderBody({ items: [{ menuItem: String(new mongoose.Types.ObjectId()), quantity: 1 }] }),
  });
  assert.equal(ghost.status, 400);
});

test('customers see only their own orders; staff see all', async () => {
  const alice = await signup('alice');
  const bob = await signup('bob');
  const placed = await call('POST', '/orders', { token: alice, body: orderBody() });
  const id = placed.body._id;

  assert.equal((await call('GET', `/orders/${id}`, { token: alice })).status, 200);
  assert.equal((await call('GET', `/orders/${id}`, { token: bob })).status, 404);
  assert.equal((await call('GET', `/orders/${id}`)).status, 401);

  const staffToken = await login('staff@test.dev', 'Staff123!');
  assert.equal((await call('GET', `/orders/${id}`, { token: staffToken })).status, 200);

  const mineAlice = await call('GET', '/orders/mine', { token: alice });
  assert.equal(mineAlice.body.length, 1);
  assert.equal((await call('GET', '/orders/mine', { token: bob })).body.length, 0);

  assert.equal((await call('GET', '/orders', { token: alice })).status, 403);
  assert.ok((await call('GET', '/orders', { token: staffToken })).body.length >= 1);
});

test('staff move an order through the delivery statuses; customers cannot', async () => {
  const token = await signup('status');
  const { body: order } = await call('POST', '/orders', { token, body: orderBody() });
  const staffToken = await login('staff@test.dev', 'Staff123!');

  assert.equal((await call('PUT', `/orders/${order._id}/status`, { token, body: { status: 'delivered' } })).status, 403);

  const out = await call('PUT', `/orders/${order._id}/status`, { token: staffToken, body: { status: 'out_for_delivery' } });
  assert.equal(out.status, 200);
  assert.equal(out.body.status, 'out_for_delivery');
  assert.ok(out.body.handledBy);

  const done = await call('PUT', `/orders/${order._id}/status`, { token: staffToken, body: { status: 'delivered' } });
  assert.equal(done.body.status, 'delivered');

  const old = await call('PUT', `/orders/${order._id}/status`, { token: staffToken, body: { status: 'ready' } });
  assert.equal(old.status, 400);
});

test('staff can mark a cash order as paid', async () => {
  const token = await signup('cash');
  const { body: order } = await call('POST', '/orders', { token, body: orderBody({ paymentMethod: 'cash' }) });
  const staffToken = await login('staff@test.dev', 'Staff123!');

  assert.equal((await call('PUT', `/orders/${order._id}/paid`, { token })).status, 403);
  const paid = await call('PUT', `/orders/${order._id}/paid`, { token: staffToken });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.paymentStatus, 'paid');
});

test('QR / GCash payment is recorded as verifying until staff confirm it, and is safe to repeat', async () => {
  const token = await signup('gcash');
  const other = await signup('gcashother');
  const { body: order } = await call('POST', '/orders', { token, body: orderBody({ paymentMethod: 'gcash' }) });
  assert.equal(order.paymentStatus, 'unpaid');

  assert.equal((await call('POST', `/orders/${order._id}/pay`, { token: other })).status, 404);

  const first = await call('POST', `/orders/${order._id}/pay`, { token, body: { reference: 'GC123' } });
  assert.equal(first.status, 200);
  assert.equal(first.body.paymentStatus, 'verifying');
  assert.equal(first.body.paymentReference, 'GC123');

  const second = await call('POST', `/orders/${order._id}/pay`, { token });
  assert.equal(second.body.paymentStatus, 'verifying');

  const staffToken = await login('staff@test.dev', 'Staff123!');
  const paid = await call('PUT', `/orders/${order._id}/paid`, { token: staffToken });
  assert.equal(paid.body.paymentStatus, 'paid');
});

test('card is no longer accepted; QR Ph and bank transfer are', async () => {
  const token = await signup('methods');
  assert.equal((await call('POST', '/orders', { token, body: orderBody({ paymentMethod: 'card' }) })).status, 400);
  assert.equal((await call('POST', '/orders', { token, body: orderBody({ paymentMethod: 'qrph' }) })).status, 201);
  assert.equal((await call('POST', '/orders', { token, body: orderBody({ paymentMethod: 'bank_transfer' }) })).status, 201);
});

test('cash orders cannot use the online payment endpoint', async () => {
  const token = await signup('cashpay');
  const { body: order } = await call('POST', '/orders', { token, body: orderBody({ paymentMethod: 'cash' }) });
  const res = await call('POST', `/orders/${order._id}/pay`, { token });
  assert.equal(res.status, 400);
});

test('delivery fee is public to read, admin-only to change, and applies to new orders', async () => {
  assert.equal((await call('GET', '/settings')).body.deliveryFee, 50);

  const customer = await signup('fee');
  const adminToken = await login('admin@test.dev', 'Admin123!');
  const staffToken = await login('staff@test.dev', 'Staff123!');

  assert.equal((await call('PUT', '/settings', { token: customer, body: { deliveryFee: 10 } })).status, 403);
  assert.equal((await call('PUT', '/settings', { token: staffToken, body: { deliveryFee: 10 } })).status, 403);
  assert.equal((await call('PUT', '/settings', { token: adminToken, body: { deliveryFee: -5 } })).status, 400);

  const changed = await call('PUT', '/settings', { token: adminToken, body: { deliveryFee: 80 } });
  assert.equal(changed.body.deliveryFee, 80);

  const { body: order } = await call('POST', '/orders', { token: customer, body: orderBody() });
  assert.equal(order.deliveryFee, 80);
  assert.equal(order.totalAmount, 2 * 280 + 80);

  await Setting.updateOne({ key: 'main' }, { deliveryFee: 50 });
});

test('customers list is admin-only with order counts, and the users list excludes customers', async () => {
  const adminToken = await login('admin@test.dev', 'Admin123!');
  const staffToken = await login('staff@test.dev', 'Staff123!');

  assert.equal((await call('GET', '/customers', { token: staffToken })).status, 403);

  const customers = await call('GET', '/customers', { token: adminToken });
  assert.equal(customers.status, 200);
  const alice = customers.body.find((c) => c.email === 'calice@test.dev');
  assert.equal(alice.orders, 1);
  assert.ok(customers.body.every((c) => c.email && !('password' in c)));

  const users = await call('GET', '/users', { token: adminToken });
  assert.equal(users.status, 200);
  assert.ok(users.body.length >= 2);
  assert.ok(users.body.every((u) => u.role !== 'customer'));
});

test('sales report separates delivery fees and ignores cancelled orders', async () => {
  const adminToken = await login('admin@test.dev', 'Admin123!');
  const token = await signup('report');
  const { body: order } = await call('POST', '/orders', { token, body: orderBody() });
  await call('PUT', `/orders/${order._id}/status`, { token: adminToken, body: { status: 'cancelled' } });

  const report = await call('GET', '/reports/sales', { token: adminToken });
  assert.equal(report.status, 200);
  assert.ok(report.body.totals.deliveryFees > 0);
  const counted = await Order.countDocuments({ status: { $nin: ['cancelled', 'awaiting_payment'] } });
  assert.equal(report.body.totals.orders, counted);
  assert.ok((await OrderItem.countDocuments()) > 0);
});
