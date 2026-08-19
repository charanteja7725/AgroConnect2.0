# AgroConnect Fix Summary

This file summarizes the major fixes currently present in the repository and the reason for each one.

## Authentication and authorization

### Suspended user JWT handling

`server/middleware/auth.js` reloads the user from MongoDB on protected requests and rejects inactive accounts.

Result:

```text
valid unexpired JWT + suspended/deactivated account -> 403
```

### Public registration role restriction

`server/routes/auth.js` restricts public role selection to:

- farmer
- buyer
- fertilizer_seller
- delivery_partner

Verification employees are created by admins.

## User privacy

`server/models/User.js` now separates full/private profile data from `getPublicProfile()`.

Public profiles exclude bank information, private contact details, exact private address, verification evidence, reset fields and internal review details.

Product routes also populate an explicit safe seller field list rather than the complete User document.

## Farmer verification

The previous lightweight/notes-only farmer verification path in the dashboard was replaced by the dedicated `/verification` workflow.

Current evidence:

- Aadhaar front/back
- farm photo
- farming video
- GPS
- farm address/district/state

Verification evidence is persisted by dedicated protected upload endpoints before final submission.

A farmer cannot create produce until `verificationStatus` is `verified`.

## Area verification employees

Added:

- `verification_employee` role
- admin employee creation/management
- state and district assignments
- `/verification-employee` dashboard
- backend area matching before queue access/review

This prevents a verification employee from approving a farmer outside the employee's assigned area.

## Admin API consistency

`server/server.js` mounts:

```text
/api/admin
```

so the frontend/admin service calls match the backend route location.

## Farmer Orders React crash

The farmer Orders UI previously attempted to render an address object directly as a React child, causing React error #31 in production.

The dashboard now formats object-based delivery addresses into renderable text.

## Vercel deep-link 404

Direct visits/refreshes on React Router paths such as `/login` previously returned Vercel `404: NOT_FOUND`.

`client/vercel.json` now rewrites SPA paths to `index.html`, allowing React Router to resolve the route.

## Frontend/backend API base URL

The Vite frontend uses:

```env
VITE_API_URL=https://backend.example/api
```

The `/api` suffix is required because frontend service functions append route paths such as `/auth/login`.

## Product privacy and seller rules

Product endpoints now expose safe seller data.

Backend rules enforce:

- verified farmer -> produce
- fertilizer seller -> fertilizer
- valid GPS before active publishing

## Cart/order consistency

Cart is API-backed and scoped to the authenticated shopper.

Farmers can use the shopping flow for fertilizer products only.

Order creation now:

- validates delivery address
- fills trusted buyer name/phone from authenticated user where needed
- re-checks live stock
- uses guarded stock decrements
- restores earlier reservations if a later item fails
- clears the cart only after successful order creation

## Stock race-condition test

The old test tried to add more stock to the cart than existed, so the cart correctly rejected the item and checkout later reported an empty cart.

The test was corrected to simulate a true race:

```text
stock = 1
add 1 to cart successfully
external stock change -> 0
checkout
backend re-check -> insufficient stock
```

## Payments

Razorpay package/config handling was corrected so backend imports/tests work without requiring live credentials.

Payment confirmation validates:

- payment ownership
- order ownership
- stored provider order ID
- signature
- production mock restrictions

Stripe webhook behavior is explicitly unavailable (`503`) when Stripe webhook configuration is absent; the automated expectation was aligned with this intended behavior.

## Delivery

Payment/order confirmation can create one delivery per seller while avoiding duplicates.

Delivery partners can discover unclaimed jobs and claim a job atomically so two partners cannot take the same delivery.

Status changes are validated against backend transition rules.

## Cloudinary test noise

Verification tests intentionally do not use live Cloudinary. Preview URL generation now avoids unnecessary configuration warnings in the test environment when Cloudinary is absent.

Production still requires Cloudinary because farmer verification evidence storage depends on it.

## CI/build

`.github/workflows/ci-cd.yml` uses Node `20.19.0` and runs:

```text
Backend: npm ci -> npm test -- --runInBand
Frontend: npm ci -> npm run build
```

`.node-version` also pins `20.19.0` for platform/runtime consistency.

## Documentation/environment cleanup

Repository documentation has been aligned to the current implementation instead of older unfinished TODOs.

`server/.env.example` uses placeholders only. Real credentials must remain outside Git, and any credential that was previously committed should be rotated because historical commits can preserve old values.
