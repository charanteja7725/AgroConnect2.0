# AgroConnect Implementation Guide

This guide describes the implementation that exists on the current repository branch. It is not a future-feature checklist.

## 1. Application layers

```text
client/  -> React 19 + Vite 8 SPA
server/  -> Express 4 REST API + Socket.IO
MongoDB  -> application data
Cloudinary -> product media + private farmer verification evidence
```

Node version used by the repository and CI:

```text
20.19.0
```

## 2. Authentication

Backend files:

```text
server/routes/auth.js
server/middleware/auth.js
server/models/User.js
```

Implemented behavior:

- public registration for buyer, farmer, fertilizer seller and delivery partner
- JWT login
- `/api/auth/me`
- password reset token flow
- welcome/reset email service integration
- bcrypt password hashing in the User model
- current-user lookup for every protected request
- inactive/suspended account rejection
- role authorization middleware

`verification_employee` and `admin` cannot be selected through public registration.

## 3. Farmer verification

Frontend:

```text
client/src/pages/Verification.jsx
client/src/pages/verification/VerificationEmployeeDashboard.jsx
client/src/pages/admin/VerificationEmployees.jsx
```

Backend:

```text
server/routes/users.js
server/routes/upload.js
server/routes/admin.js
server/models/User.js
```

Required manual evidence:

- Aadhaar front image
- Aadhaar back image
- farm photo
- farming video
- GPS coordinates
- farm address
- district
- state

Flow:

```text
Farmer uploads evidence
        -> evidence persisted by protected upload routes
        -> farmer submits verification
        -> pending
        -> assigned-area employee/admin reviews
        -> verified / rejected / more_information_required
```

Verification employees are assigned by state and optional districts. The backend checks that assignment before allowing review.

A verified farmer is required before a produce listing can be published.

## 4. Marketplace products

Frontend product pages include farmer and fertilizer-seller add/edit flows plus buyer/fertilizer-store browsing.

Backend:

```text
server/routes/products.js
server/models/Product.js
```

Implemented rules:

- farmers create produce only
- fertilizer sellers create fertilizer only
- unverified farmers cannot create listings
- valid GPS is required to publish an active listing
- search/category/price filters
- pagination
- price/rating sorting
- optional location-distance query
- seller product list
- product reviews with self-review and duplicate-review prevention
- public seller data uses a safe field list

## 5. Cart

Frontend state is API-backed through the application context/API service.

Backend:

```text
server/routes/cart.js
server/models/Cart.js
```

Endpoints support load, add, update, remove and clear.

Farmers may shop for fertilizer products; produce purchase as a farmer shopping account is rejected by the backend.

## 6. Orders

Backend:

```text
server/routes/orders.js
server/models/Order.js
```

Implemented behavior:

- create order from authenticated cart
- validate delivery details
- default trusted contact details from authenticated account when older clients omit them
- re-check stock at checkout
- reserve stock with guarded database updates
- restore already-reserved stock when a later reservation fails
- clear cart after successful creation
- buyer/seller notifications
- role-scoped order retrieval
- controlled order status transitions
- buyer cancellation where allowed
- inventory restoration after cancellation

## 7. Payments

Backend:

```text
server/routes/payments.js
server/models/Order.js  # Payment model is exported here
```

Current implementation contains:

- Razorpay payment-order creation
- stored Payment document
- Razorpay HMAC signature verification
- order/payment ownership validation
- protection against confirming cancelled orders
- development-only mock fallback, disabled in production
- Stripe webhook handling when Stripe secrets are configured
- seller-specific delivery creation after successful payment
- duplicate delivery prevention on retried confirmation

## 8. Delivery

Frontend:

```text
client/src/pages/delivery/DeliveryDashboard.jsx
client/src/pages/delivery/DeliveryDetail.jsx
```

Backend:

```text
server/routes/delivery.js
server/models/Delivery.js
```

Implemented behavior:

- role-scoped delivery visibility
- nearby/unclaimed delivery search
- atomic delivery claim by a delivery partner
- admin assignment
- controlled delivery status transitions
- partner location updates and route history
- delivery update email hook

## 9. Notifications

Backend:

```text
server/routes/notifications.js
server/models/Notification.js
```

Frontend notification state/components are in `client/src/context` and `client/src/components`.

Implemented endpoints:

- create/send notification
- retrieve current user's notifications
- mark notification as read

Socket.IO is also used for realtime notification/order/delivery events.

## 10. Pricing suggestions

Backend:

```text
server/routes/aiPricing.js
```

`POST /api/pricing/suggest` first attempts to derive pricing from matching recent order history. When usable history is unavailable, it returns a simulated fallback and explicitly sets:

```json
{
  "isSimulated": true
}
```

The trend and overall market-analysis endpoints currently use predefined data.

## 11. Admin

Admin APIs are mounted at:

```text
/api/admin
```

Current admin capabilities include:

- stats
- users
- orders
- products
- deliveries
- farmer verification
- user activation/deactivation
- verification employee creation/assignment
- order status updates
- product deletion
- bulk notification creation

## 12. Security/data privacy

Implemented controls include:

- Helmet
- CORS allowlist
- auth rate limiting
- JWT verification
- DB recheck of account active state
- role checks
- safe public user profiles
- private/authenticated verification media
- backend verification-area enforcement
- backend farmer selling gate
- guarded inventory and delivery-claim updates

## 13. Deployment configuration

Frontend deployment uses `client/vercel.json` for SPA rewrites.

Backend health endpoint:

```text
GET /api/health
```

Production backend startup validates MongoDB, JWT, reset-secret, frontend CORS origin and Cloudinary configuration.

See `SETUP_AND_DEPLOYMENT.md` and `ENVIRONMENT_VARIABLES.md` for exact setup values.

## 14. Known technical debt

These items exist in the current repository and should be considered during future cleanup:

- `server/routes/apiRoutes.js` contains older notification/pricing route code but is not mounted by `server.js`.
- A Cart schema/model is also exported from `server/models/Order.js` while the active cart routes use `server/models/Cart.js`; both guard against duplicate Mongoose model registration.
- Pricing trend/market-analysis endpoints contain predefined data; only the suggestion endpoint attempts recent transaction-history pricing first.
- Production success still depends on external services being configured correctly (MongoDB, Cloudinary, payment provider, SMTP and deployment platforms).
