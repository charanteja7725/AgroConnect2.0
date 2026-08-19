# AgroConnect — High-Level Design (HLD)

**Document purpose:** System architecture and major design decisions  
**Repository:** `charanteja7725/AgroConnect2.0`  
**Target branch:** `charan`  
**Last updated:** 19 August 2026

> This document explains **how the major parts of AgroConnect fit together**. Product requirements are in `PRD.md`. File-level, route-level and state-machine details are in `LLD.md`.

---

## 1. System Context

AgroConnect is a web-based agricultural marketplace with a React/Vite frontend and a Node.js/Express backend. MongoDB stores application data, Cloudinary stores product and farmer-verification media, and Socket.IO provides real-time notification/event delivery. Payment integrations are available through Stripe and Razorpay when configured.

### External actors

- Farmer
- Buyer
- Fertilizer Seller
- Delivery Partner
- Verification Employee
- Admin

### External services

- MongoDB / MongoDB Atlas
- Cloudinary
- Stripe
- Razorpay
- SMTP provider for transactional emails
- Browser Geolocation API

---

## 2. Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                         Web Browser                         │
│                                                             │
│  React 19 + Vite + React Router + Context + Socket.IO Client│
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON / Multipart / WS
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node.js / Express API                    │
│                                                             │
│  Auth | Users | Products | Cart | Orders | Payments         │
│  Delivery | Uploads | Notifications | Pricing | Admin       │
│                                                             │
│  JWT auth | RBAC | validation | rate limiting | CORS        │
│  Socket.IO | email service | Cloudinary integration         │
└───────────────┬────────────────┬────────────────┬────────────┘
                │                │                │
                ▼                ▼                ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │   MongoDB    │  │  Cloudinary  │  │ Payment /    │
        │ users/orders │  │ images/video │  │ Email APIs   │
        │ products/etc │  │ verification │  │              │
        └──────────────┘  └──────────────┘  └──────────────┘
```

---

## 3. Architectural Style

AgroConnect uses a **modular monolithic backend** and a **single-page application frontend**.

### Why this structure fits the current repository

- The domain is broad but still manageable inside one backend service.
- Shared transactions and role checks are easier while orders, inventory and users live in one service/database boundary.
- Deployment remains simple: one frontend and one backend.
- Individual route modules provide separation without introducing distributed-system complexity.
- The design can later be decomposed into services if traffic or team scale requires it.

---

## 4. Frontend Architecture

### 4.1 Technology

- React 19
- Vite 8
- React Router
- Context-based application state
- Socket.IO client
- Browser Geolocation API

### 4.2 Frontend responsibilities

The frontend is responsible for:

- route presentation and role-specific navigation;
- collecting form input;
- displaying verification/product/order/delivery status;
- requesting browser location permission;
- uploading product and verification media through backend endpoints;
- maintaining authenticated UI state;
- consuming backend cart/order/product/admin APIs;
- displaying real-time notifications and updates.

The frontend must **not** be the authority for role permission, verification approval, stock validity or sensitive data access. Those are backend responsibilities.

### 4.3 Route segmentation

Public routes include home, login, registration and role selection.

Protected route groups are separated by role:

- Buyer routes
- Farmer routes
- Fertilizer seller routes
- Delivery partner routes
- Verification employee route
- Admin routes

React Router is used for client-side routing, while Vercel SPA rewrite configuration maps deep links back to `index.html`.

---

## 5. Backend Architecture

### 5.1 Technology

- Node.js 20.19.0
- Express 4
- Mongoose 7
- JWT
- bcryptjs
- express-validator
- Helmet
- CORS
- express-rate-limit
- Multer
- Cloudinary SDK
- Socket.IO
- Nodemailer
- Stripe SDK
- Razorpay SDK

### 5.2 Route-module boundaries

The Express application separates major domains into route modules:

```text
/api/auth
/api/users
/api/products
/api/orders
/api/cart
/api/payments
/api/delivery
/api/upload
/api/notifications
/api/pricing
/api/admin
```

Each module owns HTTP orchestration for its domain while Mongoose models provide persistence.

### 5.3 Cross-cutting middleware

The server centralizes:

- JWT authentication;
- role authorization;
- account-active checks;
- CORS;
- security headers;
- request size limits;
- authentication rate limiting;
- centralized error handling;
- 404 handling.

This ensures permissions are enforced consistently at the API boundary rather than relying on frontend visibility.

---

## 6. Data Architecture

MongoDB is the primary datastore.

### Core entities

- `User`
- `Product`
- `Cart`
- `Order`
- `Payment`
- `Delivery`
- `Notification`

### Relationship summary

```text
User
 ├── creates Product
 ├── owns Cart
 ├── places Order
 ├── acts as seller on Order items
 ├── may act as Delivery Partner
 └── receives Notification

Order
 ├── contains Product references
 ├── references Buyer and Sellers
 ├── can generate Delivery records
 └── can have Payment records

Delivery
 ├── references Order
 ├── references Sender
 ├── references Recipient
 └── may reference Delivery Partner
```

GeoJSON `Point` data is used for user/product/delivery location where relevant, enabling MongoDB geospatial indexes and proximity queries.

---

## 7. Farmer Verification Architecture

Farmer verification is a **manual trust workflow**, not an external government API integration.

### Evidence pipeline

```text
Farmer Browser
    │
    ├── Aadhaar front image
    ├── Aadhaar back image
    ├── Farm photo
    ├── Farming video
    └── GPS + farm address
    │
    ▼
Express protected upload endpoints
    │
    ▼
Cloudinary authenticated media storage
    │
    ▼
User.verificationDocuments
    │
    ▼
Verification Employee / Admin review
    │
    ▼
verificationStatus = verified / rejected / more_information_required
```

### Design principles

- Evidence is uploaded through authenticated backend endpoints.
- The farmer cannot mark themselves verified.
- Verification media is stored separately from public product media.
- The server verifies required evidence before approval.
- Verification employees are limited by assigned geographic area.
- Farmer selling is gated by backend verification status.

---

## 8. Marketplace and Inventory Architecture

### Product publication

A seller submits product information and location to the backend. The backend validates role/type compatibility and seller verification where required.

For farmers:

```text
farmer + verified + produce + valid location
                 ↓
          publishable product
```

For fertilizer sellers:

```text
fertilizer_seller + fertilizer
                 ↓
          fertilizer listing
```

### Product discovery

Two major read paths exist:

1. normal filtered/paginated product queries;
2. geospatial product discovery using MongoDB `$geoNear`.

Public responses project only marketplace-safe seller fields.

---

## 9. Cart and Order Architecture

The server-side cart is the source of truth for checkout.

```text
Product discovery
      ↓
Cart API
      ↓
Server-side quantity validation
      ↓
Order creation request
      ↓
Re-read current products
      ↓
Atomic guarded stock decrement
      ↓
Create Order
      ↓
Clear Cart
      ↓
Notifications / delivery workflow
```

### Inventory integrity

Stock is not trusted from client-side totals. Before order creation, product availability and quantity are checked against MongoDB. Guarded updates prevent silent overselling if another customer purchases the same inventory simultaneously.

If part of reservation succeeds but later reservation/order creation fails, reserved inventory is restored.

---

## 10. Delivery Architecture

Delivery is modeled separately from the order because one order may contain items from multiple sellers.

### Delivery lifecycle

A delivery links:

- source seller;
- destination buyer;
- order;
- items;
- optional delivery partner;
- pickup/drop locations;
- status history;
- route/location updates.

Available jobs can be queried by delivery partners. Claiming uses an atomic database update so multiple drivers cannot claim the same unassigned delivery.

Status transitions are validated server-side.

---

## 11. Notification and Real-Time Architecture

Notifications have two layers:

### Persistent layer

A `Notification` document stores user-facing notification history.

### Real-time layer

Socket.IO rooms use a user-scoped naming convention:

```text
user_<userId>
```

This allows the backend to emit events to the currently connected user while preserving the database record for later retrieval.

Additional order/delivery Socket.IO events support live status updates.

---

## 12. Payment Architecture

AgroConnect supports multiple payment approaches while preserving cash-on-delivery as a basic order option.

### Stripe

- secret-key based server integration;
- webhook endpoint requires raw request body;
- webhook secret is required for verified webhook processing.

### Razorpay

- server-side Razorpay client is configured only when key ID and key secret are available;
- missing configuration must produce controlled errors/warnings rather than crash unrelated features.

Payment-provider secrets remain backend-only.

---

## 13. Pricing Assistance Architecture

The pricing module is an advisory service.

Preferred data source:

```text
recent matching order history
        ↓
average recent transaction price
        ↓
price suggestion
```

Fallback:

```text
category baseline + demand/seasonal calculation
        ↓
simulated estimate
```

The fallback is deliberately labeled as simulated so it is not presented as an official market quotation.

---

## 14. Security Architecture

### Authentication

- JWT bearer tokens
- bcrypt password hashing
- separate reset-token secret where configured

### Authorization

Role-based authorization is enforced at backend routes.

### Account suspension

Protected middleware re-loads the current user from MongoDB on each request. A deactivated user is rejected even if their JWT has not expired.

### Data exposure controls

Public product/seller APIs use restricted seller projections. Sensitive user fields such as bank data, verification documents and admin-review information are not part of the public seller shape.

### Upload security

- images and video have MIME filtering;
- file-size limits apply;
- verification uploads require a farmer session;
- verification media uses Cloudinary authenticated delivery configuration.

### Network/API protections

- Helmet security headers;
- CORS allowlist;
- auth rate limiting;
- request body size limits;
- centralized API errors.

---

## 15. Deployment Architecture

```text
GitHub repository
      │
      ├── client/ ──► Vercel
      │                │
      │                └── VITE_API_URL
      │
      └── server/ ──► Render
                       │
                       ├── MongoDB Atlas
                       ├── Cloudinary
                       ├── Stripe / Razorpay
                       └── SMTP
```

### Frontend production

- Root: `client/`
- Build: `npm run build`
- Output: `dist`
- SPA rewrite: `client/vercel.json`

### Backend production

- Root: `server/`
- Start: `node server.js`
- Node version: repository `.node-version` = `20.19.0`
- Production startup validates critical environment configuration.

---

## 16. CI Architecture

GitHub Actions runs on pushes and pull requests to `main` and `charan`.

Two independent jobs provide fast isolation:

```text
Backend Tests
  └── npm ci
  └── Jest --runInBand

Frontend Build
  └── npm ci
  └── Vite production build
```

A frontend success proves the SPA compiles; a backend success proves the Jest suites pass under test configuration.

---

## 17. Reliability and Failure Handling

### Backend startup

Production startup rejects missing critical settings for JWT, database, frontend CORS URL and Cloudinary verification storage.

### External service degradation

- email failure should not invalidate successful registration/order actions;
- payment-provider absence should affect payment-specific operations, not crash the entire server;
- Cloudinary absence is considered critical in production because farmer verification depends on it.

### Data integrity

- inventory reservation uses guarded updates;
- delivery claiming uses atomic updates;
- state transitions are validated;
- order cancellation restores inventory.

---

## 18. Scalability Considerations

The current modular monolith can scale vertically and horizontally with shared MongoDB and external media storage.

Key scale mechanisms already present or compatible with the design:

- paginated product/admin queries;
- MongoDB indexes;
- geospatial indexes;
- stateless JWT API nodes;
- external Cloudinary media delivery;
- independent static frontend hosting.

If the system grows significantly, likely future extraction boundaries are:

- notifications/realtime;
- payments;
- delivery/logistics;
- pricing/analytics;
- media processing.

Such decomposition is not required for the current project.

---

## 19. Key Design Decisions

| Decision | Reason |
|---|---|
| Manual farmer verification | Avoids pretending an unofficial API proves farmer identity/land ownership |
| Backend-enforced selling gate | Frontend-only gating is bypassable |
| Separate verification employee role | Limits sensitive evidence access and supports local review operations |
| Geographic employee assignment | Matches the intended area-based verification process |
| Server-side cart | Prevents client manipulation of price/quantity at checkout |
| Guarded stock updates | Protects against concurrent overselling |
| Separate Delivery entity | Supports multi-seller orders and dedicated delivery lifecycle |
| Restricted public seller projection | Prevents privacy leakage |
| Authenticated Cloudinary verification media | Keeps identity evidence separate from public marketplace images |
| Vercel + Render separation | Fits SPA/static frontend and Node API deployment models |

---

## 20. Architecture Boundaries

The HLD intentionally does not enumerate every API payload, schema field or React function. Those implementation-level contracts are documented in **`LLD.md`**.

The feature/business expectations that architecture must satisfy are documented in **`PRD.md`**.
