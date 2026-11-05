# Gendai Delivery Ordering: Design

Date: 2026-10-12
Status: Draft, awaiting review

## Purpose

Turn the Gendai ordering system from a guest, dine-in (QR/table) app into a
Gendai-only delivery app, similar to foodpanda but for one restaurant.
Customers must sign up and log in to order. Payment is a mock for now.

Success looks like: a new customer can sign up, browse the menu, order for
delivery to their address, pay with a mock payment, and track the order to
"Delivered", while staff manage the order and admins manage menu, fee and
reports.

## Scope

In scope:
- Customer accounts (sign up, log in) using the split-screen layout from the
  reference screenshot, branded for Gendai.
- Landing page, delivery checkout, order tracking, "My Orders".
- Flat delivery fee, admin-editable.
- Mock payment (cash on delivery, GCash, card).
- Staff order handling for delivery, read-only Customers list for admins.
- Migration of existing orders and a safer seed script.

Out of scope for this version:
- Real forgot-password emails (the page is a placeholder).
- Rider accounts, rider assignment, live map tracking.
- Real payment gateways.
- Zone-based or distance-based delivery fees.
- Multiple saved addresses per customer.

## Decisions already made

| Topic | Decision |
|---|---|
| Delivery model | Staff-managed. Staff move orders through the statuses. |
| Payment | Mock only. Real gateways are replaceable later behind one function. |
| Delivery fee | One flat fee, default PHP 50, editable by an admin. |
| Accounts | Customers are a third role on the existing `User` model. |
| Login | Email + password for everyone, including staff and admin. |
| Address | One default address on the profile, editable per order, copied onto the order. |
| Customers list | Read-only list for admins. |
| Branding | Reference layout with Gendai branding, not BewAir. |

## 1. Accounts and data

### User model (`server/models/User.js`)
- `role` enum becomes `['admin', 'staff', 'customer']`.
- New fields: `fullName`, `phone`, `address` (`street`, `barangay`, `city`, `notes`).
- `username` stays unique and required for `admin` and `staff`; it is optional
  for `customer`. The unique index must be sparse so many customers without a
  username do not collide.
- Existing lockout (5 failed attempts, 15 minutes) and bcrypt hashing are kept.

### Auth API
- `POST /api/auth/login`: body `{ email, password }`, finds the user by email.
  Staff and admin log in with their existing email addresses.
- `POST /api/auth/register`: body `{ fullName, email, phone, password }`.
  Creates a `customer`, returns `{ token, user }` so the user is logged in
  immediately. Rate-limited. Duplicate email returns a clear 409 message.
- `GET /api/auth/verify`, `POST /api/auth/logout`: unchanged.
- `PUT /api/auth/profile`: a customer updates `fullName`, `phone`, `address`.

### Order model (`server/models/Order.js`)
Removed for new orders: `orderType`, `tableNumber`.

Added:
- `customer` (ref `User`, required for new orders)
- `contactPhone`
- `deliveryAddress` (`street`, `barangay`, `city`, `notes`), a copy taken at
  order time
- `deliveryFee`
- `paymentStatus`: `unpaid` | `paid`

Changed:
- `status` enum becomes `preparing | out_for_delivery | delivered | cancelled`.
- `totalAmount` = item subtotal + `deliveryFee`.
- `paymentMethod` keeps `cash | card | gcash`.

### Settings (`server/models/Setting.js`, new)
A single document holding `deliveryFee`. Created with the default (50) if
missing. Read by order creation and the checkout page.

### Migration
A one-time script maps existing orders:
- `ready` becomes `out_for_delivery`, `completed` becomes `delivered`,
  `preparing` and `cancelled` unchanged.
- `deliveryFee` set to 0, `paymentStatus` set to `paid` for completed orders
  and `unpaid` otherwise, `customer` left empty.
- Old `orderType` and `tableNumber` values are kept on those documents but are
  no longer read.

## 2. Customer experience

### Routes
| Path | Access | Purpose |
|---|---|---|
| `/` | public | Landing page with "Order now" and "Log in" |
| `/signup`, `/login` | public | Split-screen auth pages |
| `/forgot-password` | public | Placeholder page |
| `/menu` | public (browse) | Menu and cart building |
| `/cart` | customer | Checkout (address, phone, payment, summary) |
| `/pay/:id` | customer | Mock payment screen for GCash and card |
| `/order-success/:id` | customer, own orders | Order tracking |
| `/orders` | customer | "My Orders" history |
| `/admin/*` | staff, admin | As today, plus Customers and Settings |

### Auth pages
- Layout: left panel with the Gendai logo, name and tagline on a brand
  gradient; right panel with the form. Below 768px the left panel collapses to
  a header strip.
- Login: email, password with show/hide, "Forgot password?", "Create account",
  "Back to landing page".
- Sign up: full name, email, phone, password, confirm password, a link back
  to login.
- A logged-out visitor who presses "Check Order" is sent to `/login` and
  returned to the cart afterwards. The cart stays in local storage.

### Checkout
- Pre-fills name, phone and address from the profile; all are editable.
- Shows item list, subtotal, delivery fee and total.
- Payment choices: Cash on Delivery, GCash, Card.
- Replaces the Dine In / Take Out and table number sections.

### Tracking and history
- Tracking page shows Preparing, Out for delivery, Delivered, polled every
  10 seconds until delivered or cancelled.
- `GET /api/orders/:id` becomes authenticated: a customer can read only their
  own order, staff and admin can read any. This closes the current
  "anyone with the link" gap.
- `GET /api/orders/mine` returns the logged-in customer's orders for "My
  Orders".

## 3. Staff and admin

- Orders page shows delivery address, phone and payment status instead of
  order type and table. Staff move the status and can press "Mark as paid"
  (for cash on delivery).
- Admin Settings screen edits the delivery fee.
- Users page lists admin and staff only.
- Customers page (admin only, read-only): name, email, phone, order count,
  joined date.
- Dashboard and reports: sales totals separate items and delivery fees;
  any dine-in vs take-out breakdown becomes a payment method or status
  breakdown. Best-sellers is unchanged because order items are unchanged.

## 4. Mock payment

- All prices and the fee are computed on the server. The client sends only
  item ids and quantities.
- Cash on Delivery: order is created `unpaid`; staff mark it paid on delivery.
- GCash and card: after "Place Order" the customer lands on `/pay/:id`, which
  shows the total and a "Pay" button. The button calls
  `POST /api/orders/:id/pay`, which calls `processPayment(order)`, sets
  `paymentStatus` to `paid`, and redirects to tracking.
- `processPayment` lives in one server module and always succeeds today. A real
  provider replaces only that module later.
- The screen shows "Demo payment: no real charge". No card number is collected.

## 5. Security, errors, testing

### Security and validation
- Customer routes check ownership of the order against the token's user id.
- `POST /api/orders` requires the `customer` role, rejects missing or
  unavailable items, and ignores any client-supplied price.
- Email is lowercased and unique; passwords require at least 8 characters.
- Register and login endpoints are rate-limited.

### Seed script (`database/seed.js`)
- Creates a sample customer, delivery-style orders with addresses and fees,
  and the default `Setting`.
- Refuses to run if the database already contains users or orders, unless
  run with `--force`.

### Testing
Server tests:
- register and login (success, duplicate email, wrong password, lockout)
- order creation (server-side pricing and fee, unavailable item, wrong role)
- ownership checks on get and list
- status transitions and "mark as paid"
- mock payment success and idempotency (paying twice is harmless)

Manual end-to-end pass in the browser:
sign up, browse, add to cart, checkout (each payment method), mock pay,
staff moves status to delivered, customer sees the update.

## Open points
None. Items not listed above are explicitly out of scope.
