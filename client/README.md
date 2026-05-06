# AgroConnect Frontend

This is the React + Vite frontend for AgroConnect, the agricultural marketplace connecting farmers, buyers, fertilizer sellers, and delivery partners.

## Getting Started

Use the following commands in the `client/` directory:

### `npm install`
Installs frontend dependencies.

### `npm run dev`
Runs the frontend in development mode at `http://localhost:5173`.

### `npm run build`
Bundles the app for production.

## Environment Variables

Create a `.env` file in `client/` with:

```env
VITE_API_URL=http://localhost:5000/api
```

## Frontend Features

- Role-based registration and login
- Buyer dashboard with voice search and geolocation
- Cart checkout flow
- Farmer product management and product listing
- Delivery partner and fertilizer seller dashboard layouts
- Admin overview dashboard
- Auth, cart, location, and notification context support

## Notes

- The frontend communicates with the backend using `VITE_API_URL`.
- Build output is generated in `client/dist`.
- For project-level setup and deployment, see the root `README.md`.
