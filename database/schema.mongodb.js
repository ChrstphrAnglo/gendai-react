/**
 * Gendai Ordering System: database schema script (MongoDB equivalent of a SQL DDL script).
 *
 * Run with:   mongosh "mongodb://127.0.0.1:27017/gendai" database/schema.mongodb.js
 *
 * Creates the 7 collections with $jsonSchema validators (constraints) and indexes
 * (primary-key-like unique fields and foreign-key lookups).
 *
 * Note: the Mongoose models in server/models enforce the same rules in the app, and
 * `npm run seed` (database/seed.js) loads the sample records. This script is optional
 * because Mongoose creates collections and indexes automatically on first use.
 *
 * Relationships (every _id is an ObjectId primary key):
 *   categories 1 ──< menuitems
 *   orders     1 ──< orderitems >── 1 menuitems
 *   users      1 ──< orders (handledBy)       users 1 ──< activitylogs
 *   users      1 ──< orders (customer)        settings: one document (delivery fee)
 */
const dbName = 'gendai';
const d = db.getSiblingDB(dbName);

['users', 'categories', 'menuitems', 'orders', 'orderitems', 'activitylogs', 'settings'].forEach((c) => d[c].drop());

d.createCollection('users', {
  validator: { $jsonSchema: {
    bsonType: 'object',
    required: ['email', 'password', 'role'],
    properties: {
      username: { bsonType: 'string', minLength: 3, maxLength: 30, pattern: '^[a-zA-Z0-9_]+$' },
      email: { bsonType: 'string', pattern: '^\\S+@\\S+\\.\\S+$' },
      password: { bsonType: 'string', description: 'bcrypt hash' },
      role: { enum: ['admin', 'staff', 'customer'] },
      fullName: { bsonType: 'string', maxLength: 60 },
      phone: { bsonType: 'string', maxLength: 20 },
      isActive: { bsonType: 'bool' },
      failedLoginAttempts: { bsonType: 'int', minimum: 0 },
    },
  } },
});
// Customers have no username, so uniqueness only applies to accounts that have one.
d.users.createIndex({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: 'string' } } });
d.users.createIndex({ email: 1 }, { unique: true });

d.createCollection('categories', {
  validator: { $jsonSchema: {
    bsonType: 'object',
    required: ['name'],
    properties: {
      name: { bsonType: 'string', maxLength: 50 },
      sortOrder: { bsonType: ['int', 'double'], minimum: 0 },
    },
  } },
});
d.categories.createIndex({ name: 1 }, { unique: true });

d.createCollection('menuitems', {
  validator: { $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'price', 'category'],
    properties: {
      name: { bsonType: 'string', maxLength: 100 },
      description: { bsonType: 'string', maxLength: 500 },
      price: { bsonType: ['double', 'int'], minimum: 0 },
      category: { bsonType: 'objectId', description: 'FK → categories._id' },
      available: { bsonType: 'bool' },
    },
  } },
});
d.menuitems.createIndex({ category: 1 });

d.createCollection('orders', {
  validator: { $jsonSchema: {
    bsonType: 'object',
    required: ['orderNo', 'customerName', 'paymentMethod', 'status', 'totalAmount'],
    properties: {
      orderNo: { bsonType: 'string' },
      customerName: { bsonType: 'string', maxLength: 60 },
      customer: { bsonType: ['objectId', 'null'], description: 'FK → users._id (the customer)' },
      contactPhone: { bsonType: 'string', maxLength: 20 },
      deliveryAddress: { bsonType: 'object' },
      paymentStatus: { enum: ['unpaid', 'paid'] },
      deliveryFee: { bsonType: ['double', 'int'], minimum: 0 },
      paymentMethod: { enum: ['cash', 'card', 'gcash'] },
      status: { enum: ['preparing', 'out_for_delivery', 'delivered', 'cancelled'] },
      totalAmount: { bsonType: ['double', 'int'], minimum: 0 },
      handledBy: { bsonType: ['objectId', 'null'], description: 'FK → users._id' },
    },
  } },
});
d.orders.createIndex({ orderNo: 1 }, { unique: true });
d.orders.createIndex({ status: 1 });
d.orders.createIndex({ customer: 1 });
d.orders.createIndex({ createdAt: -1 });

d.createCollection('orderitems', {
  validator: { $jsonSchema: {
    bsonType: 'object',
    required: ['order', 'menuItem', 'quantity', 'unitPrice', 'subtotal'],
    properties: {
      order: { bsonType: 'objectId', description: 'FK → orders._id' },
      menuItem: { bsonType: 'objectId', description: 'FK → menuitems._id' },
      quantity: { bsonType: ['int', 'double'], minimum: 1, maximum: 50 },
      unitPrice: { bsonType: ['double', 'int'], minimum: 0 },
      subtotal: { bsonType: ['double', 'int'], minimum: 0 },
    },
  } },
});
d.orderitems.createIndex({ order: 1 });
d.orderitems.createIndex({ menuItem: 1 });

d.createCollection('activitylogs', {
  validator: { $jsonSchema: {
    bsonType: 'object',
    required: ['user', 'action'],
    properties: {
      user: { bsonType: 'objectId', description: 'FK → users._id' },
      action: { bsonType: 'string' },
      details: { bsonType: 'string' },
    },
  } },
});
d.activitylogs.createIndex({ user: 1 });
d.activitylogs.createIndex({ createdAt: -1 });

d.createCollection('settings');
d.settings.createIndex({ key: 1 }, { unique: true });

print('Schema created in database "' + dbName + '". Now run: cd server && npm run seed');
