# Gendai Ordering System (React + Express + MongoDB)

Ordering system for one restaurant (Gendai), with two customer apps and one staff area:

- **Delivery app**: customers sign up, order for delivery to their address, pay and track the order.
- **Table QR app** (dine in / take out): guests scan the QR code on their table, tap **Dine in** or **Take out**, order from the menu without an account, and pay with **QR Ph, GCash, bank transfer or cash**. No login, and no links into the delivery app.
- **Staff area**: kitchen ticket board, front desk (payment alerts), orders, menu, tables and QR codes, payment accounts, reports.

It is an installable web app (PWA): on Android or iPhone, open the site and choose *Add to Home Screen*.
It deploys to **Vercel** as a single project (React build + the Express API as a serverless function).

```
gendai-react/
  client/    React 19 + Vite + React Router + Axios   (http://localhost:5173)
  server/    Express 5 REST API + Mongoose           (http://localhost:5001)
  api/       Vercel serverless entry that runs server/app.js
  database/  schema.mongodb.js, seed.js (sample data), seed-tables.js, migrate-delivery.js
  docs/      design spec for the delivery version
  vercel.json
```

## Run it locally

Prerequisites: **Node.js 20+** and **MongoDB** running locally (`mongodb://127.0.0.1:27017`).

```bash
# 1. install (from the project root)
npm run install:all

# 2. configure (the defaults already work for local development)
#    server/.env  <- copy from server/.env.example   (MONGODB_URI, PORT, JWT_SECRET, ...)
#    client/.env is optional: without it the client calls /api, which Vite proxies to http://localhost:5001

# 3. load sample data into the EMPTY database (first run only)
npm run seed

# 4. start both (two terminals)
npm run server                 # API on :5001
npm run client                 # UI  on :5173
```

Then open **http://localhost:5173**.

> **Careful with `npm run seed`.** It deletes everything in the database before loading sample data, so it refuses to run on a database that already has data. Use `npm run seed -- --force` only if you really want a full reset.
>
> Already have data? `npm run seed:tables` only adds tables T1–T8 (skips any that exist).

### Demo accounts

Staff and delivery customers log in with **email + password** at `/login`. Table QR guests never log in.

| Role     | Email                  | Password       | Can do |
|----------|------------------------|----------------|--------|
| Admin    | `admin@gendai.test`    | `Admin123!`    | Everything: menu, categories, tables & QR, users, customers, payment accounts, reports, activity log, delete orders |
| Staff    | `staff@gendai.test`    | `Staff123!`    | Dashboard, orders, kitchen board, front desk (confirm payments) |
| Staff    | `kitchen@gendai.test`  | `Kitchen123!`  | Same as staff |
| Customer | `customer@gendai.test` | `Customer123!` | Delivery orders, payment, tracking, order history |

## How dine in and take out work

1. An admin adds tables under **Tables & QR** and prints the QR codes (print from the live site so the codes contain the real address).
2. A guest scans the table's code (`/t/<code>`) and sees **Dine in** / **Take out**.
3. **Dine in**: every phone that scans the same table joins one shared bill. Each "Send to kitchen" puts a ticket on the **Kitchen** board right away; guests can order more rounds. When done, they scan again (or tap *Bill*) and pay.
4. **Take out**: the guest enters a name, places one order and pays first. The kitchen only sees it once the payment is confirmed.
5. **Paying**: QR Ph, GCash and bank transfer show the restaurant's own QR codes / account numbers (set under **Settings → Payment accounts**), so the money goes straight to the restaurant's account. The guest taps *I've paid* (optionally with the reference number). **Cash** alerts the front desk ("Table 4 will pay cash"). Card payments are not offered.
6. The **Front Desk** page (and a badge, toast and sound on every staff page) shows each request. Staff check their bank / GCash app or collect the cash, then press **Payment received**. The guest's screen turns to "Thank you", and the table is ready for the next guests.

Kitchen statuses: dine in **Preparing → Ready → Served**; take out **Awaiting payment → Preparing → Ready → Picked up**; delivery **Preparing → Out for delivery → Delivered**.

## How a delivery order works

1. Customer signs up or logs in, browses `/menu` and adds dishes.
2. At `/cart` they enter recipient, phone and address, and choose Cash on Delivery, QR Ph, GCash or Bank transfer.
3. The server recalculates prices and adds the flat delivery fee (set by an admin under **Settings**, default 50).
4. QR Ph / GCash / bank transfer show the restaurant's payment details; the customer taps *I've paid* and the order shows *Checking payment* until staff press **Confirm payment** on the Orders page. Cash orders are marked paid by staff on delivery.
5. Staff move the order through the delivery statuses; the customer follows it on the tracking page and in **My orders**.

## Pages

| Route | Who | What |
|-------|-----|------|
| `/` | Anyone | Landing page |
| `/login`, `/signup`, `/forgot-password` | Anyone | Auth pages (forgot password is a placeholder) |
| `/menu` | Anyone | Delivery menu (a login is needed to check out) |
| `/cart`, `/pay/:id`, `/order-success/:id`, `/orders` | Customer | Delivery checkout, payment details, live tracking, order history |
| `/t/:code` | Table guests | Dine in / Take out choice for that table |
| `/dine`, `/dine/cart`, `/dine/bill`, `/dine/pay` | Table guests | Menu, send to kitchen, running bill and order progress, payment |
| `/admin/dashboard`, `/admin/orders` | Staff + Admin | KPIs, revenue chart; order list with type / status filters |
| `/admin/kitchen`, `/admin/front-desk` | Staff + Admin | Live ticket board; payment requests, open bills, paid today |
| `/admin/tables` | Admin | Add / rename / switch off tables, new QR code, print QR sheet |
| `/admin/menu`, `/admin/categories`, `/admin/users`, `/admin/customers`, `/admin/settings`, `/admin/activity` | Admin | CRUD, image upload, roles, customers, delivery fee + payment accounts, audit trail |
| `/admin/reports/sales`, `/admin/reports/best-sellers` | Admin | Date-range reports (sales by day, category or order type) with a print layout |

## Database (MongoDB, 9 collections)

```
categories 1──< menuitems >──< orderitems >── 1 orders >── 1 users (customer, handledBy)
tables 1──< diningsessions 1──< orders            users 1──< activitylogs
settings: a single document (delivery fee + payment accounts)
```

| Collection | Key points |
|------------|------------|
| users | unique email, bcrypt password, role in {admin, staff, customer}, saved default address, lockout after 5 bad logins |
| categories | unique name |
| menuitems | price >= 0, category reference, available flag, image (file name or Vercel Blob URL) |
| orders | unique orderNo, channel in {delivery, dine_in, takeout}, customer (delivery) or session + tableLabel (dine in / take out), kitchen notes, paymentMethod in {cash, qrph, gcash, bank_transfer}, paymentStatus in {unpaid, verifying, paid}, status per channel (see above) |
| orderitems | order + menuItem references, quantity 1-50, unit price snapshot, subtotal |
| tables | unique label, random QR token, active flag |
| diningsessions | one table bill or take-out: kind, table, short code (DI-1234 / TO-1234), secret guest token, status in {open, payment_pending, paid, cancelled}, payment method + reference, total |
| activitylogs | user reference, action, details |
| settings | deliveryFee, payment (QR Ph / GCash QR images and names, GCash number, bank details) |

## REST API

Base URL `/api`. Errors always look like `{ message, code, errors?: [{field, message}] }`.

| Resource | Endpoints | Access |
|----------|-----------|--------|
| `/auth` | `POST /login`, `POST /register`, `PUT /profile`, `POST /logout`, `GET /verify` | login/register public, rest logged in |
| `/categories`, `/menu` | list / get / create / update / delete | read public, write admin |
| `/orders` | `POST /`, `GET /mine`, `GET /:id`, `POST /:id/pay` (records "I've paid" + reference) | customer (own orders) |
| `/orders` | `GET /` (`status`, `channel`, `search`, `from`, `to`), `PUT /:id/status`, `PUT /:id/paid` | staff + admin |
| `/orders` | `DELETE /:id` | admin |
| `/dine` | `GET /tables/:code`, `POST /sessions`; with header `X-Guest-Token`: `GET /session`, `POST /session/orders`, `POST /session/payment`, `DELETE /session/payment` | public (table guests) |
| `/service` | `GET /kitchen`, `GET /front-desk`, `GET /summary`, `POST /sessions/:id/confirm`, `POST /sessions/:id/cancel` | staff + admin |
| `/tables` | list, create, update, `POST /:id/regenerate`, delete | admin |
| `/settings` | `GET /` (fee + payment details), `PUT /` (fee), `PUT /payment` (multipart: QR images + account details) | read public, write admin |
| `/users`, `/customers` | staff accounts; read-only customer list | admin |
| `/reports` | `/dashboard` (staff + admin), `/sales` (`groupBy=day|category|channel`), `/best-sellers`, `/activity` | admin |

Order totals are always calculated on the server; prices sent by the client are ignored.

## Deploy to Vercel

You need: a **Vercel** account, a free **MongoDB Atlas** cluster, and a **Vercel Blob** store (for uploaded images, since Vercel's disk is read-only).

1. **Database**: create an Atlas cluster, a database user, and allow access from anywhere (`0.0.0.0/0`, Vercel has no fixed IP). Copy the connection string, e.g. `mongodb+srv://user:pass@cluster.mongodb.net/gendai`.
2. **Load data into Atlas** from this computer:
   `MONGODB_URI="mongodb+srv://…/gendai" npm run seed` (empty database) and/or `npm run seed:tables`.
3. **Create the project**: from the project root run `vercel` (or import the repo in the Vercel dashboard). `vercel.json` already sets the install/build commands, the output folder and the `/api` routing.
4. **Environment variables** (Project → Settings → Environment Variables):
   | Name | Value |
   |------|-------|
   | `MONGODB_URI` | the Atlas connection string |
   | `JWT_SECRET` | a long random string |
   | `JWT_EXPIRES_IN` | `8h` |
   | `BLOB_READ_WRITE_TOKEN` | added automatically when you create a Blob store under Storage and connect it to the project |
5. Deploy to production: `vercel --prod`. Then log in as admin on the live address, change the demo passwords, fill in **Settings → Payment accounts**, and print the table QR codes from **Tables & QR**.

The menu photos in `server/uploads` are bundled with the deployment; new uploads go to Vercel Blob.

## Tests

```bash
npm test          # from the project root (runs server/tests)
```

The tests use their own database (`gendai_test`) and never touch the real one. They need MongoDB running.

## Notes

- Payments go directly to the restaurant's own accounts; the app never handles money. Staff confirm each QR / bank / cash payment by hand. Moving to an automatic gateway (e.g. PayMongo) later only changes the payment step.
- Live screens (kitchen, front desk, guest bill) refresh by polling every few seconds, so they work on Vercel's serverless functions without websockets.
- Staff accounts are created by an admin under **Users**. Customers sign up themselves.
- Forgot-password is a placeholder because email sending isn't set up.
