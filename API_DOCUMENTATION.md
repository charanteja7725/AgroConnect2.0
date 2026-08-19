# AgroConnect API Documentation

## Base URL

Local development:

```text
http://localhost:5001/api
```

Production frontend configuration should point `VITE_API_URL` to the deployed backend API, for example:

```text
https://YOUR-RENDER-SERVICE.onrender.com/api
```

Protected endpoints use:

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

File uploads use `multipart/form-data`.

## Health

### `GET /api/health`
Public health endpoint. Returns server status, environment, MongoDB connection state and whether Cloudinary is configured.

---

## Authentication - `/api/auth`

### `POST /api/auth/register`
Public registration.

Allowed public roles:

- `farmer`
- `buyer`
- `fertilizer_seller`
- `delivery_partner`

Required fields:

```json
{
  "firstName": "Asha",
  "lastName": "Kumar",
  "email": "asha@example.com",
  "password": "secret123",
  "phone": "9999999999",
  "role": "farmer"
}
```

### `POST /api/auth/login`
Returns JWT and current user profile.

### `GET /api/auth/me`
Protected. Returns the logged-in user's current profile.

### `POST /api/auth/logout`
Protected. Stateless logout response; the frontend is responsible for discarding its token.

### `POST /api/auth/forgot-password`
Public. Uses a generic success response to reduce email-enumeration risk.

### `POST /api/auth/reset-password/:resetToken`
Public. Verifies the reset token and updates the password.

---

## Users and farmer verification - `/api/users`

### `POST /api/users/verify/submit`
Protected: `farmer`.

Submits already-uploaded farmer evidence and farm location for manual review.

The backend requires persisted:

- Aadhaar front
- Aadhaar back
- farm photo
- farming video
- valid non-zero GPS
- farm address
- district
- state

Successful submission changes verification status to `pending`.

### `GET /api/users/verify/pending?status=pending`
Protected: `admin`, `verification_employee`.

Valid statuses include:

- `not_submitted`
- `pending`
- `more_information_required`
- `verified`
- `rejected`
- `suspended`

Verification employees only receive farmers in their assigned state/district area.

### `PUT /api/users/verify/:id`
Protected: `admin`, `verification_employee`.

Body:

```json
{
  "action": "verified",
  "notes": "Evidence checked in assigned area"
}
```

Employee actions:

- `verified`
- `rejected`
- `more_information_required`

Admin can also use:

- `suspended`

### `PUT /api/users/:id/suspend`
Protected: `admin`.

```json
{
  "action": "suspend"
}
```

or:

```json
{
  "action": "activate"
}
```

### `GET /api/users/role/:role`
Protected: `admin`.

Returns users for the selected role.

### `GET /api/users/search/nearby`
Public.

Query parameters:

- `longitude`
- `latitude`
- `maxDistance`
- `role=farmer|fertilizer_seller`

Verified status is required for nearby farmers.

### `GET /api/users/:id`
Protected.

Returns a full private profile only to the same user or an admin. Other authenticated users receive the safe public profile.

### `PUT /api/users/:id`
Protected. Same user or admin only.

Allowed update fields are controlled by the backend.

### `POST /api/users/:id/review`
Protected. Adds a user review. Self-review and duplicate review are rejected.

### `DELETE /api/users/:id`
Protected. Same user or admin.

---

## Products - `/api/products`

### `GET /api/products`
Public product list.

Supported query parameters include:

- `type`
- `category`
- `minPrice`
- `maxPrice`
- `search`
- `sortBy=price_low|price_high|rating`
- `page`
- `limit`
- `latitude`
- `longitude`
- `maxDistance`

Public seller data is intentionally restricted to safe seller fields.

### `GET /api/products/seller/:sellerId`
Public. Returns active products for a seller.

### `GET /api/products/:id`
Public. Returns one product and increments `totalViews`.

### `POST /api/products`
Protected: `farmer`, `fertilizer_seller`.

Farmer requirements:

- verification status must be `verified`
- product type must be `produce`

Fertilizer seller requirement:

- product type must be `fertilizer`

Products without valid GPS are saved inactive rather than published.

### `PUT /api/products/:id`
Protected. Seller owner or admin.

### `DELETE /api/products/:id`
Protected. Seller owner or admin.

### `POST /api/products/:id/review`
Protected. Adds a product review. Self-review and duplicate review are rejected.

---

## Cart - `/api/cart`

Cart endpoints are protected for `buyer` and `farmer`.

Farmers can use the shopping cart for fertilizer-store products only.

### `GET /api/cart`
Returns or initializes the current user's cart.

### `POST /api/cart/add`

```json
{
  "productId": "<product-id>",
  "quantity": 1
}
```

### `PUT /api/cart/update/:itemId`

```json
{
  "quantity": 2
}
```

### `DELETE /api/cart/remove/:itemId`
Removes one cart line.

### `DELETE /api/cart/clear`
Clears the current cart.

---

## Orders - `/api/orders`

### `GET /api/orders`
Protected. Results are scoped by role:

- admin: all orders
- buyer: own purchases
- farmer: purchases plus orders containing the farmer's products
- fertilizer seller: orders containing seller products
- delivery partner: orders assigned through order delivery metadata

### `GET /api/orders/:id`
Protected. Access is limited to involved users or admin.

### `POST /api/orders/create`
Protected: `buyer`, `farmer`.

Creates an order from the current cart. Delivery address requires name, phone, street, city, state and ZIP code; name/phone can be filled from the authenticated user profile when omitted by older clients.

Stock is re-checked during checkout before the order is created.

Supported payment method values:

- `credit_card`
- `debit_card`
- `upi`
- `net_banking`
- `wallet`
- `cash_on_delivery`

### `PUT /api/orders/:id/status`
Protected. Authorized seller, admin or assigned delivery partner.

Backend-enforced order transitions prevent arbitrary status changes.

### `POST /api/orders/:id/cancel`
Protected: `buyer`, `farmer` purchasing account.

Only the order buyer can cancel, and only when the current state allows cancellation.

---

## Payments - `/api/payments`

### `POST /api/payments/create-intent`
Protected order buyer.

```json
{
  "orderId": "<order-id>"
}
```

Uses Razorpay when configured. Development-only mock order creation may be used after provider failure, but production rejects mock payment behavior.

### `POST /api/payments/confirm`
Protected order buyer.

Expected fields include:

- `paymentId`
- `orderId`
- `razorpayPaymentId`
- `razorpayOrderId`
- `razorpaySignature`

The backend verifies the signature using `RAZORPAY_KEY_SECRET`.

### `GET /api/payments/:orderId`
Protected. Payment owner or admin.

### `POST /api/payments/webhook`
Stripe webhook endpoint.

Returns `503` when Stripe webhook configuration is unavailable. With Stripe configured, the `stripe-signature` header is required and verified.

---

## Delivery - `/api/delivery`

### `GET /api/delivery`
Protected and role scoped.

### `GET /api/delivery/nearby`
Protected: `delivery_partner`.

Returns unclaimed deliveries. Optional geospatial query:

- `longitude`
- `latitude`
- `maxDistance`

### `GET /api/delivery/:id`
Protected to delivery participants or admin.

### `POST /api/delivery/create`
Protected: `admin`.

### `PUT /api/delivery/:id/assign`
Protected: `admin`.

Assigns an active delivery partner.

### `PUT /api/delivery/:id/accept`
Protected: `delivery_partner`.

Claims an unassigned delivery atomically.

### `PUT /api/delivery/:id/status`
Protected: assigned `delivery_partner`.

Main transition sequence:

```text
assigned/accepted -> picked_up -> in_transit -> near_delivery -> delivered
```

---

## Uploads - `/api/upload`

Cloudinary must be configured.

### `POST /api/upload/image`
Protected: `farmer`, `fertilizer_seller`.

Form field name:

```text
image
```

Image limit: 10 MB.

### Verification evidence uploads
Protected: `farmer`.

Form field name for all verification uploads:

```text
file
```

Endpoints:

- `POST /api/upload/verification/aadhaar-front`
- `POST /api/upload/verification/aadhaar-back`
- `POST /api/upload/verification/farm-photo`
- `POST /api/upload/verification/farming-video`

Verification image limit: 10 MB.

Verification video limit: 60 MB.

Verification media is uploaded as authenticated Cloudinary content and persisted into the user's verification document fields.

---

## Notifications - `/api/notifications`

### `POST /api/notifications/send`
Protected.

### `GET /api/notifications`
Protected. Returns notifications for the logged-in user and `unreadCount`.

### `PUT /api/notifications/:id/read`
Protected. Marks the current user's notification as read.

---

## Pricing - `/api/pricing`

### `POST /api/pricing/suggest`
Protected: `farmer`, `fertilizer_seller`.

```json
{
  "productType": "produce",
  "category": "vegetables",
  "quantity": 50,
  "currentPrice": 30
}
```

If matching transaction history is available, the suggested price can be based on recent order item prices. If not, the route uses simulated fallback logic and returns `isSimulated: true`.

### `GET /api/pricing/trends/:category`
Public. Currently returns predefined trend data for supported categories.

### `GET /api/pricing/market-analysis`
Public. Currently returns predefined overall market-analysis data.

---

## Admin - `/api/admin`

All admin endpoints require role `admin`.

### Dashboard/data

- `GET /api/admin/stats`
- `GET /api/admin/users`
- `GET /api/admin/orders`
- `GET /api/admin/products`
- `GET /api/admin/deliveries`

### Verification employees

- `POST /api/admin/verification-employees`
- `GET /api/admin/verification-employees`
- `PUT /api/admin/verification-employees/:id`

Admin-created verification employee body includes first name, last name, email, password, phone, state and optional districts.

### User status

- `PUT /api/admin/users/:id/status`

Body:

```json
{
  "isActive": false
}
```

### Compatibility farmer verification administration

- `GET /api/admin/verifications`
- `PUT /api/admin/verifications/:id`

These routes apply the same core evidence requirements before a farmer can be approved.

### Order/product/notification administration

- `PUT /api/admin/orders/:id/status`
- `DELETE /api/admin/products/:id`
- `POST /api/admin/notifications/send`

## HTTP status patterns

Typical responses use:

- `200` success
- `201` created
- `400` invalid request/business rule failure
- `401` authentication failure
- `403` authorization/account-status failure
- `404` missing resource
- `409` conflict/race-condition result
- `500` unexpected server error
- `503` configured feature/service unavailable
