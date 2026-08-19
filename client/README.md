# AgroConnect Frontend

This directory contains the React + Vite frontend for AgroConnect.

## Runtime

- React `19.x`
- React Router `7.x`
- Vite `8.x`
- Socket.IO client
- Node.js `20.19.0`

## Local setup

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

The Vite server is configured in `vite.config.js` to run on:

```text
http://localhost:5003
```

## Environment variable

The frontend expects:

```env
VITE_API_URL=http://localhost:5001/api
```

Production example:

```env
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

The `/api` suffix is required because the API service appends endpoints such as `/auth/login`, `/products` and `/orders` to this base URL.

Do not put backend secrets in `VITE_*` variables because Vite exposes those values to browser code.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

Production build output is written to:

```text
dist/
```

## Current routes

Public:

```text
/
/login
/register
/role
/roles
```

Protected routes:

```text
/buyer                              buyer
/buyer/cart                         buyer, farmer
/farmer                             farmer
/farmer/add-product                 farmer
/farmer/edit-product/:id            farmer
/farmer/purchases                   farmer
/verification                       farmer
/fertilizer                         fertilizer_seller
/fertilizer/add-product             fertilizer_seller
/fertilizer/edit-product/:id        fertilizer_seller
/fertilizer-store                   buyer, farmer
/delivery                           delivery_partner
/delivery/:id                       delivery_partner
/verification-employee              verification_employee
/admin                              admin
/admin/verification-employees       admin
```

`ProtectedRoute.jsx` controls frontend route access. The backend still performs the authoritative authentication/authorization checks.

## Main frontend areas

### Buyer

- marketplace dashboard
- search/filter/location-aware product loading
- API-backed cart
- checkout/order creation

### Farmer

- dashboard and orders
- produce listing/add/edit
- fertilizer-store shopping
- purchases view
- manual verification page

### Farmer verification

`src/pages/Verification.jsx` collects:

- Aadhaar front
- Aadhaar back
- farm photo
- farming video
- farm GPS
- farm address
- village/town
- district
- state
- PIN code
- optional notes/consent

The evidence is uploaded through dedicated backend verification-upload APIs before the final verification submission.

### Fertilizer seller

- seller dashboard
- fertilizer product add/edit
- relevant order handling

### Delivery partner

- delivery dashboard
- nearby/unclaimed jobs
- delivery detail/status/location updates

### Verification employee

`/verification-employee` allows an area-assigned employee to manually review farmer evidence returned by the backend.

### Admin

- platform dashboard
- farmer verification administration
- user/product/order management
- verification employee creation and assignment

## Frontend state/services

Important directories:

```text
src/context/       auth, cart, location, notifications, language
src/services/      API, location, verification employee calls
src/components/    protected routes, notifications, language, voice UI
src/pages/         role-specific pages
```

`src/services/api.js` is the main REST client and reads `VITE_API_URL`.

## Vercel

Use `client/` as the Vercel project root.

`vercel.json` contains an SPA rewrite so direct browser visits and refreshes on routes such as `/login`, `/farmer`, `/verification` and `/admin` are served through `index.html` and handled by React Router.

Recommended production environment variable:

```env
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

After changing a Vite environment variable in Vercel, create a new deployment so the build receives the new value.

## Build validation

```bash
npm ci
npm run build
```

The same production build command is run by `.github/workflows/ci-cd.yml` on Node `20.19.0`.

For complete architecture, environment, API and role documentation, see the Markdown files in the repository root.
