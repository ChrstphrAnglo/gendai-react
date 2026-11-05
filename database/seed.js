/**
 * Seed script: wipes the Gendai database and loads sample records.
 * Run from the server folder:  npm run seed
 *
 * It refuses to run when the database already holds users or orders, because it
 * deletes everything first. Pass --force to wipe and re-seed anyway:
 *   npm run seed -- --force
 */
const path = require('path');
const { createRequire } = require('module');

// Reuse the server's installed packages and models.
const serverDir = path.join(__dirname, '..', 'server');
const serverRequire = createRequire(path.join(serverDir, 'package.json'));
serverRequire('dotenv').config({ path: path.join(serverDir, '.env') });
const mongoose = serverRequire('mongoose');

const User = require(path.join(serverDir, 'models/User'));
const Category = require(path.join(serverDir, 'models/Category'));
const MenuItem = require(path.join(serverDir, 'models/MenuItem'));
const Order = require(path.join(serverDir, 'models/Order'));
const OrderItem = require(path.join(serverDir, 'models/OrderItem'));
const ActivityLog = require(path.join(serverDir, 'models/ActivityLog'));
const Setting = require(path.join(serverDir, 'models/Setting'));
const Table = require(path.join(serverDir, 'models/Table'));
const DiningSession = require(path.join(serverDir, 'models/DiningSession'));

const FORCE = process.argv.includes('--force');
const ADDRESSES = [
  { street: '12 Rizal St.', barangay: 'San Antonio', city: 'Makati', notes: 'Blue gate, ring the bell' },
  { street: '48 Mabini Ave.', barangay: 'Poblacion', city: 'Makati', notes: 'Unit 3B' },
  { street: '5 Katipunan Rd.', barangay: 'Loyola Heights', city: 'Quezon City', notes: 'Guard house, leave with guard' },
  { street: '221 Aguinaldo Hwy.', barangay: 'Zone 4', city: 'Pasig', notes: '' },
];
const PHONES = ['0917 123 4567', '0918 234 5678', '0920 345 6789', '0927 456 7890'];

const CATEGORIES = ['Appetizers', 'Sushi', 'Maki Rolls', 'Ramen', 'Noodles', 'Rice Bowls', 'Mains', 'Desserts', 'Add-ons'];

// [name, category, price, image, description]
const MENU = [
  ['Gyoza', 'Appetizers', 180, 'Gyoza.png', 'Pan-fried pork dumplings with dipping sauce.'],
  ['Edamame', 'Appetizers', 120, 'Edamame.png', 'Steamed young soybeans with sea salt.'],
  ['Ebi Tempura', 'Appetizers', 250, 'Ebi tempura.png', 'Crispy battered prawns served with tentsuyu.'],
  ['Ebi Fry', 'Appetizers', 240, 'Ebi fry.png', 'Breaded and deep-fried prawns with tartar sauce.'],
  ['Yakitori', 'Appetizers', 200, 'Yakitori.png', 'Grilled chicken skewers glazed in tare.'],
  ['Green Salad', 'Appetizers', 150, 'Green salad.png', 'Fresh greens with sesame dressing.'],
  ['Kani Kyu', 'Appetizers', 190, 'Kani kyu.png', 'Crab stick wrapped around cucumber.'],
  ['Kani Kyu Special', 'Appetizers', 230, 'Kani kyu special.png', 'Kani kyu topped with kani salad and mayo.'],
  ['Salmon Sushi', 'Sushi', 140, 'Salmon sushi.png', 'Fresh salmon over seasoned rice (2 pcs).'],
  ['Ebi Sushi', 'Sushi', 120, 'Ebi sushi.png', 'Boiled prawn over seasoned rice (2 pcs).'],
  ['Kani Sushi', 'Sushi', 110, 'Kani sushi.png', 'Crab stick over seasoned rice (2 pcs).'],
  ['Salmon Sashimi', 'Sushi', 320, 'Salmon sashimi.png', 'Thick-cut slices of fresh salmon (6 pcs).'],
  ['California Roll', 'Maki Rolls', 220, 'California roll.png', 'Kani, avocado and cucumber with tobiko.'],
  ['Gendai Roll', 'Maki Rolls', 320, 'Gendai roll.png', 'House special roll with salmon, ebi and cream cheese.'],
  ['Kani Maki', 'Maki Rolls', 200, 'Kani maki.png', 'Classic crab stick maki.'],
  ['Salmon Aburi Roll', 'Maki Rolls', 340, 'Salmon aburi roll.png', 'Torched salmon over a kani roll with aburi sauce.'],
  ['Spicy Salmon Roll', 'Maki Rolls', 290, 'Spicy salmon roll.png', 'Salmon with spicy mayo and cucumber.'],
  ['Unagi Maki', 'Maki Rolls', 330, 'Unagi maki.png', 'Grilled eel with kabayaki sauce.'],
  ['Volcano Roll', 'Maki Rolls', 360, 'Volcano roll.png', 'Baked spicy kani topping over a California roll.'],
  ['Shoyu Ramen', 'Ramen', 280, 'Shoyu-ramen-1765601828843-209301709.png', 'Soy-based broth with chashu, egg and nori.'],
  ['Shio Ramen', 'Ramen', 270, 'Shio-ramen-1765582253936-406951905.png', 'Light salt broth with chashu and bamboo shoots.'],
  ['Spicy Tonkotsu Ramen', 'Ramen', 310, 'Spicy-tonkotsu-ramen-1764998482094-986182429.png', 'Rich pork bone broth with chili oil.'],
  ['Yaki Udon', 'Noodles', 240, 'Yaki udon.png', 'Stir-fried udon with vegetables and pork.'],
  ['Zaru Soba', 'Noodles', 220, 'Zaru soba.png', 'Chilled buckwheat noodles with dipping sauce.'],
  ['Soumen', 'Noodles', 200, 'Soumen.png', 'Thin wheat noodles served cold.'],
  ['Katsudon', 'Rice Bowls', 270, 'Katsudon.png', 'Pork cutlet and egg simmered over rice.'],
  ['Oyakodon', 'Rice Bowls', 240, 'Oyakodon.png', 'Chicken and egg simmered over rice.'],
  ['Pork Teriyakidon', 'Rice Bowls', 250, 'Pork teriyakidon.png', 'Teriyaki-glazed pork over rice.'],
  ['Chicken Teriyakidon', 'Rice Bowls', 240, 'Chicken teriyakidon.png', 'Teriyaki-glazed chicken over rice.'],
  ['Yakinikudon', 'Rice Bowls', 280, 'Yakinikudon.png', 'Grilled beef over rice with yakiniku sauce.'],
  ['Gyuniku Shoyu Yaki Don', 'Rice Bowls', 290, 'Gyuniku shoyu yaki don.png', 'Soy-grilled beef over rice.'],
  ['Ebi Tendon', 'Rice Bowls', 280, 'Ebi tendon.png', 'Prawn tempura over rice with tendon sauce.'],
  ['Katsu Curry Rice', 'Mains', 290, 'Katsu curry rice.png', 'Crispy pork cutlet with Japanese curry.'],
  ['Sukiyaki', 'Mains', 380, 'Sukiyaki.png', 'Simmered beef and vegetables in sweet soy broth.'],
  ['Mochi', 'Desserts', 130, 'Mochi.png', 'Soft rice cake with sweet filling.'],
  ['Miso Soup', 'Add-ons', 60, 'Misosoup.png', 'Traditional tofu and seaweed miso soup.'],
  ['Tofu Steak', 'Add-ons', 175, 'Tofusteak.png', 'Pan-seared tofu in savory sauce.'],
  ['Crazy Maki', 'Add-ons', 235, 'Crazymaki.png', 'Crunchy tempura maki with special sauce.'],
  ['Futomaki', 'Add-ons', 245, 'Futomaki.png', 'Thick sushi roll with egg, kanpyo and vegetables.'],
  ['Spicy Salmon Salad', 'Add-ons', 230, 'Spicysalmonsalad.png', 'Salmon cubes in a spicy dressing over greens.'],
  ['Gyudon', 'Add-ons', 250, 'Gyudon.png', 'Beef and onion simmered over rice.'],
];

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];
const round2 = (n) => Math.round(n * 100) / 100;

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);

  const [existingUsers, existingOrders] = await Promise.all([User.countDocuments(), Order.countDocuments()]);
  if ((existingUsers || existingOrders) && !FORCE) {
    console.error(`Refusing to seed: the database already has ${existingUsers} users and ${existingOrders} orders.`);
    console.error('Seeding deletes all existing data. Re-run with --force if that is what you want:  npm run seed -- --force');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('Connected. Clearing existing data…');
  await Promise.all([User, Category, MenuItem, Order, OrderItem, ActivityLog, Setting, Table, DiningSession].map((m) => m.deleteMany({})));
  await User.syncIndexes();
  await Setting.create({ key: 'main' });

  // Users (passwords are hashed by the model's pre-save hook)
  const admin = await User.create({ username: 'admin', email: 'admin@gendai.test', password: 'Admin123!', role: 'admin' });
  const staff = await User.create({ username: 'staff', email: 'staff@gendai.test', password: 'Staff123!', role: 'staff' });
  const staff2 = await User.create({ username: 'kitchen', email: 'kitchen@gendai.test', password: 'Kitchen123!', role: 'staff' });
  const customers = await Promise.all([
    ['Maria Santos', 'customer@gendai.test'],
    ['Juan Dela Cruz', 'juan@gendai.test'],
    ['Ana Reyes', 'ana@gendai.test'],
  ].map(([fullName, email], i) => User.create({
    fullName, email, phone: PHONES[i], password: 'Customer123!', role: 'customer', address: ADDRESSES[i],
  })));
  const deliveryFee = (await Setting.get()).deliveryFee;

  // Categories
  const cats = await Category.insertMany(CATEGORIES.map((name, i) => ({ name, sortOrder: i })));
  const catId = Object.fromEntries(cats.map((c) => [c.name, c._id]));

  // Menu items
  const items = await MenuItem.insertMany(MENU.map(([name, cat, price, image, description]) => ({
    name, description, price, image, category: catId[cat], available: true,
  })));
  // One item is sold out so the "unavailable" state is visible in the UI.
  await MenuItem.updateOne({ name: 'Sukiyaki' }, { available: false });
  const orderable = items.filter((i) => i.name !== 'Sukiyaki');

  // ~45 orders spread over the last 14 days
  const handlers = [admin, staff, staff2];
  const now = Date.now();
  let seq = 1;
  const orderDocs = [];
  const orderItemDocs = [];

  for (let n = 0; n < 45; n++) {
    const daysAgo = n < 8 ? 0 : rand(14);
    const when = new Date(now - daysAgo * 86400000 - rand(10) * 3600000 - rand(60) * 60000);
    if (daysAgo === 0 && when > new Date()) when.setTime(now - rand(120) * 60000);

    const picked = new Map();
    const lineCount = 1 + rand(4);
    for (let l = 0; l < lineCount; l++) {
      const m = pick(orderable);
      picked.set(String(m._id), { m, quantity: (picked.get(String(m._id))?.quantity || 0) + 1 + rand(2) });
    }

    let status = 'delivered';
    if (daysAgo === 0) status = pick(['preparing', 'preparing', 'out_for_delivery', 'delivered']);
    else if (Math.random() < 0.06) status = 'cancelled';

    const customer = pick(customers);
    const paymentMethod = pick(['cash', 'cash', 'qrph', 'gcash', 'bank_transfer']);
    // Online payments are paid up front; cash is collected on delivery.
    const paymentStatus = status === 'cancelled' ? 'unpaid'
      : paymentMethod !== 'cash' || status === 'delivered' ? 'paid' : 'unpaid';

    const _id = new mongoose.Types.ObjectId();
    const lines = [...picked.values()].map(({ m, quantity }) => ({
      order: _id, menuItem: m._id, quantity, unitPrice: m.price, subtotal: round2(m.price * quantity),
    }));
    const d = new Date(when);
    orderDocs.push({
      _id,
      orderNo: `GD-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(1000 + seq++).slice(-4)}`,
      customer: customer._id,
      customerName: customer.fullName,
      contactPhone: customer.phone,
      deliveryAddress: customer.address,
      paymentMethod,
      paymentStatus,
      status,
      deliveryFee,
      totalAmount: round2(lines.reduce((s, l) => s + l.subtotal, 0) + deliveryFee),
      handledBy: status === 'preparing' ? null : pick(handlers)._id,
      createdAt: when,
      updatedAt: when,
    });
    orderItemDocs.push(...lines.map((l) => ({ ...l, createdAt: when, updatedAt: when })));
  }

  // timestamps:false keeps our back-dated createdAt values.
  await Order.insertMany(orderDocs, { timestamps: false });
  await OrderItem.insertMany(orderItemDocs, { timestamps: false });

  await ActivityLog.insertMany([
    { user: admin._id, action: 'LOGIN', details: 'admin logged in' },
    { user: admin._id, action: 'USER_CREATE', details: 'staff (staff)' },
    { user: admin._id, action: 'MENU_CREATE', details: 'Gyoza' },
    { user: staff._id, action: 'LOGIN', details: 'staff logged in' },
    { user: staff._id, action: 'ORDER_STATUS', details: `${orderDocs[0].orderNo}: preparing → out_for_delivery` },
  ]);

  // Dining tables for the QR codes (print them under Admin → Tables & QR).
  const tables = await Table.insertMany(Array.from({ length: 8 }, (_, i) => ({ label: `T${i + 1}`, sortOrder: i })));

  console.log(`Seeded: ${tables.length} tables, 3 staff, ${customers.length} customers, ${cats.length} categories, ${items.length} menu items, ${orderDocs.length} orders, ${orderItemDocs.length} order items.`);
  console.log('Logins (email / password):');
  console.log('  admin@gendai.test     / Admin123!');
  console.log('  staff@gendai.test     / Staff123!');
  console.log('  kitchen@gendai.test   / Kitchen123!');
  console.log('  customer@gendai.test  / Customer123!');
  await mongoose.disconnect();
}

seed().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
