# AgroConnect Testing Guide

## Current automated test setup

Backend testing uses:

- Jest
- Supertest
- `mongodb-memory-server`

Test files:

```text
server/__tests__/integration.test.js
server/__tests__/verification.test.js
```

The GitHub Actions workflow runs:

```bash
npm test -- --runInBand
```

from the `server/` directory.

## Run backend tests locally

```bash
cd server
npm ci
npm test -- --runInBand
```

The test environment uses `NODE_ENV=test` and an in-memory MongoDB server, so it does not require a live production database.

## Current backend coverage areas

### Authentication

Tests cover behavior such as:

- user registration
- invalid email rejection
- duplicate email rejection
- login success/failure
- generic forgot-password response

### Products

Tests cover:

- product listing and filters
- verified farmer product creation
- authentication requirement
- product review creation
- self-review rejection
- duplicate-review rejection

### Cart

Tests cover:

- adding items
- fetching the authenticated user's cart

### Orders

Tests cover:

- creating an order from a cart
- empty-cart rejection
- seller order status update
- stock re-check behavior at checkout

The stale-cart stock test first adds an available quantity to the cart, then changes database stock before checkout to simulate a real race. Checkout must reject the order rather than oversell.

### Delivery

Tests cover:

- open/nearby delivery discovery
- delivery partner acceptance
- ownership after acceptance
- assigned partner information
- status/location update
- route/status history behavior

### Notifications

Tests cover:

- fetching the user's notifications
- unread count
- marking a notification as read

### Users/security

Tests cover:

- profile endpoint authentication
- nearby seller route ordering/search behavior

### Payments

When Stripe webhook configuration is intentionally absent in tests, the webhook endpoint is expected to return:

```text
503 Service Unavailable
```

This matches the active backend behavior.

## Farmer verification/security suite

`verification.test.js` covers critical manual-verification rules including:

- unverified farmer cannot create products
- forged verification media supplied only in the final request is rejected
- complete persisted verification evidence can be submitted
- submission changes farmer status to pending
- employee sees only assigned-area farmers
- employee cannot approve outside assigned area
- assigned employee can approve complete evidence
- suspended account is blocked even with an unexpired JWT
- another user cannot obtain bank/verification/private contact data
- public product seller data does not expose private fields
- `/api/admin` is mounted
- admin can create an area verification employee

Cloudinary is intentionally not required by these verification tests because test fixtures persist representative evidence metadata directly into the in-memory database. Signed preview generation is skipped when Cloudinary is not configured in test mode.

## Frontend validation

The repository does not currently contain a browser/unit test suite for React components. The automated frontend CI check is a production build.

Run:

```bash
cd client
npm ci
npm run build
```

Optional local lint check:

```bash
npm run lint
```

## GitHub Actions

Workflow:

```text
.github/workflows/ci-cd.yml
```

Backend environment supplied by CI includes test JWT secrets and `NODE_ENV=test`.

Frontend build environment uses:

```env
VITE_API_URL=http://localhost:5001/api
```

No production secrets are required for the CI build/test jobs.

## Manual smoke testing

Automated tests do not prove external providers are configured. After deployment, manually verify:

```text
Backend /api/health
Frontend deep-link refresh (/login, /farmer, /admin)
Frontend-to-backend API URL
CORS from the real Vercel origin
MongoDB connection
Cloudinary product upload
Cloudinary farmer verification image/video upload
Farmer manual verification submission
Verification employee area filtering/review
Verified farmer product creation
Buyer/farmer cart rules
Order creation and stock change handling
Delivery partner claim and status updates
Payment provider test-mode flow
Email flow when SMTP is configured
```

## Farmer verification manual QA scenario

1. Register/login as farmer.
2. Confirm farmer cannot publish a product before verification.
3. Open `/verification`.
4. Upload Aadhaar front/back, farm photo and farming video.
5. Capture valid farm GPS and enter address/district/state.
6. Submit verification and confirm status becomes `pending`.
7. Login as a verification employee assigned to that farmer's area.
8. Confirm the farmer appears in the employee queue.
9. Approve the farmer.
10. Login/refresh as farmer and confirm verified status.
11. Create a produce listing with GPS.
12. Confirm the listing is available through the marketplace APIs.

Repeat with an employee assigned to a different area and confirm review is forbidden.

## Security regression checklist

Whenever changing auth/user/product/verification routes, re-check:

- public endpoints never expose bank details or verification evidence
- suspended account JWTs are rejected
- farmers cannot bypass verification by editing frontend state
- verification employees cannot review outside assigned areas
- arbitrary uploaded URLs cannot substitute for persisted verification evidence
- users cannot update/delete another seller's products unless admin
- stock cannot become negative through stale-cart checkout
- two delivery partners cannot claim the same open job
- production payment code cannot accept development mock confirmation

## CI interpretation

A failing test should be fixed by comparing the expectation with the current intended backend behavior. Do not weaken production validation merely to make a stale test green. If intended behavior changed, update the test so it still exercises the real business/security condition.
