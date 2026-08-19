# AgroConnect Backend

This directory contains the Node.js/Express backend for AgroConnect.

## Runtime

- Node.js: `20.19.0`
- Express: `4.x`
- MongoDB with Mongoose
- Socket.IO for realtime events
- Cloudinary for product and verification media
- Razorpay payment flow and Stripe webhook support
- Jest + Supertest + mongodb-memory-server for automated tests

## Local setup

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

The backend defaults to:

```text
http://localhost:5001
```

API base URL:

```text
http://localhost:5001/api
```

## Active route groups

Mounted in `server.js`:

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
/api/health        -> health endpoint in server.js
```

`routes/apiRoutes.js` is present as older/compatibility code but is not mounted by the current `server.js`.

## Production-required environment variables

The current startup validation requires these in production:

```env
NODE_ENV=production
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=replace_with_random_secret_at_least_64_characters_long
JWT_RESET_SECRET=replace_with_a_different_random_secret
CLIENT_URL=https://your-vercel-frontend.vercel.app
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Payment/email variables are required only when those features are enabled. See the root `ENVIRONMENT_VARIABLES.md` for the complete reference.

## Farmer verification

Farmer verification is manual. The backend requires persisted evidence before an application can become pending or approved:

- Aadhaar front image
- Aadhaar back image
- current farm photo
- farming video
- valid non-zero GPS location
- farm address
- district
- state

Verification images/videos are uploaded through protected routes and stored as authenticated Cloudinary assets.

Area verification employees are created by admins and restricted by:

```text
verificationArea.state
verificationArea.districts[]
```

A farmer cannot publish produce unless:

```text
verificationStatus === "verified"
```

## Authentication and authorization

Protected routes use JWT bearer tokens:

```http
Authorization: Bearer <token>
```

`middleware/auth.js` verifies the token, reloads the current user from MongoDB, and rejects inactive/suspended accounts before continuing.

## Tests

Run all backend tests:

```bash
npm ci
npm test -- --runInBand
```

Current test files:

```text
__tests__/integration.test.js
__tests__/verification.test.js
```

The suites cover authentication, products, cart/order behavior, deliveries, notifications, farmer verification, area restrictions, suspended-account handling and public-profile privacy.

## Database/index scripts

```bash
npm run create-indexes
npm run create-delivery-indexes
```

Scripts live in `server/scripts/`.

## Health check

```http
GET /api/health
```

The response includes:

- application status
- timestamp
- uptime
- environment
- MongoDB connection state
- Cloudinary configuration state

## Upload limits

- Product/verification images: 10 MB
- Farming verification video: 60 MB

Verification upload form field: `file`.

Product image upload form field: `image`.

## Security notes

- Never commit the real `server/.env` file.
- Keep payment, MongoDB, JWT, SMTP and Cloudinary secrets on the server only.
- Do not expose Aadhaar evidence through public APIs.
- Production `CLIENT_URL` must be the frontend origin, not the backend URL and not a URL ending in `/api`.
- `JWT_SECRET` must meet the current 64-character minimum validation.

For API details see the root `API_DOCUMENTATION.md`. For architecture and security see `ARCHITECTURE.md` and `SECURITY.md` in the repository root.
