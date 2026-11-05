/**
 * Adds dining tables T1–T8 for the QR codes, without touching anything else.
 * Safe to run on a database that already has data, and safe to run twice (existing tables are kept).
 * Run from the server folder:  npm run seed:tables
 * Pass a number to create a different count:  npm run seed:tables -- 12
 */
const path = require('path');
const { createRequire } = require('module');

const serverDir = path.join(__dirname, '..', 'server');
const serverRequire = createRequire(path.join(serverDir, 'package.json'));
serverRequire('dotenv').config({ path: path.join(serverDir, '.env') });
const mongoose = serverRequire('mongoose');
const Table = require(path.join(serverDir, 'models/Table'));

const count = Math.min(Math.max(parseInt(process.argv[2], 10) || 8, 1), 100);

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  let added = 0;
  for (let i = 1; i <= count; i++) {
    const label = `T${i}`;
    const res = await Table.updateOne(
      { label },
      { $setOnInsert: { label, sortOrder: i - 1, token: Table.newToken(), active: true } },
      { upsert: true }
    );
    added += res.upsertedCount;
  }
  console.log(`Tables ready: ${added} added, ${count - added} already existed.`);
  await mongoose.disconnect();
})().catch((err) => { console.error('Could not add tables:', err.message); process.exit(1); });
