# AgroConnect

AgroConnect is a full-stack agricultural marketplace connecting farmers, buyers, fertilizer sellers, and delivery partners.

## Project Structure

- `client/` - React + Vite frontend
- `server/` - Express + MongoDB backend API

## Prerequisites

- Node.js 18+ installed
- MongoDB instance available (local or cloud)
- Stripe credentials if payment integration is required

## Local Setup

### Backend

1. Open terminal in `server/`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with:
   ```env
   PORT=5003
   MONGO_URI=<your_mongo_connection_string>
   JWT_SECRET=<your_jwt_secret>
   JWT_EXPIRE=7d
   STRIPE_SECRET_KEY=<your_stripe_secret_key>
   CLIENT_URL=http://localhost:5003
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

### Frontend

1. Open terminal in `client/`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file if needed:
   ```env
   VITE_API_URL=http://localhost:5003/api
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Build

To build the frontend for production:

```bash
cd client
npm run build
```

## Deployment

- Deploy `server/` to a Node hosting service such as Heroku, Render, or Railway.
- Deploy `client/` to a static hosting service such as Vercel, Netlify, or GitHub Pages.
- Ensure `VITE_API_URL` points to the deployed backend API.
- Ensure CORS and environment variables are configured correctly.

## Features Completed

- Role-based login and registration flows
- Buyer dashboard with voice search and geolocation product filtering
- Cart management and checkout flow
- Farmer product listing flow
- Notification and auth context support
- Basic admin, delivery, and fertilizer dashboard layouts

## Notes

- The backend includes JWT auth and role-based route protection.
- Product and order APIs support buyer, seller, and delivery interactions.
- This repository is ready for final QA and deployment after environment setup.
