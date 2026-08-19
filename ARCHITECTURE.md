# AgroConnect Architecture

## 1. Overview

AgroConnect is a monorepo with a React/Vite single-page frontend and an Express/MongoDB backend API.

```text
Browser (React + Vite)
        |
        | HTTPS / JSON / Bearer JWT
        v
Express API on Render
        |
        +--> MongoDB / Mongoose
        +--> Cloudinary
        +--> Razorpay / Stripe
        +--> SMTP via Nodemailer
        +--> Socket.IO
```

The frontend is in `client/`. The backend is in `server/`.

## 2. Frontend architecture

Main entry files:

- `client/src/main.jsx`
- `client/src/App.jsx`

Core frontend layers:

```text
Pages
  |
  v
Context / hooks
  |
  v
services/api.js
  |
  v
VITE_API_URL
  |
  v
Express API
```

### Frontend role routes

`client/src/App.jsx` currently defines these protected role areas:

- `/buyer` -> buyer dashboard
- `/buyer/cart` -> buyer or farmer cart
- `/farmer` -> farmer dashboard
- `/farmer/add-product` -> farmer product creation
- `/farmer/edit-product/:id` -> farmer product editing
- `/farmer/purchases` -> farmer purchases
- `/verification` -> farmer manual verification
- `/fertilizer` -> fertilizer seller dashboard
- `/fertilizer/add-product` -> fertilizer product creation
- `/fertilizer/edit-product/:id` -> fertilizer product editing
- `/fertilizer-store` -> buyer/farmer fertilizer marketplace
- `/delivery` -> delivery partner dashboard
- `/delivery/:id` -> delivery details
- `/verification-employee` -> area verification employee dashboard
- `/admin` -> admin dashboard
- `/admin/verification-employees` -> verification employee management

Public routes include `/`, `/login`, `/register`, `/role` and `/roles`.

`ProtectedRoute.jsx` is used to enforce frontend role access. Backend authorization is still authoritative.

## 3. Backend architecture

`server/server.js` creates the Express app, HTTP server and Socket.IO server.

Mounted route groups:

```text
/api/auth          -> routes/auth.js
/api/users         -> routes/users.js
/api/products      -> routes/products.js
/api/orders        -> routes/orders.js
/api/cart          -> routes/cart.js
/api/payments      -> routes/payments.js
/api/delivery      -> routes/delivery.js
/api/upload        -> routes/upload.js
/api/notifications -> routes/notifications.js
/api/pricing       -> routes/aiPricing.js
/api/admin         -> routes/admin.js
/api/health        -> server health endpoint
```

`server/routes/apiRoutes.js` still exists as a legacy/compatibility file, but `server/server.js` does not mount it. The active notification and pricing implementations are `routes/notifications.js` and `routes/aiPricing.js`.

## 4. Authentication and authorization

JWT authentication is implemented by `server/middleware/auth.js`.

For a protected request:

```text
Authorization: Bearer <token>
        |
        v
Verify JWT with JWT_SECRET
        |
        v
Load current User from MongoDB
        |
        +-- missing user -> 404
        +-- inactive user -> 403
        |
        v
authorize(...roles) if required
```

This means a suspended/deactivated account is rejected on later protected requests even if the issued JWT has not expired.

Public registration intentionally allows only:

- farmer
- buyer
- fertilizer_seller
- delivery_partner

Admins create verification employee accounts separately.

## 5. Farmer verification architecture

Farmer verification is manual. There is no government registry API verification in the current flow.

Evidence collected:

- Aadhaar front image
- Aadhaar back image
- current farm photo
- farming video
- GPS latitude/longitude
- farm address
- village/town
- district
- state
- PIN code
- optional notes

Upload flow:

```text
Farmer Verification page
        |
        +--> /api/upload/verification/aadhaar-front
        +--> /api/upload/verification/aadhaar-back
        +--> /api/upload/verification/farm-photo
        +--> /api/upload/verification/farming-video
        |
        v
Authenticated Cloudinary assets
        |
        v
verificationDocuments on User
        |
        v
POST /api/users/verify/submit
        |
        v
verificationStatus = pending
```

Admin or area verification employee review:

```text
GET /api/users/verify/pending?status=pending
        |
        v
Area check for verification_employee
        |
        v
PUT /api/users/verify/:id
        |
        +--> verified
        +--> rejected
        +--> more_information_required
```

Only admins may set the verification action to `suspended` through that route.

A verification employee is restricted by `verificationArea.state` and optional `verificationArea.districts`.

## 6. Product architecture

Products belong to one seller.

Farmer rules:

- must have `verificationStatus === "verified"`
- can create `type: "produce"` only

Fertilizer seller rules:

- can create `type: "fertilizer"` only

Products without valid GPS coordinates can be saved but remain unpublished/inactive.

Public product responses populate only safe seller fields; bank details, verification evidence and private contact information are excluded.

## 7. Cart and order architecture

Buyers can purchase marketplace products. Farmers can use the shopping flow only for fertilizer products.

Checkout flow:

```text
Cart
  |
  v
POST /api/orders/create
  |
  +--> validate delivery details
  +--> re-check live product availability
  +--> atomically reserve stock with guarded updates
  +--> create order
  +--> clear cart
  +--> create notifications
```

The order route re-checks stock at checkout, even if the item was valid when it entered the cart.

## 8. Payment architecture

The backend contains:

- Razorpay create-intent and signature verification flow
- Stripe webhook handling

Razorpay mock orders are development/test-only and are explicitly rejected in production.

After successful payment confirmation, delivery records are created per seller if they do not already exist.

## 9. Delivery architecture

Delivery records are separate from orders.

Main statuses:

```text
assigned -> accepted -> picked_up -> in_transit -> near_delivery -> delivered
```

Failure/cancellation transitions are constrained by the backend.

Unclaimed deliveries can be listed with `/api/delivery/nearby`. A delivery partner claims one with an atomic update, preventing two partners from accepting the same open delivery.

## 10. Realtime architecture

Socket.IO is created in `server/server.js`.

Current server events include:

- `join_room`
- `send_notification`
- `notification`
- `order_update`
- `order_updated`
- `delivery_location`
- `location_update`

Routes also emit order and delivery update events where needed.

## 11. Security boundary

Key security controls currently implemented:

- Helmet
- strict CORS allowlist
- auth rate limiting
- JWT authentication
- role authorization
- account active-status check on protected routes
- public/private user profile separation
- authenticated Cloudinary farmer evidence
- product verification gate for farmers
- non-zero GPS validation for farmer verification

See `SECURITY.md` for operational rules.

## 12. Deployment architecture

```text
Vercel
  client/
  VITE_API_URL=https://<render-service>.onrender.com/api
        |
        v
Render
  server/
  CLIENT_URL=https://<vercel-domain>.vercel.app
        |
        v
MongoDB Atlas / Cloudinary / payment providers
```

`client/vercel.json` rewrites all SPA paths to `index.html`, allowing direct browser access to React Router paths.
