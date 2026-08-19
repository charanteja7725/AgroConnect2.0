# AgroConnect Environment Variables

This file documents the environment variables used by the current `charan` branch.

## Client

Create `client/.env`.

### `VITE_API_URL`
Required for deployed frontend builds.

Local:

```env
VITE_API_URL=http://localhost:5001/api
```

Production example:

```env
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

Important: the value must include `/api` because `client/src/services/api.js` appends route paths such as `/auth/login`, `/products` and `/orders` to this base URL.

---

## Server

Create `server/.env`. Never commit a real `.env` file.

### Core runtime

#### `NODE_ENV`

```env
NODE_ENV=development
```

Use `production` on Render and `test` in automated tests.

#### `PORT`

```env
PORT=5001
```

The server defaults to port `5001` when this value is absent. Render may inject its own port.

#### `CLIENT_URL`

```env
CLIENT_URL=http://localhost:5003
```

In production, set this to the stable Vercel frontend origin only, without `/api`:

```env
CLIENT_URL=https://YOUR-PROJECT.vercel.app
```

This value is used by the backend CORS allowlist and password-reset link generation.

---

## MongoDB

### `MONGODB_URI`
Required outside test mode and required by production startup validation.

Local:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/agroconnect
```

Production should use the MongoDB Atlas connection string for the application database.

---

## JWT

### `JWT_SECRET`
Required. Production startup validation requires at least 64 characters.

Generate a strong value, for example:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### `JWT_EXPIRE`
Optional.

```env
JWT_EXPIRE=7d
```

The authentication route defaults to `7d` when not supplied.

### `JWT_RESET_SECRET`
Required in production. It should be independent from `JWT_SECRET`.

Generate it separately with the same command used for `JWT_SECRET`.

---

## Cloudinary

Farmer verification cannot function in production without Cloudinary, and production startup validation refuses to start when the required Cloudinary values are missing.

### `CLOUDINARY_CLOUD_NAME`
### `CLOUDINARY_API_KEY`
### `CLOUDINARY_API_SECRET`

Example placeholders:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

The code also accepts `CLOUDINARY_NAME` as a fallback for the cloud name, but `CLOUDINARY_CLOUD_NAME` is the documented project variable.

Usage:

- product image uploads
- Aadhaar front/back evidence
- farm photo
- farming video
- signed/authenticated verification previews

---

## Razorpay

The current payment create-intent and confirmation flow uses Razorpay when configured.

### `RAZORPAY_KEY_ID`
### `RAZORPAY_KEY_SECRET`

```env
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret
```

If Razorpay is absent, the server can still start, but Razorpay payment endpoints will not work. Production does not allow development mock payment confirmation.

---

## Stripe

Stripe support currently exists for the webhook path.

### `STRIPE_SECRET_KEY`
### `STRIPE_WEBHOOK_SECRET`

```env
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

The server warns rather than refusing startup when these are missing. `/api/payments/webhook` returns `503` while webhook configuration is unavailable.

---

## Email / Nodemailer

Used by `server/services/mailService.js` for welcome, password-reset, order and delivery email functions when SMTP is configured.

### `SMTP_HOST`
### `SMTP_PORT`
### `SMTP_USER`
### `SMTP_PASS`
### `SMTP_FROM`

Example:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@agroconnect.com
```

Do not use a normal personal mailbox password where an application password or provider API credential is expected.

---

## Rate limiting

Used by the authentication limiter in `server/server.js`.

### `RATE_LIMIT_WINDOW_MS`
Default: 15 minutes.

```env
RATE_LIMIT_WINDOW_MS=900000
```

### `RATE_LIMIT_MAX_REQUESTS`
Default: 100.

```env
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Variables present in the example file but not part of the active primary flow

The repository example may contain placeholders for future/optional integrations such as:

- `GOOGLE_MAPS_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `AI_PRICING_API_URL`
- `AI_PRICING_API_KEY`
- `REDIS_URL`

The current main server route mounting does not depend on those values for normal startup.

## Production minimum checklist

At minimum, the current backend expects these to be correct in production:

```env
NODE_ENV=production
MONGODB_URI=...
JWT_SECRET=...
JWT_RESET_SECRET=...
CLIENT_URL=https://YOUR-VERCEL-DOMAIN.vercel.app
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Add payment and SMTP values for the corresponding features you intend to enable.

## Security rules

- Never place backend secrets in variables beginning with `VITE_`.
- Never commit live API keys, passwords, JWT secrets or database credentials.
- Rotate any credential that was accidentally committed to Git history, even if the current file is later replaced with a placeholder.
- Use separate development/test/production credentials.
