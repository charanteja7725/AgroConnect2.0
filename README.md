# AgroConnect

AgroConnect is a full-stack agricultural marketplace built with React, Vite, Node.js, Express, MongoDB, Socket.IO and Cloudinary. It supports buyers, farmers, fertilizer sellers, delivery partners, area verification employees and administrators.

## Current stack

- Frontend: React 19 + Vite 8
- Backend: Node.js + Express 4
- Database: MongoDB + Mongoose
- Realtime: Socket.IO
- File storage: Cloudinary
- Payments: Razorpay flow plus Stripe webhook support
- CI: GitHub Actions
- Frontend deployment: Vercel
- Backend deployment: Render
- Node version: `20.19.0`

## Project structure

```text
AgroConnect2.0/
├── client/                     # React + Vite frontend
│   ├── src/pages/              # Role dashboards and pages
│   ├── src/context/            # Auth, cart, location and notification context
│   ├── src/services/           # API, location and verification employee services
│   └── vercel.json             # SPA rewrite for React Router
├── server/                     # Express API
│   ├── models/                 # User, Product, Cart, Order/Payment, Delivery, Notification
│   ├── routes/                 # REST API route modules
│   ├── middleware/             # JWT authorization and upload middleware
│   ├── services/               # Email service
│   ├── utils/                  # Cloudinary and geolocation helpers
│   └── __tests__/              # Jest/Supertest integration and verification tests
└── .github/workflows/ci-cd.yml # Frontend build + backend test pipeline
```

## User roles

Public registration supports:

- `buyer`
- `farmer`
- `fertilizer_seller`
- `delivery_partner`

Administrative roles are not available through public registration:

- `verification_employee` - created by an admin and assigned to a state/district area
- `admin`

Farmers must complete manual verification before publishing produce. The current verification evidence is Aadhaar front/back images, farm photo, farming video, GPS location and farm address. A verification employee can only review farmers inside the employee's assigned state/district area.

## Local development

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

Default API URL:

```text
http://localhost:5001/api
```

### 2. Frontend

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

The Vite development server is configured on:

```text
http://localhost:5003
```

The frontend environment variable should be:

```env
VITE_API_URL=http://localhost:5001/api
```

## Required production configuration

The backend validates these in production:

```env
NODE_ENV=production
MONGODB_URI=...
JWT_SECRET=...            # minimum 64 characters
JWT_RESET_SECRET=...
CLIENT_URL=https://your-frontend-domain.vercel.app
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Payment and email credentials are feature-dependent. See [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md).

## Testing and build

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

The GitHub Actions workflow runs both jobs on pushes and pull requests targeting `main` or `charan` with Node `20.19.0`.

## Deployment

### Vercel

Use `client` as the project root and set:

```env
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

`client/vercel.json` rewrites SPA routes to `index.html`, so direct URLs such as `/login`, `/farmer` and `/admin` work after refresh.

### Render

Use `server` as the service root.

- Build command: `npm install`
- Start command: `node server.js`
- Health check: `/api/health`

Set `CLIENT_URL` to the stable Vercel frontend URL.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - application architecture and data flow
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - REST API route reference
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - MongoDB/Mongoose model overview
- [USER_ROLES_AND_FLOWS.md](USER_ROLES_AND_FLOWS.md) - role permissions and workflows
- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) - environment variable reference
- [SECURITY.md](SECURITY.md) - security controls and sensitive-data rules
- [CONTRIBUTING.md](CONTRIBUTING.md) - development workflow
- [CHANGELOG.md](CHANGELOG.md) - current project changes
- [SETUP_AND_DEPLOYMENT.md](SETUP_AND_DEPLOYMENT.md) - extended setup/deployment notes
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - testing notes

## Important implementation notes

- Public seller responses intentionally expose only safe public profile fields.
- Protected routes reload the current user from MongoDB and reject suspended/deactivated accounts even when the JWT has not expired.
- Farmer verification evidence is stored separately from normal product images and uses authenticated Cloudinary delivery.
- Product creation is blocked for unverified farmers.
- Delivery jobs can be claimed atomically by delivery partners to prevent two partners accepting the same job.
- AI pricing can use recent transaction history; when no history exists, the response identifies the fallback as a simulated estimate.
