# AgroConnect — Low-Level Design (LLD)

**Document purpose:** Implementation-level design for the current repository  
**Repository:** `charanteja7725/AgroConnect2.0`  
**Target branch:** `charan`  
**Last updated:** 19 August 2026

> This document defines **how AgroConnect is implemented at module, route, schema and state-transition level**. Product scope belongs in `PRD.md`; system-level architecture belongs in `HLD.md`.

---

## 1. Repository Layout

```text
AgroConnect2.0/
├── .github/
│   └── workflows/ci-cd.yml
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── buyer/
│   │   │   ├── delivery/
│   │   │   ├── farmer/
│   │   │   ├── fertilizer/
│   │   │   └── verification/
│   │   ├── services/
│   │   └── utils/
│   ├── vercel.json
│   └── vite.config.js
├── server/
│   ├── __tests__/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── scripts/
│   ├── services/
│   ├── utils/
│   └── server.js
├── PRD.md
├── HLD.md
└── LLD.md
```

---

## 2. Runtime Entry Points

### 2.1 Frontend

`client/src/main.jsx` mounts the React application. `client/src/App.jsx` defines application routing using `BrowserRouter`, `Routes`, `Route` and `ProtectedRoute`.

Vite development and preview use port `5003` with `0.0.0.0` host binding.

### 2.2 Backend

`server/server.js` creates:

- Express application;
- HTTP server;
- Socket.IO server;
- middleware stack;
- MongoDB connection;
- API route mounts;
- health endpoint;
- error/404 handlers;
- startup validation.

Production starts with:

```bash
node server.js
```

The repository pins Node.js to `20.19.0`.

---

## 3. Frontend Route Design

`client/src/App.jsx` currently defines these routes.

| Route | Component | Access |
|---|---|---|
| `/` | `Home` | Public |
| `/login` | `Login` | Public |
| `/register` | `Register` | Public |
| `/role` | `RoleSelection` | Public |
| `/roles` | `RoleSelection` | Public compatibility route |
| `/buyer` | `BuyerDashboard` | `buyer` |
| `/buyer/cart` | `Cart` | `buyer`, `farmer` |
| `/farmer` | `FarmerDashboard` | `farmer` |
| `/farmer/add-product` | `AddProduct` | `farmer` |
| `/farmer/edit-product/:id` | `EditProduct` | `farmer` |
| `/farmer/purchases` | `FarmerPurchases` | `farmer` |
| `/verification` | `Verification` | `farmer` |
| `/fertilizer` | `FertilizerDashboard` | `fertilizer_seller` |
| `/fertilizer/add-product` | `AddFertilizerProduct` | `fertilizer_seller` |
| `/fertilizer/edit-product/:id` | `EditProduct` | `fertilizer_seller` |
| `/fertilizer-store` | `FertilizerStore` | `buyer`, `farmer` |
| `/delivery` | `DeliveryDashboard` | `delivery_partner` |
| `/delivery/:id` | `DeliveryDetail` | `delivery_partner` |
| `/verification-employee` | `VerificationEmployeeDashboard` | `verification_employee` |
| `/admin` | `AdminDashboard` | `admin` |
| `/admin/verification-employees` | `VerificationEmployees` | `admin` |
| `*` | `NotFound` | Any unmatched route |

`ProtectedRoute` provides frontend navigation protection, but backend authorization remains authoritative.

---

## 4. Frontend State and Service Layer

### 4.1 Context modules

The frontend separates context definitions and hooks:

- `ContextDefinitions.js`
- `AppContext.jsx`
- `AppHooks.js`
- `LanguageContext.jsx`

Application context covers authentication, cart, location and notifications.

### 4.2 API layer

`client/src/services/api.js` centralizes HTTP calls using the environment base URL:

```text
VITE_API_URL=http://localhost:5001/api
```

Production must point `VITE_API_URL` to the deployed Render backend with `/api` appended.

### 4.3 Verification employee API

`client/src/services/verificationEmployeeAPI.js` isolates employee-specific review calls from general user/admin API calls.

### 4.4 Location service

`LocationService.js` and browser geolocation are used to obtain coordinates for nearby discovery and farm/product location capture.

---

## 5. Backend Middleware Design

### 5.1 `protect`

`server/middleware/auth.js`:

1. reads `Authorization: Bearer <token>`;
2. verifies JWT with `JWT_SECRET`;
3. loads the current `User` from MongoDB;
4. rejects missing users;
5. rejects `isActive === false` users with `403`;
6. stores the user on `req.user`.

This design immediately blocks a suspended account even when the original JWT has not expired.

### 5.2 `authorize(...roles)`

Checks `req.user.role` against the allowed role list and returns `403` on mismatch.

### 5.3 `optionalAuth`

Attempts JWT resolution when provided, otherwise continues with `req.user = null`.

---

## 6. Backend Route Mounts

`server/server.js` mounts:

| Base path | Module |
|---|---|
| `/api/auth` | `routes/auth.js` |
| `/api/users` | `routes/users.js` |
| `/api/products` | `routes/products.js` |
| `/api/orders` | `routes/orders.js` |
| `/api/cart` | `routes/cart.js` |
| `/api/payments` | `routes/payments.js` |
| `/api/delivery` | `routes/delivery.js` |
| `/api/upload` | `routes/upload.js` |
| `/api/notifications` | `routes/notifications.js` |
| `/api/pricing` | `routes/aiPricing.js` |
| `/api/admin` | `routes/admin.js` |

Health check:

```http
GET /api/health
```

returns environment, uptime, MongoDB connection status and Cloudinary configuration status.

---

## 7. Authentication Module

### `POST /api/auth/register`

Public registration accepts:

- `firstName`
- `lastName`
- `email`
- `password`
- `phone`
- `role`
- optional address/business fields

Allowed public roles:

```text
farmer
buyer
fertilizer_seller
delivery_partner
```

Admin and verification-employee accounts are intentionally excluded from public registration.

### `POST /api/auth/login`

- validates email/password;
- checks password hash;
- rejects inactive accounts;
- returns JWT and `user.getProfile()`.

### `GET /api/auth/me`

Protected current-user profile endpoint.

### Password reset

- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password/:resetToken`

Reset tokens prefer `JWT_RESET_SECRET` and fall back to `JWT_SECRET` only when needed by current configuration.

---

## 8. User and Farmer Verification Module

### 8.1 Verification submission

```http
POST /api/users/verify/submit
Role: farmer
```

The backend reads already-uploaded verification media from the authenticated farmer record and requires:

- Aadhaar front media;
- Aadhaar back media;
- farm photo;
- farming video;
- valid latitude/longitude;
- non-zero GPS point;
- farm address;
- district;
- state.

On success:

```text
verificationStatus = pending
isVerified = false
farmerVerification.status = pending
```

The farmer's top-level geospatial `location` is synchronized from the submitted farm coordinates.

Existing active seller products are deactivated during resubmission until approval.

### 8.2 Pending-review queue

```http
GET /api/users/verify/pending?status=pending
Role: admin | verification_employee
```

Admin receives all matching farmers.

Verification employee filtering is enforced by:

```text
employee.verificationArea.state == farmer.verificationDocuments.farmLocation.state
AND
(employee.verificationArea.districts is empty
 OR farmer district is included)
```

Comparison is normalized using trimmed lowercase values.

### 8.3 Review action

```http
PUT /api/users/verify/:id
Role: admin | verification_employee
```

Verification employee actions:

```text
verified
rejected
more_information_required
```

Admin additionally supports:

```text
suspended
```

Approval is rejected unless all required evidence and farm location/address checks pass.

### 8.4 Suspension

```http
PUT /api/users/:id/suspend
Role: admin
```

Actions:

```json
{ "action": "suspend" }
```

or

```json
{ "action": "activate" }
```

For suspended farmers:

- `isActive = false`
- `verificationStatus = suspended`
- `isVerified = false`
- active products are hidden.

Reactivation does not automatically restore verification; a previously suspended farmer moves to `more_information_required`.

### 8.5 Nearby-user search

```http
GET /api/users/search/nearby
```

Requires valid longitude/latitude and supports nearby `farmer` or `fertilizer_seller` roles.

Public result shaping must use only public profile data.

---

## 9. Verification Media Upload Module

`server/routes/upload.js` uses Multer memory storage and Cloudinary.

### Product image endpoint

```http
POST /api/upload/image
Roles: farmer | fertilizer_seller
Multipart field: image
```

### Verification endpoints

All require farmer authentication and multipart field `file`:

```text
POST /api/upload/verification/aadhaar-front
POST /api/upload/verification/aadhaar-back
POST /api/upload/verification/farm-photo
POST /api/upload/verification/farming-video
```

### File constraints

Images:

```text
MIME: image/*
Max: 10 MB
```

Video:

```text
MIME: video/*
Max: 60 MB
```

### Cloudinary storage

Verification files are uploaded with:

```text
type = authenticated
folder = agroconnect/verification/<userId>/<field>
```

The saved media object contains:

```text
url
publicId
resourceType
deliveryType
uploadedAt
```

Each verification field is persisted with an atomic `$set` update to avoid concurrent uploads overwriting other evidence fields.

A verified or suspended farmer cannot replace verification evidence through the normal upload flow.

---

## 10. User Model

`server/models/User.js` contains core identity, role, profile, verification and operational fields.

### Role enum

```text
farmer
buyer
fertilizer_seller
delivery_partner
verification_employee
admin
```

### Key verification structures

```text
verificationStatus
farmerVerification
verificationDocuments
adminReview
verificationArea
isVerified
isActive
```

### `verificationDocuments`

```text
aadhaarFront
  ├── url
  ├── publicId
  ├── resourceType
  ├── deliveryType
  └── uploadedAt

aadhaarBack
farmPhoto
farmingVideo
farmLocation
  ├── latitude
  ├── longitude
  ├── address
  ├── village
  ├── district
  ├── state
  └── pincode
submittedAt
additionalNotes
```

### Verification employee area

```text
verificationArea.state
verificationArea.districts[]
```

### Profile methods

`getProfile()` removes password/reset/verification-token secrets.

`getPublicProfile()` intentionally returns only marketplace-safe fields such as name, role, avatar, business/farm summary, ratings, verification flag, city and state.

---

## 11. Product Module

### Public list

```http
GET /api/products
```

Supported query dimensions include:

```text
type
category
minPrice
maxPrice
search
sortBy
page
limit
latitude
longitude
maxDistance
```

Normal listing uses Mongoose pagination/sort/populate.

Location listing uses MongoDB aggregation with `$geoNear`, `$lookup` and a restricted seller shape.

### Seller products

```http
GET /api/products/seller/:sellerId
```

### Product detail

```http
GET /api/products/:id
```

Increments `totalViews` and populates only public seller fields.

### Create

```http
POST /api/products
Roles: farmer | fertilizer_seller
```

Farmer rules:

```text
verificationStatus must equal verified
type must equal produce
```

Fertilizer seller rule:

```text
type must equal fertilizer
```

Price and quantity must be positive numeric values.

GPS is stored as:

```json
{
  "type": "Point",
  "coordinates": [longitude, latitude]
}
```

A product created without valid GPS is saved with placeholder coordinates and `isActive = false`.

### Update/delete

A seller may modify/delete only their own product; admin is allowed according to route logic.

### Review

```http
POST /api/products/:id/review
```

Rules:

- rating 1–5;
- seller cannot review own product;
- same user cannot review same product twice.

---

## 12. Product Model

Important fields:

```text
name
description
type
category
seller
sellerName
price
quantity
unit
images[]
mainImage
location
address
rating
reviewCount
reviews[]
inStock
stockStatus
aiSuggestedPrice
marketTrend
totalSold
totalViews
isActive
isVerified
```

Indexes:

```text
location: 2dsphere
name + description: text
seller + category + isActive
price + rating
```

---

## 13. Cart Module

All cart operations require:

```text
protect
authorize(buyer, farmer)
```

### `GET /api/cart`

Returns the authenticated user's cart; creates an empty cart if none exists.

### `POST /api/cart/add`

Input:

```json
{
  "productId": "...",
  "quantity": 1
}
```

Validation rules:

- product exists;
- product active/in stock;
- quantity positive whole number;
- user cannot buy own product;
- farmer can add only fertilizer products;
- combined cart quantity cannot exceed stock.

### `PUT /api/cart/update/:itemId`

Revalidates current product availability and stock before changing quantity.

### `DELETE /api/cart/remove/:itemId`

Removes one cart item.

### `DELETE /api/cart/clear`

Resets items, quantity and total price.

### Cart totals

After mutations:

```text
totalQuantity = sum(item.quantity)
totalPrice = sum(item.totalPrice)
lastUpdated = now
```

---

## 14. Order Module

### 14.1 Order listing

```http
GET /api/orders
```

Visibility:

- admin: all orders;
- buyer: orders where `buyer == req.user`;
- farmer: orders they placed for fertilizer OR orders containing items sold by them;
- fertilizer seller: orders containing their items;
- delivery partner: orders linked by `delivery.partnerId`.

### 14.2 Single order

```http
GET /api/orders/:id
```

Authorization is checked against buyer, item sellers, delivery partner or admin.

### 14.3 Create order

```http
POST /api/orders/create
Roles: buyer | farmer
```

Input includes delivery/billing address and payment method.

The server does **not** accept arbitrary checkout line items as the source of truth. It loads the authenticated user's Cart.

Required delivery fields:

```text
fullName
phone
street
city
state
zipCode
```

Country defaults to `India` when absent.

Allowed payment methods:

```text
credit_card
debit_card
upi
net_banking
wallet
cash_on_delivery
```

### 14.4 Stock reservation algorithm

For each cart item:

1. re-read Product;
2. reject unavailable/inactive/out-of-stock products;
3. reject own product;
4. enforce farmer-fertilizer-only shopping rule;
5. calculate order item using current server product price;
6. reserve using guarded update:

```text
_id = product
quantity >= requested
isActive = true
inStock = true
```

Update:

```text
quantity -= requested
totalSold += requested
```

If any reservation fails, previously reserved items are restored and checkout returns a conflict.

If Order creation itself fails after reservations, reserved stock is also restored.

### 14.5 Successful checkout

After Order creation:

- buyer `totalOrders` increments;
- cart is cleared;
- order-confirmation email is attempted;
- seller notifications are created;
- buyer confirmation notification is created.

Email failure does not roll back a successful order.

---

## 15. Order State Machine

Configured transitions:

```text
pending
 ├── confirmed
 └── cancelled

confirmed
 ├── processing
 ├── shipped
 ├── delivered
 └── cancelled

processing
 ├── shipped
 ├── delivered
 └── cancelled

shipped
 └── delivered

delivered
 └── terminal

cancelled
 └── terminal
```

Order cancellation restores inventory once.

Buyer/farmer cancellation endpoint:

```http
POST /api/orders/:id/cancel
```

Seller/admin/delivery-linked status endpoint:

```http
PUT /api/orders/:id/status
```

---

## 16. Order / Payment Data Model

`server/models/Order.js` exports:

- `Cart`
- `Order`
- `Payment`

The runtime cart routes use the dedicated `server/models/Cart.js` model, while order/payment schemas remain in `Order.js`.

### Order key fields

```text
orderNumber
buyer
items[]
billingAddress
deliveryAddress
subtotal
shippingCost
tax
discount
totalAmount
payment
status
statusHistory
delivery
rating
cancelReason
```

### Payment status enum

```text
pending
completed
failed
refunded
```

### Payment record providers

```text
stripe
razorpay
paypal
wallet
```

Order number generation uses timestamp plus collection count.

---

## 17. Delivery Module

### `GET /api/delivery`

Role-scoped query:

- admin: all;
- delivery partner: `deliveryPartner == user`;
- farmer/fertilizer seller: `sender == user`;
- buyer: `recipient == user`.

### `GET /api/delivery/nearby`

Role: delivery partner.

Returns unassigned `assigned` deliveries. When coordinates are supplied, uses a `$near` geospatial query against recipient location.

### `GET /api/delivery/:id`

Access allowed to:

- admin;
- assigned delivery partner;
- sender;
- recipient.

### `POST /api/delivery/create`

Admin-only manual delivery creation endpoint.

### `PUT /api/delivery/:id/assign`

Admin assigns an active `delivery_partner`.

### `PUT /api/delivery/:id/accept`

Delivery partner atomically claims a currently unassigned `assigned` delivery using `findOneAndUpdate` with both status and unassigned conditions.

If another partner claims first, response is `409`.

### `PUT /api/delivery/:id/status`

Only the assigned partner may update status.

Optional location update validates latitude/longitude and appends to route history.

---

## 18. Delivery State Machine

```text
assigned → picked_up | cancelled | failed
accepted → picked_up | cancelled | failed
picked_up → in_transit | cancelled | failed
in_transit → near_delivery | delivered | failed
near_delivery → delivered | failed
delivered → terminal
cancelled → terminal
failed → terminal
```

The `accept` endpoint sets status to `accepted`, while admin assignment retains `assigned` until partner action.

Delivery timestamps:

- `pickupTime` set on first `picked_up`;
- `actualDeliveryTime` set on `delivered`.

---

## 19. Delivery Model

Important fields:

```text
deliveryNumber
deliveryPartner
partnerName
partnerPhone
partnerLocation
type
order
items[]
sender
senderName
senderPhone
senderLocation
recipient
recipientName
recipientPhone
recipientEmail
recipientLocation
pickupTime
estimatedDeliveryTime
actualDeliveryTime
route[]
status
statusHistory[]
proof
rating
deliveryCharge
totalEarnings
issueReported
```

Geospatial indexes exist on:

```text
partnerLocation
recipientLocation
senderLocation
```

---

## 20. Admin Module

Base path:

```text
/api/admin
```

All listed routes require `admin` role.

### Statistics

```http
GET /api/admin/stats
```

Includes user/order/revenue/farmer/verification-employee summary data.

### Users

```text
GET /api/admin/users
PUT /api/admin/users/:id/status
```

User deactivation hides active seller products for farmer/fertilizer-seller roles.

### Verification employees

```text
POST /api/admin/verification-employees
GET  /api/admin/verification-employees
PUT  /api/admin/verification-employees/:id
```

Create requires:

```text
firstName
lastName
email
password
phone
state
```

District assignment is optional; an empty district list means the whole assigned state.

### Admin marketplace views

```text
GET /api/admin/orders
GET /api/admin/products
GET /api/admin/deliveries
```

### Compatibility verification routes

```text
GET /api/admin/verifications
PUT /api/admin/verifications/:id
```

Approval applies the same mandatory evidence requirements as the main user verification flow.

### Order/product operations

```text
PUT    /api/admin/orders/:id/status
DELETE /api/admin/products/:id
```

### Targeted notifications

```http
POST /api/admin/notifications/send
```

Input includes `userIds[]`, `title`, `message` and optional type.

---

## 21. Notification Module

### Persistent model

`Notification` contains:

```text
user
title
message
type
relatedId
relatedModel
read
timestamp
metadata
```

### API

```text
POST /api/notifications/send
GET  /api/notifications
PUT  /api/notifications/:id/read
```

Notification reads are scoped to the authenticated user.

### Socket.IO

On client connection, users join:

```text
user_<userId>
```

Backend emits user-scoped notification events to this room.

---

## 22. Pricing Module

### Suggestion endpoint

```http
POST /api/pricing/suggest
Roles: farmer | fertilizer_seller
```

Input:

```text
productType
category
quantity
currentPrice
```

Algorithm:

1. find matching Product IDs;
2. find recent non-cancelled/advanced orders containing those products;
3. collect item prices;
4. use recent average when data exists;
5. otherwise calculate a simulated category/demand/seasonal estimate;
6. return `isSimulated` flag and recommendation.

Public analytics endpoints:

```text
GET /api/pricing/trends/:category
GET /api/pricing/market-analysis
```

The trend/market-analysis data currently contains simulated/static analysis sections where explicitly implemented.

---

## 23. Security and HTTP Configuration

### CORS

Allowed origins:

```text
http://localhost:5173
http://localhost:5174
CLIENT_URL
```

Trailing slashes are normalized.

### Security headers

`helmet()` is globally enabled.

### Auth rate limiting

Rate limiter is mounted on `/api/auth` and uses:

```text
RATE_LIMIT_WINDOW_MS
RATE_LIMIT_MAX_REQUESTS
```

with defaults when missing.

### Body parsing

- payment webhook receives raw JSON body before normal JSON parsing;
- general JSON/urlencoded limit is 50 MB in the current server configuration.

### Error handling

- CORS errors return `403`;
- server errors return JSON with error/status;
- unknown routes return `404` with `Route not found`.

---

## 24. Production Startup Validation

`validateStartupConfig()` rejects production startup when critical values are missing.

Required/validated:

- `JWT_SECRET` and minimum length;
- `JWT_RESET_SECRET` in production;
- `MONGODB_URI` outside tests;
- `CLIENT_URL` in production;
- Cloudinary cloud name/key/secret in production.

Stripe and Razorpay missing values generate warnings because they affect only provider-specific functionality.

---

## 25. Environment Variable Contract

### Backend critical variables

```text
NODE_ENV
PORT
MONGODB_URI
JWT_SECRET
JWT_RESET_SECRET
JWT_EXPIRE
CLIENT_URL
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

### Optional/provider variables

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
RATE_LIMIT_WINDOW_MS
RATE_LIMIT_MAX_REQUESTS
```

### Frontend

```text
VITE_API_URL
```

Secrets must never use the `VITE_` prefix.

---

## 26. Deployment-Specific Files

### `client/vercel.json`

Provides SPA rewrites so deep links such as `/login`, `/farmer` and `/verification` return the React application rather than Vercel 404 pages.

### `.node-version`

```text
20.19.0
```

Used to keep runtime/tooling aligned.

---

## 27. CI Test Design

Workflow: `.github/workflows/ci-cd.yml`

### Backend job

```text
Node 20.19.0
npm ci
npm test -- --runInBand
```

Test environment supplies test JWT values and uses MongoDB Memory Server inside the Jest test design.

Primary suites:

```text
server/__tests__/integration.test.js
server/__tests__/verification.test.js
```

Coverage focuses on core integration behavior including auth, marketplace/order behavior and verification controls.

### Frontend job

```text
Node 20.19.0
npm ci
npm run build
```

Build uses a test/local `VITE_API_URL` because compilation only requires a syntactically valid environment value.

---

## 28. Important Implementation Invariants

The following invariants must remain true when modifying the repository:

1. `verificationStatus === "verified"` is required before a farmer publishes produce.
2. A verification employee cannot review a farmer outside assigned area.
3. Public seller responses must never expose verification evidence or bank details.
4. `protect` must re-check `isActive` from MongoDB.
5. Farmer cart operations may contain fertilizer only.
6. Own products cannot be added to cart or purchased.
7. Order totals must be derived from current server-side product data.
8. Inventory decrement must be guarded by available quantity.
9. Delivery claiming must remain atomic.
10. Invalid order/delivery state transitions must fail server-side.
11. Verification media must not become ordinary public product media.
12. Frontend role protection must never replace backend authorization.

---

## 29. Known Technical Notes

- `server/routes/apiRoutes.js` contains older compatibility-style notification/pricing routers but `server/server.js` mounts the dedicated `notifications.js` and `aiPricing.js` modules; new work should use the mounted modules rather than duplicate logic.
- `server/models/Order.js` still exports an older Cart schema alongside Order/Payment, while runtime cart routes use `server/models/Cart.js`. Future cleanup may consolidate this duplication, but current cart behavior is defined by `models/Cart.js`.
- Pricing fallback logic is intentionally advisory/simulated when recent transaction data is unavailable.

These are implementation notes, not additional product requirements.

---

## 30. Change Guidance

When adding a feature:

- update `PRD.md` only if product behavior/scope changes;
- update `HLD.md` only if component boundaries, integrations or deployment architecture change;
- update `LLD.md` when routes, schemas, state machines, validation, modules or implementation contracts change.

This separation keeps the three validation documents distinct and prevents duplicated documentation.
