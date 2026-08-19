# AgroConnect Setup and Deployment

## Prerequisites

- Node.js `20.19.0`
- npm
- MongoDB database (local or Atlas)
- Cloudinary account for uploads/verification evidence
- Payment-provider credentials if enabling online payment
- SMTP credentials if enabling email delivery

## Local backend

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

Default backend:

```text
http://localhost:5001
```

Health endpoint:

```text
http://localhost:5001/api/health
```

Minimum local `.env` for core API development:

```env
NODE_ENV=development
PORT=5001
CLIENT_URL=http://localhost:5003
MONGODB_URI=mongodb://127.0.0.1:27017/agroconnect
JWT_SECRET=replace_with_random_secret_at_least_64_characters_long
JWT_RESET_SECRET=replace_with_a_different_random_secret_at_least_64_characters_long
JWT_EXPIRE=7d
```

Cloudinary is required for actual image/video upload workflows.

## Local frontend

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

The Vite server is configured for:

```text
http://localhost:5003
```

Client `.env`:

```env
VITE_API_URL=http://localhost:5001/api
```

## Clean validation before deployment

Backend:

```bash
cd server
npm ci
npm test -- --runInBand
```

Frontend:

```bash
cd client
npm ci
npm run build
```

The repository GitHub Actions workflow performs those backend test and frontend build jobs on Node `20.19.0`.

## Render backend deployment

Recommended service configuration for this repository:

```text
Root Directory: server
Build Command: npm install
Start Command: node server.js
```

Do not hard-code a production `PORT`; the server reads `process.env.PORT` and falls back to `5001` locally.

### Required production environment

```env
NODE_ENV=production
MONGODB_URI=your_atlas_connection_string
JWT_SECRET=your_random_64_plus_character_secret
JWT_RESET_SECRET=a_different_random_64_plus_character_secret
CLIENT_URL=https://YOUR-STABLE-VERCEL-DOMAIN.vercel.app
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Optional feature credentials:

```env
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
```

### Render health check

Configure/use:

```text
/api/health
```

A healthy response should report the API status and indicate MongoDB/Cloudinary state. Farmer verification uploads will not work without Cloudinary.

## Vercel frontend deployment

Use:

```text
Root Directory: client
Framework: Vite
Build Command: npm run build
Output Directory: dist
```

Production environment variable:

```env
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

Important:

- Include `/api` in `VITE_API_URL`.
- Do not add `/api` to Render's `CLIENT_URL` value.
- Redeploy Vercel after changing `VITE_API_URL`, because Vite variables are injected at build time.

## SPA routing on Vercel

The repository includes:

```text
client/vercel.json
```

It rewrites React Router paths to `index.html`. This is required so refreshing a route such as:

```text
/login
/farmer
/verification
/admin
```

does not produce a Vercel file-system 404.

## Connecting Vercel and Render

Use this relationship:

```text
Vercel frontend
   VITE_API_URL=https://backend.onrender.com/api
        |
        v
Render backend
   CLIENT_URL=https://frontend.vercel.app
        |
        v
MongoDB / Cloudinary / payment services
```

No special direct Vercel-to-Render integration is required beyond correct URLs, CORS and environment variables.

## CORS

The backend allows:

- `http://localhost:5173`
- `http://localhost:5174`
- `CLIENT_URL`

For production, `CLIENT_URL` must exactly match the browser origin of the deployed frontend (trailing slash is normalized by the backend).

## MongoDB

`MONGODB_URI` must point to the database used by the Render service. The server connects automatically outside test mode.

If the `/api/health` endpoint reports MongoDB disconnected, inspect Render logs and MongoDB Atlas connectivity/access configuration.

## Cloudinary

Cloudinary is required by production startup because farmer verification depends on private evidence storage.

Verification assets are uploaded as authenticated resources. Normal product images use regular upload delivery.

## Payment deployment notes

### Razorpay

Configure both:

```env
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
```

The current online payment create/confirm flow validates stored orders and Razorpay signatures. Development mock fallback is not allowed in production.

### Stripe

The repository has a Stripe webhook endpoint. Configure:

```env
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

when using that webhook flow.

## Email deployment notes

`server/services/mailService.js` uses SMTP settings when configured. Registration, password-reset, order and delivery flows should not depend on exposing SMTP credentials to the frontend.

## GitHub Actions

Workflow file:

```text
.github/workflows/ci-cd.yml
```

Triggers:

- pushes to `main` or `charan`
- pull requests to `main` or `charan`
- manual workflow dispatch

Jobs:

- Backend Tests (Node.js & Jest)
- Frontend Build (Vite & React)

## Post-deployment smoke test

Verify in this order:

```text
1. GET backend /api/health
2. Open frontend /
3. Open /login directly and refresh it
4. Register/login a normal user
5. Load marketplace products
6. Farmer: open /verification
7. Confirm product/farm uploads if Cloudinary is configured
8. Confirm admin/verification employee role routing with test accounts
9. Create a cart/order in a non-production test environment
10. Test payment only with provider test credentials until ready for live use
```

## Secret handling

Never commit real `.env` files or provider secrets. If a credential has ever been committed to Git, replace the repository value with a placeholder and rotate the credential at the provider because Git history can retain the previous value.
