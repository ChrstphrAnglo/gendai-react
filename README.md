# Gendai Ordering System

[![CI](https://github.com/ChrstphrAnglo/gendai-react/actions/workflows/ci.yml/badge.svg)](https://github.com/ChrstphrAnglo/gendai-react/actions/workflows/ci.yml)

A full-stack ordering system for a Japanese restaurant: guests order from their table by scanning a QR code, customers can order for delivery, and staff run the kitchen, front desk and back office from one admin area.

## Screenshots

| Landing page | Table menu | Kitchen board |
| --- | --- | --- |
| ![Landing page](docs/screenshots/landing.png) | ![Table menu](docs/screenshots/dine-menu.png) | ![Kitchen board](docs/screenshots/kitchen.png) |

| Front desk | Admin dashboard | Sales report |
| --- | --- | --- |
| ![Front desk](docs/screenshots/front-desk.png) | ![Admin dashboard](docs/screenshots/dashboard.png) | ![Sales report](docs/screenshots/sales-report.png) |

## Features

**Guests (no account needed)**
- Scan the QR code on a table to start. Choose **Dine in** or **Take out**.
- Browse the menu, build a cart, and send it to the kitchen. Everyone at the same table shares one bill and can order more rounds.
- Pay by QR Ph, GCash, bank transfer or cash. The screen shows the restaurant's own payment details and updates when staff confirm.

**Customers**
- Sign up and log in, order for delivery, pay, track the order, and view order history.

**Staff and admin**
- **Dashboard** with key numbers and a revenue chart
- **Kitchen** ticket board for live orders
- **Front desk** for payment requests, open bills and what was paid today
- **Orders** list with filters by type, status and date, and status updates
- **Menu, category, table and user management**, including menu image uploads
- **Tables and QR codes**: add tables, regenerate a code, print the QR sheet
- **Customers** list
- **Sales report** by day, category or order type, and **best sellers**, both with a print layout
- **Activity log** of staff actions
- **Settings** for the delivery fee and the restaurant's payment accounts
- **Sound alerts** on kitchen and front desk screens when new work arrives
- **Installable PWA**: use *Add to Home Screen* on Android or iPhone

Security details: passwords are hashed with bcrypt, accounts lock for 15 minutes after 5 failed logins, and order totals are always calculated on the server.

## Tech stack

- **Client:** React 19, Vite, React Router, Axios
- **Server:** Node.js, Express 5, Mongoose, JWT authentication, express-validator, multer
- **Database:** MongoDB
- **Hosting:** Vercel (React build plus the Express API as a serverless function), MongoDB Atlas, Vercel Blob for uploaded images
- **Tests:** Node's built-in test runner

## User roles

| Role | Access |
| --- | --- |
| Table guest | Dine in and take out ordering through a table QR code. No login. |
| Customer | Delivery ordering, payment, tracking and order history. |
| Staff | Dashboard, orders, kitchen board and front desk. |
| Admin | Everything staff can do, plus menu, categories, tables and QR codes, users, customers, settings, reports and the activity log. |

## Project structure

```
gendai-react/
  client/    React app (Vite)                  http://localhost:5173
  server/    Express REST API and Mongoose     http://localhost:5001
  api/       Vercel serverless entry that runs server/app.js
  database/  seed.js (sample data), seed-tables.js, migrate-delivery.js, schema.mongodb.js
  docs/      design notes and screenshots
```

## Getting started

### Prerequisites

- Node.js 20 or newer
- MongoDB running locally on `mongodb://127.0.0.1:27017`

### Install

```bash
npm run install:all
```

### Configure

Copy the server template and adjust it if needed. The defaults work for local development.

```bash
cp server/.env.example server/.env
```

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `PORT` | API port (default 5001) |
| `JWT_SECRET` | Secret used to sign login tokens. Set it to a long random string. |
| `JWT_EXPIRES_IN` | Token lifetime (default 8h) |
| `CLIENT_URL` | Address of the client |
| `BLOB_READ_WRITE_TOKEN` | Only needed on Vercel, for image uploads |

`client/.env` is optional. Without it, the client calls `/api` and Vite proxies it to the server. See `client/.env.example` to point it elsewhere.

### Load sample data

```bash
npm run seed
```

This fills an empty database with 8 tables, 9 categories, 41 menu items, users and sample orders, and creates the demo accounts below. It refuses to run if the database already has data. `npm run seed -- --force` wipes the database first. `npm run seed:tables` only adds tables T1 to T8.

### Run

In two terminals:

```bash
npm run server   # API on :5001
npm run client   # app on :5173
```

Open http://localhost:5173.

### Demo accounts

Created by the seed script for local use only. Change these passwords before deploying anywhere public.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@gendai.test` | `Admin123!` |
| Staff | `staff@gendai.test` | `Staff123!` |
| Staff | `kitchen@gendai.test` | `Kitchen123!` |
| Customer | `customer@gendai.test` | `Customer123!` |

Staff accounts are created by an admin under **Users**. Customers sign up themselves.

### Tests

```bash
npm test
```

The tests use their own database (`gendai_test`) and need MongoDB running.

## Deploying to Vercel

1. Create a MongoDB Atlas cluster and database user, and allow access from anywhere (Vercel has no fixed IP).
2. Load the sample data into Atlas: `MONGODB_URI="mongodb+srv://..." npm run seed`.
3. Import the repository in Vercel, or run `vercel` from the project root. `vercel.json` sets the build and the `/api` routing.
4. Add `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN` and a Vercel Blob store (which adds `BLOB_READ_WRITE_TOKEN`) as environment variables.
5. Log in as admin, change the demo passwords, fill in **Settings → Payment accounts**, and print the table QR codes from **Tables & QR**.

## Notes

- Payments go straight to the restaurant's own accounts. The app does not process money, and staff confirm each payment by hand.
- Live screens refresh by polling every few seconds, so no websocket server is needed on Vercel.
- Forgot password is a placeholder page because email sending is not set up.

## Project background

Built for a database systems course by the Avengers group. It was first hosted at https://github.com/iameileenjulia/gendai-react.
