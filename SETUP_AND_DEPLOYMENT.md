# AgroConnect - Setup & Deployment Guide

## Table of Contents
1. [Local Development Setup](#local-development-setup)
2. [Backend Configuration](#backend-configuration)
3. [Frontend Configuration](#frontend-configuration)
4. [Database Setup](#database-setup)
5. [API Keys & Services](#api-keys--services)
6. [Running Locally](#running-locally)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Local Development Setup

### Prerequisites
- Node.js v16+ and npm v8+
- MongoDB v4.4+ (or MongoDB Atlas account)
- Git
- Postman (optional, for API testing)

### Clone the Repository
```bash
git clone <repository-url>
cd AGROCONNECT
```

### Install Dependencies

**Backend:**
```bash
cd server
npm install
```

**Frontend:**
```bash
cd client
npm install
```

---

## Backend Configuration

### 1. Environment Variables
Create `.env` file in the `server` directory based on `.env.example`:

```bash
cp .env.example .env
```

**Key Environment Variables:**
```env
NODE_ENV=development
PORT=5001
CLIENT_URL=http://localhost:5173

# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/agroconnect

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d

# Stripe Payment Gateway
STRIPE_PUBLIC_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@agroconnect.com

# Cloudinary
CLOUDINARY_NAME=xxxxx
CLOUDINARY_API_KEY=xxxxx
CLOUDINARY_API_SECRET=xxxxx

# Google Maps API
GOOGLE_MAPS_API_KEY=xxxxx
```

---

## Frontend Configuration

### 1. Environment Variables
Create `.env` file in the `client` directory:

```bash
cp .env.example .env
```

**Key Variables:**
```env
VITE_API_URL=http://localhost:5001/api
```

### 2. Build Configuration
The project uses Vite for fast development and optimized production builds.

---

## Database Setup

### Option 1: MongoDB Atlas (Cloud - Recommended)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account
3. Create a new cluster
4. Create a database user
5. Whitelist your IP address
6. Get the connection string and add to `.env`

### Option 2: Local MongoDB

```bash
# Install MongoDB Community Edition
# Then start the MongoDB service:
mongod
```

**Connection String:**
```env
MONGODB_URI=mongodb://localhost:27017/agroconnect
```

---

## API Keys & Services

### 1. Stripe Payment Gateway
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create a test account
3. Get API keys (Public & Secret)
4. Create webhook secret for local testing with `stripe-cli`
5. Add keys to `.env`

### 2. Email Service (Gmail SMTP)
1. Enable 2-factor authentication on Gmail
2. Generate an [App Password](https://myaccount.google.com/apppasswords)
3. Use app password in `SMTP_PASS`

### 3. Cloudinary (Image Upload)
1. Go to [Cloudinary](https://cloudinary.com)
2. Sign up free account
3. Get API credentials from Dashboard
4. Add to `.env`

### 4. Google Maps API (Optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project
3. Enable Maps API
4. Create API key
5. Add to `.env`

---

## Running Locally

### Terminal 1: Start Backend Server
```bash
cd server
npm install  # First time only
npm start
```

**Expected Output:**
```
✅ MongoDB Connected
🚀 Server running at http://localhost:5001
```

### Terminal 2: Start Frontend Dev Server
```bash
cd client
npm install  # First time only
npm run dev
```

**Expected Output:**
```
VITE v8.0.0 ready in 235 ms

➜  Local:   http://localhost:5173/
```

### Open in Browser
```
http://localhost:5173
```

---

## Production Deployment

### 1. Build Frontend
```bash
cd client
npm run build
```

This generates optimized files in `client/dist/`

### 2. Deploy to Vercel (Recommended for Frontend)

**Option A: Using Vercel CLI**
```bash
npm install -g vercel
vercel
```

**Option B: Git Integration**
1. Push code to GitHub
2. Connect repository on [Vercel](https://vercel.com)
3. Set environment variables in Vercel dashboard
4. Deploy automatically on push

### 3. Deploy Backend to Heroku

**Option A: Using Heroku CLI**
```bash
npm install -g heroku
heroku login
heroku create your-app-name
git push heroku main
```

**Option B: Using Railway, Render, or AWS**

#### Railway.app (Easiest)
1. Go to [Railway](https://railway.app)
2. Connect GitHub repository
3. Add MongoDB plugin
4. Set environment variables
5. Deploy

#### Render
1. Go to [Render](https://render.com)
2. Create new Web Service
3. Connect repository
4. Set environment variables
5. Deploy

### 4. Setup MongoDB Atlas Production Database
1. Create a production cluster
2. Create a separate database user for production
3. Setup backups
4. Update `MONGODB_URI` with production connection string

### 5. Environment Variables for Production
Update all API keys and URLs in production deployment:
- `NODE_ENV=production`
- `CLIENT_URL=your-frontend-domain.com`
- Update Stripe keys to production keys
- Update email credentials
- Ensure database is in production-grade cluster

---

## Project Structure

```
AGROCONNECT/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── context/        # State management
│   │   ├── hooks/          # Custom hooks (voice assistant)
│   │   ├── pages/          # Page components
│   │   ├── services/       # API & utility services
│   │   ├── App.jsx         # Main app component
│   │   └── main.jsx        # Entry point
│   ├── package.json
│   └── vite.config.js
│
└── server/                 # Express Backend
    ├── routes/             # API route handlers
    ├── models/             # Mongoose schemas
    ├── middleware/         # Express middleware
    ├── server.js           # Main server file
    └── package.json
```

---

## Key Features

### Frontend Features
- ✅ Role-based authentication (Farmer, Buyer, Seller, Delivery, Admin)
- ✅ Product browsing and search
- ✅ Shopping cart and checkout
- ✅ Voice search assistance
- ✅ Real-time notifications
- ✅ Location-based services
- ✅ Responsive design

### Backend Features
- ✅ JWT authentication
- ✅ Role-based authorization
- ✅ Product management
- ✅ Cart & Order management
- ✅ Stripe payment integration
- ✅ Real-time updates with Socket.io
- ✅ AI-powered pricing suggestions
- ✅ Delivery tracking

---

## Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution:** Start MongoDB service or use MongoDB Atlas connection string

### CORS Error in Browser
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution:** Ensure `CLIENT_URL` in server `.env` matches your frontend URL

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5001
```
**Solution:** Kill process or change PORT in `.env`

### Module Not Found
```
Cannot find module 'express'
```
**Solution:** Run `npm install` in the respective directory

### Build Errors in Client
```
VITE build failed
```
**Solution:** 
- Clear cache: `npm cache clean --force`
- Delete node_modules: `rm -rf node_modules`
- Reinstall: `npm install`
- Rebuild: `npm run build`

---

## Testing

### Backend API Testing
Use Postman or curl to test endpoints:

```bash
# Login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Get Products
curl http://localhost:5001/api/products

# Health Check
curl http://localhost:5001/api/health
```

### Frontend Testing
```bash
# Run build and serve
cd client
npm run build
npm run preview
```

---

## Performance Optimization

### Frontend
- Vite provides fast HMR (Hot Module Replacement)
- Production build is optimized with tree-shaking and minification
- Use CSS modules for scoped styling
- Lazy load routes using React.lazy()

### Backend
- Implement caching with Redis (optional)
- Use database indexing for frequently queried fields
- Implement API rate limiting
- Use compression middleware

---

## Security Best Practices

1. **Environment Variables:** Never commit `.env` to git
2. **Passwords:** Always hash passwords (bcryptjs)
3. **JWT:** Keep JWT_SECRET secure and rotate periodically
4. **HTTPS:** Use SSL/TLS in production
5. **CORS:** Restrict to known domains only
6. **Validation:** Always validate user input
7. **Rate Limiting:** Implement rate limiting on sensitive endpoints
8. **MongoDB:** Use IP whitelist and strong credentials

---

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review API documentation
3. Check GitHub issues
4. Contact development team

---

## License

MIT License - See LICENSE.md for details

---

## Version
AgroConnect v1.0.0
