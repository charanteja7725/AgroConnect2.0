# AgroConnect Security

## Security model

AgroConnect uses backend-enforced authentication and authorization. Frontend route protection improves UX, but the Express API remains the source of truth for access control.

## Authentication

Protected routes use JWT bearer tokens:

```http
Authorization: Bearer <token>
```

`server/middleware/auth.js` verifies the token with `JWT_SECRET`, reloads the current user from MongoDB, and rejects the request when the account no longer exists or is inactive.

This is important because suspending a user immediately blocks later protected requests even if that user's JWT has not expired.

## Role authorization

Backend routes use `authorize(...roles)` for sensitive actions.

Current roles:

- `buyer`
- `farmer`
- `fertilizer_seller`
- `delivery_partner`
- `verification_employee`
- `admin`

Public registration does not allow `verification_employee` or `admin`.

## Public profile privacy

`User.getPublicProfile()` intentionally excludes:

- email
- phone
- exact address
- bank account details
- Aadhaar/farmer verification evidence
- internal admin review data
- password/reset fields

Public/marketplace responses should use this limited profile shape or explicit safe seller fields.

## Farmer verification evidence

Farmer verification is manual and contains sensitive identity/farm evidence.

Current required evidence:

- Aadhaar front image
- Aadhaar back image
- farm photo
- farming video
- non-zero GPS location
- farm address
- district
- state

Verification media is uploaded to Cloudinary using authenticated delivery rather than normal public product-image delivery.

### Operational rules

- Prefer masked Aadhaar images whenever they are sufficient for the review process.
- Restrict admin and verification employee accounts to authorized staff.
- Do not copy identity images into logs, issue trackers, screenshots or public documentation.
- Do not expose Cloudinary admin credentials to the browser.
- Delete or archive verification evidence according to a documented retention policy when the project moves beyond prototype/demo use.

## Area verification employee restrictions

A `verification_employee` account contains:

```text
verificationArea.state
verificationArea.districts[]
```

The backend checks the farmer's submitted farm state/district before allowing the employee to view/review that farmer. An employee outside the assigned area receives a forbidden response.

## Farmer selling gate

A farmer cannot create produce listings unless:

```text
verificationStatus === "verified"
```

When a farmer is suspended, rejected, or resubmits for review, active seller products are deactivated by backend verification logic.

## CORS

The backend allowlist includes local development origins plus `CLIENT_URL`.

Production must set:

```env
CLIENT_URL=https://YOUR-STABLE-VERCEL-DOMAIN.vercel.app
```

Do not put `/api` in `CLIENT_URL`.

## Security middleware

`server/server.js` currently enables:

- `helmet()`
- CORS allowlisting
- authentication rate limiting
- production proxy trust configuration

Authentication rate limits are configurable through:

```env
RATE_LIMIT_WINDOW_MS
RATE_LIMIT_MAX_REQUESTS
```

## Passwords and reset tokens

Passwords are hashed with `bcryptjs` before save.

Login JWTs use `JWT_SECRET`.

Password reset tokens use `JWT_RESET_SECRET` when available. Production startup validation requires `JWT_RESET_SECRET`.

`JWT_SECRET` must be at least 64 characters in the current startup validation.

## Payments

### Razorpay

The server validates payment ownership and verifies Razorpay signatures using HMAC-SHA256 with `RAZORPAY_KEY_SECRET`.

Development mock Razorpay behavior is not accepted in production.

### Stripe

The Stripe webhook requires configured Stripe secrets and a valid `stripe-signature` header.

## Stock and race-condition protections

Cart validation is not treated as final stock reservation. `/api/orders/create` re-checks product availability and uses guarded stock updates so a stale cart cannot silently oversell inventory.

Delivery job acceptance is also atomic so two delivery partners cannot claim the same unassigned delivery.

## Secret handling

Never commit live values for:

- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_RESET_SECRET`
- `CLOUDINARY_API_SECRET`
- `RAZORPAY_KEY_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SMTP_PASS`

Any credential previously committed to Git history should be treated as compromised and rotated at the provider. Replacing the value in the latest commit does not remove it from repository history.

## Frontend secret rule

Only browser-safe configuration belongs in `VITE_*` variables.

Never create variables such as:

```text
VITE_JWT_SECRET
VITE_CLOUDINARY_API_SECRET
VITE_RAZORPAY_KEY_SECRET
VITE_MONGODB_URI
```

Vite exposes `VITE_*` values to browser code.

## Production checklist

Before production use:

- Use long independent JWT secrets.
- Configure MongoDB Atlas access controls.
- Configure Cloudinary credentials only on the backend.
- Use a stable Vercel domain in `CLIENT_URL`.
- Use HTTPS provider URLs.
- Verify Razorpay/Stripe production credentials separately from test credentials.
- Restrict admin creation and verification employee management.
- Review Aadhaar handling and retention with applicable privacy/compliance requirements before real-user deployment.
- Confirm GitHub history contains no active provider secrets.

## Reporting a security issue

Do not open a public GitHub issue containing secrets, Aadhaar images, access tokens, database credentials or exploitable private-user data. Report sensitive findings privately to the project maintainers and rotate exposed credentials immediately.
