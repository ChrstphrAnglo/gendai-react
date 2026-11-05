// Dine-in / take-out via table QR codes. Run with:  npm test   (needs MongoDB; uses its own database)
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
const Table = require('../models/Table');

let server;
let base;
let ramen;
let gyoza;
let table;
let staffToken;
let adminToken;

const call = async (method, path, { token, guest, body } = {}) => {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(guest && { 'X-Guest-Token': guest }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const login = async (email, password) => (await call('POST', '/auth/login', { body: { email, password } })).body.token;
const start = async (kind, tableToken = table.token) => (await call('POST', '/dine/sessions', { body: { tableToken, kind } })).body;
const items = (...lines) => lines.map(([m, quantity]) => ({ menuItem: String(m._id), quantity }));

before(async () => {
  await mongoose.connect(TEST_URI);
  await mongoose.connection.dropDatabase();
  await User.syncIndexes();
  await User.create({ username: 'admin', email: 'admin@test.dev', password: 'Admin123!', role: 'admin' });
  await User.create({ username: 'staff', email: 'staff@test.dev', password: 'Staff123!', role: 'staff' });
  const cat = await Category.create({ name: 'Ramen', sortOrder: 0 });
  ramen = await MenuItem.create({ name: 'Shoyu Ramen', price: 280, category: cat._id, available: true });
  gyoza = await MenuItem.create({ name: 'Gyoza', price: 180, category: cat._id, available: true });
  table = await Table.create({ label: 'T1' });

  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  staffToken = await login('staff@test.dev', 'Staff123!');
  adminToken = await login('admin@test.dev', 'Admin123!');
});

after(async () => {
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('a table QR code resolves without login; unknown or inactive codes do not', async () => {
  const ok = await call('GET', `/dine/tables/${table.token}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.label, 'T1');
  assert.equal((await call('GET', '/dine/tables/nope-not-a-table')).status, 404);

  const off = await Table.create({ label: 'Closed', active: false });
  assert.equal((await call('GET', `/dine/tables/${off.token}`)).status, 404);
  assert.equal((await call('POST', '/dine/sessions', { body: { tableToken: off.token, kind: 'dine_in' } })).status, 404);
});

test('dine in: phones at the same table share one bill; orders go straight to the kitchen', async () => {
  const phoneA = await start('dine_in');
  const phoneB = await start('dine_in');
  assert.equal(phoneA.session._id, phoneB.session._id);
  assert.equal(phoneA.guestToken, phoneB.guestToken);
  assert.ok(!('guestToken' in phoneA.session));

  assert.equal((await call('GET', '/dine/session')).status, 401);
  assert.equal((await call('GET', '/dine/session', { guest: 'forged' })).status, 401);

  const first = await call('POST', '/dine/session/orders', { guest: phoneA.guestToken, body: { items: items([ramen, 2]), notes: 'No egg' } });
  assert.equal(first.status, 201);
  const second = await call('POST', '/dine/session/orders', { guest: phoneB.guestToken, body: { items: items([gyoza, 1]) } });
  assert.equal(second.body.orders.length, 2);
  assert.equal(second.body.totalAmount, 2 * 280 + 180);
  assert.equal(second.body.orders[0].status, 'preparing');
  assert.equal(second.body.orders[0].channel, 'dine_in');
  assert.equal(second.body.orders[0].tableLabel, 'T1');
  assert.equal(second.body.orders[0].deliveryFee, 0);

  const kitchen = await call('GET', '/service/kitchen', { token: staffToken });
  assert.equal(kitchen.status, 200);
  assert.equal(kitchen.body.filter((o) => o.session === phoneA.session._id).length, 2);
  assert.equal(kitchen.body.find((o) => o.notes === 'No egg').items[0].menuItem.name, 'Shoyu Ramen');
  assert.equal((await call('GET', '/service/kitchen')).status, 401);
});

test('dine in: paying by cash alerts the front desk; staff confirm and the table is free again', async () => {
  const { guestToken, session } = await start('dine_in');
  const pay = await call('POST', '/dine/session/payment', { guest: guestToken, body: { method: 'cash' } });
  assert.equal(pay.status, 200);
  assert.equal(pay.body.status, 'payment_pending');

  // Nothing more can be ordered while the bill is being settled.
  const blocked = await call('POST', '/dine/session/orders', { guest: guestToken, body: { items: items([gyoza, 1]) } });
  assert.equal(blocked.status, 409);

  const summary = await call('GET', '/service/summary', { token: staffToken });
  const alert = summary.body.paymentRequests.find((r) => r._id === session._id);
  assert.equal(alert.paymentMethod, 'cash');
  assert.equal(alert.tableLabel, 'T1');

  const desk = await call('GET', '/service/front-desk', { token: staffToken });
  assert.ok(desk.body.sessions.some((s) => s._id === session._id && s.status === 'payment_pending'));

  const confirmed = await call('POST', `/service/sessions/${session._id}/confirm`, { token: staffToken });
  assert.equal(confirmed.body.status, 'paid');
  assert.ok(confirmed.body.orders.every((o) => o.paymentStatus === 'paid' && o.paymentMethod === 'cash'));

  // The guest's phone sees the bill is closed; the next scan starts a fresh bill.
  assert.equal((await call('GET', '/dine/session', { guest: guestToken })).body.status, 'paid');
  const next = await start('dine_in');
  assert.notEqual(next.session._id, session._id);
  assert.equal(next.session.orders.length, 0);
});

test('dine in: a QR payment carries the reference and can be withdrawn to order more', async () => {
  const { guestToken } = await start('dine_in');
  await call('POST', '/dine/session/orders', { guest: guestToken, body: { items: items([ramen, 1]) } });

  assert.equal((await call('POST', '/dine/session/payment', { guest: guestToken, body: { method: 'card' } })).status, 400);
  const pay = await call('POST', '/dine/session/payment', { guest: guestToken, body: { method: 'gcash', reference: 'GC-998877' } });
  assert.equal(pay.body.paymentReference, 'GC-998877');
  assert.ok(pay.body.orders.every((o) => o.paymentStatus === 'verifying'));

  const back = await call('DELETE', '/dine/session/payment', { guest: guestToken });
  assert.equal(back.body.status, 'open');
  assert.ok(back.body.orders.every((o) => o.paymentStatus === 'unpaid'));
  assert.equal((await call('POST', '/dine/session/orders', { guest: guestToken, body: { items: items([gyoza, 1]) } })).status, 201);
});

test('an empty bill cannot be paid', async () => {
  const fresh = await Table.create({ label: 'T9' });
  const { guestToken } = await start('dine_in', fresh.token);
  assert.equal((await call('POST', '/dine/session/payment', { guest: guestToken, body: { method: 'cash' } })).status, 400);
});

test('take out: pay first, the kitchen only sees it once staff confirm payment', async () => {
  const { guestToken, session } = await start('takeout');
  assert.equal(session.kind, 'takeout');
  assert.match(session.code, /^TO-\d{4}$/);

  const noName = await call('POST', '/dine/session/orders', { guest: guestToken, body: { items: items([ramen, 1]) } });
  assert.equal(noName.status, 400);

  const placed = await call('POST', '/dine/session/orders', { guest: guestToken, body: { items: items([ramen, 1]), guestName: 'Kenji' } });
  assert.equal(placed.status, 201);
  const order = placed.body.orders[0];
  assert.equal(order.status, 'awaiting_payment');
  assert.equal(order.customerName, 'Kenji');

  // Only one order per take-out session.
  assert.equal((await call('POST', '/dine/session/orders', { guest: guestToken, body: { items: items([gyoza, 1]), guestName: 'Kenji' } })).status, 409);

  let kitchen = await call('GET', '/service/kitchen', { token: staffToken });
  assert.ok(!kitchen.body.some((o) => o._id === order._id));
  const early = await call('PUT', `/orders/${order._id}/status`, { token: staffToken, body: { status: 'preparing' } });
  assert.equal(early.status, 400);

  await call('POST', '/dine/session/payment', { guest: guestToken, body: { method: 'qrph', reference: 'QR1' } });
  await call('POST', `/service/sessions/${session._id}/confirm`, { token: staffToken });

  kitchen = await call('GET', '/service/kitchen', { token: staffToken });
  assert.equal(kitchen.body.find((o) => o._id === order._id).status, 'preparing');

  for (const status of ['ready', 'completed']) {
    assert.equal((await call('PUT', `/orders/${order._id}/status`, { token: staffToken, body: { status } })).status, 200);
  }
  assert.equal((await call('PUT', `/orders/${order._id}/status`, { token: staffToken, body: { status: 'out_for_delivery' } })).status, 400);
});

test('marking a take-out order paid from the orders list settles its bill too', async () => {
  const { guestToken } = await start('takeout');
  const { body } = await call('POST', '/dine/session/orders', { guest: guestToken, body: { items: items([gyoza, 2]), guestName: 'Aiko' } });
  const paid = await call('PUT', `/orders/${body.orders[0]._id}/paid`, { token: staffToken });
  assert.equal(paid.body.paymentStatus, 'paid');
  assert.equal(paid.body.status, 'preparing');
  assert.equal((await call('GET', '/dine/session', { guest: guestToken })).body.status, 'paid');
});

test('staff can cancel an abandoned bill; its orders leave the kitchen and sales', async () => {
  const { guestToken, session } = await start('dine_in');
  await call('POST', '/dine/session/orders', { guest: guestToken, body: { items: items([ramen, 1]) } });
  const cancelled = await call('POST', `/service/sessions/${session._id}/cancel`, { token: staffToken });
  assert.equal(cancelled.body.status, 'cancelled');
  assert.ok(cancelled.body.orders.every((o) => o.status === 'cancelled'));
  assert.equal((await call('POST', `/service/sessions/${session._id}/confirm`, { token: staffToken })).status, 400);
});

test('tables are admin-managed; a new QR token retires the old one', async () => {
  assert.equal((await call('POST', '/tables', { token: staffToken, body: { label: 'T2' } })).status, 403);
  const created = await call('POST', '/tables', { token: adminToken, body: { label: 'T2' } });
  assert.equal(created.status, 201);
  assert.equal((await call('POST', '/tables', { token: adminToken, body: { label: 'T2' } })).status, 409);

  const oldToken = created.body.token;
  const regen = await call('POST', `/tables/${created.body._id}/regenerate`, { token: adminToken });
  assert.notEqual(regen.body.token, oldToken);
  assert.equal((await call('GET', `/dine/tables/${oldToken}`)).status, 404);

  assert.equal((await call('DELETE', `/tables/${created.body._id}`, { token: adminToken })).status, 200);
  assert.equal((await call('DELETE', `/tables/${table._id}`, { token: adminToken })).status, 409);
});

test('payment details are public to read and admin-only to change', async () => {
  const res = await fetch(`${base}/api/settings/payment`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ gcashName: 'Gendai Restaurant', gcashNumber: '0917 555 0000', bankName: 'BPI', bankAccountNumber: '1234-5678-90' }),
  });
  assert.equal(res.status, 200);
  const pub = await call('GET', '/settings');
  assert.equal(pub.body.payment.gcashNumber, '0917 555 0000');
  assert.equal(pub.body.payment.bankName, 'BPI');

  const staff = await fetch(`${base}/api/settings/payment`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${staffToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ gcashName: 'Hacker' }),
  });
  assert.equal(staff.status, 403);
});

test('sales report can be grouped by order type', async () => {
  const report = await call('GET', '/reports/sales', { token: adminToken, body: undefined });
  assert.equal(report.status, 200);
  const byType = await call('GET', '/reports/sales?groupBy=channel', { token: adminToken });
  assert.equal(byType.status, 200);
  const labels = byType.body.rows.map((r) => r.label);
  assert.ok(labels.includes('Dine in'));
  assert.ok(labels.includes('Take out'));
  assert.equal(byType.body.totals.revenue, report.body.totals.revenue);
});
