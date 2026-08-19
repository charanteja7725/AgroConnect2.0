# AgroConnect — Product Requirements Document (PRD)

**Document owner:** AgroConnect Team  
**Repository:** `charanteja7725/AgroConnect2.0`  
**Target branch:** `charan`  
**Status:** Current implementation baseline  
**Last updated:** 19 August 2026

> This document defines **what AgroConnect must do and why**. Architecture belongs in `HLD.md`; implementation details belong in `LLD.md`.

---

## 1. Product Summary

AgroConnect is a multi-role agricultural marketplace that connects farmers directly with produce buyers, enables farmers to purchase fertilizers from fertilizer sellers, and coordinates delivery through delivery partners. The platform also includes a manual farmer-verification workflow so that only approved farmers can publish produce listings.

The product is designed around six roles:

- **Farmer** — sells verified produce and can also buy fertilizer.
- **Buyer** — discovers produce, manages a cart, places orders and tracks purchases.
- **Fertilizer Seller** — lists and manages fertilizer products and fulfills fertilizer orders.
- **Delivery Partner** — accepts available delivery jobs and updates delivery progress.
- **Verification Employee** — manually reviews farmer verification evidence within an assigned state/district area.
- **Admin** — manages users, products, orders, deliveries, verification employees and farmer verification decisions.

---

## 2. Problem Statement

Small and medium farmers often depend on intermediaries to reach buyers, have limited visibility into pricing, and lack a simple digital channel that combines selling, purchasing farm inputs and delivery coordination. Buyers face difficulty discovering nearby farm produce from identifiable sellers. At the same time, an unrestricted farmer-signup flow creates trust problems because any user could claim to be a farmer.

AgroConnect addresses these problems by combining:

1. a direct produce marketplace;
2. fertilizer purchasing for farmers;
3. manual farmer identity/farm verification;
4. location-aware discovery;
5. role-based order and delivery workflows;
6. price guidance and notifications.

---

## 3. Product Goals

### 3.1 Primary goals

- Allow verified farmers to create, edit and manage produce listings.
- Allow buyers to discover active products and buy from multiple sellers through a cart and order flow.
- Allow farmers to buy fertilizer without allowing them to purchase their own produce or other produce as a farmer-shopping account.
- Allow fertilizer sellers to manage fertilizer inventory independently from farmer produce inventory.
- Require manual evidence-based verification before a farmer can publish produce.
- Route farmer verification work to verification employees by assigned geographic area.
- Support delivery creation, claiming, tracking and completion.
- Preserve sensitive user, bank and verification data from public marketplace responses.
- Provide role-specific dashboards and route protection.

### 3.2 Secondary goals

- Provide location-aware product and delivery discovery.
- Provide AI/market-assisted pricing suggestions while clearly treating simulated fallback estimates as estimates.
- Provide in-app/real-time notifications for important marketplace events.
- Support payment integrations without making payment configuration a prerequisite for basic cash-on-delivery ordering.

---

## 4. Non-Goals

The current product does **not** promise the following:

- automatic government/API farmer verification;
- Aadhaar-number verification against a government registry;
- autonomous farm ownership validation;
- guaranteed real-time mandi/commodity pricing from an external official source;
- end-to-end logistics optimization or route planning;
- financial lending, crop insurance or subsidy eligibility decisions;
- public exposure of Aadhaar evidence, bank details or internal verification notes.

Farmer verification is intentionally a **manual review process** performed by authorized platform personnel.

---

## 5. User Personas

### 5.1 Farmer

Needs to establish trust, upload farm verification evidence, sell produce after approval, manage stock and orders, and buy fertilizer.

### 5.2 Buyer

Needs to browse/search produce, identify sellers, add available products to a cart, provide a delivery address, place orders and receive status updates.

### 5.3 Fertilizer Seller

Needs to publish fertilizer inventory, update quantity/price and respond to orders involving their products.

### 5.4 Delivery Partner

Needs to view available delivery jobs, claim a job safely, see pickup/drop information and update status/location through delivery completion.

### 5.5 Verification Employee

Needs to see only farmer applications within assigned state/district coverage, inspect evidence and location, and approve/reject/request more information.

### 5.6 Administrator

Needs cross-platform operational control: users, products, orders, deliveries, verification employees, account activation/suspension and verification decisions.

---

## 6. Functional Requirements

### FR-01 — Registration and authentication

- Public users must be able to register as farmer, buyer, fertilizer seller or delivery partner.
- Admin and verification-employee accounts must not be self-created through the public registration flow.
- Users must be able to log in using email/password.
- Protected functionality must require a valid authenticated session/token.
- Deactivated users must not be allowed to continue using protected APIs even with an unexpired token.

### FR-02 — Role-based access

- Each dashboard must be accessible only to its permitted role.
- Unauthorized API access must return an authorization error.
- Verification employees must not receive general admin permissions.

### FR-03 — Farmer verification

A farmer must be able to submit:

- Aadhaar front image;
- Aadhaar back image;
- current farm photo;
- farming video;
- captured farm latitude/longitude;
- farm address;
- village/town;
- district;
- state;
- PIN code;
- optional notes;
- verification consent.

Submission must remain incomplete until required evidence and a valid non-zero location are present.

Verification states must support:

- `not_submitted`
- `pending`
- `more_information_required`
- `verified`
- `rejected`
- `suspended`

A farmer must not be able to create/publish produce until `verificationStatus` is `verified`.

### FR-04 — Area-based verification review

- Admin must be able to create a `verification_employee` account.
- Each verification employee must be assigned a state and optionally one or more districts.
- A verification employee must only be able to retrieve/review farmer applications within the assigned area.
- Review actions must include approve, reject and request-more-information; suspension may be performed according to authorization rules.
- Approval must fail when mandatory farmer evidence is incomplete.

### FR-05 — Produce product management

- Verified farmers must be able to create produce products.
- Farmers must not be able to create fertilizer products.
- Product fields must include name, description, category, price, quantity, unit, images and location.
- A product without a valid GPS location may be saved as inactive/draft rather than publicly published.
- Sellers must be able to edit/delete their own products.
- Unauthorized users must not be able to modify another seller’s product.

### FR-06 — Fertilizer product management

- Fertilizer sellers must be able to create fertilizer listings.
- Fertilizer sellers must not create produce listings through the fertilizer role.
- Fertilizer listings may contain fertilizer-specific composition information.

### FR-07 — Marketplace discovery

- Public product discovery must return active, in-stock products.
- Users must be able to filter/search by supported product attributes.
- The product API must support pagination and price/rating/newest style sorting as implemented.
- Location-based discovery must support latitude/longitude and maximum-distance inputs.
- Public seller information must be limited to non-sensitive marketplace fields.

### FR-08 — Cart

- Buyers may add eligible marketplace products to the cart.
- Farmers may use the cart only for fertilizer-store products.
- Users must not add their own products.
- Cart quantity must never exceed current available product quantity.
- Users must be able to update quantity, remove items and clear the cart.

### FR-09 — Order creation

- Buyer/farmer-shopping users must provide a complete delivery address.
- The order must be built from the authenticated user’s server-side cart, not arbitrary client-provided product totals.
- Product price and available stock must be revalidated at checkout.
- Stock reservation/update must prevent overselling under concurrent requests.
- If stock changes during checkout, the user must receive a clear conflict/error response.
- Successful order creation must clear the cart.

### FR-10 — Order lifecycle

Supported order lifecycle must include the implemented states:

`pending → confirmed → processing → shipped → delivered`

with allowed cancellation from supported intermediate states.

- Sellers/admin may update order status only when authorized.
- Buyer/farmer shoppers may cancel only their own cancellable orders.
- Cancellation must restore reserved inventory where applicable.

### FR-11 — Delivery workflow

- A delivery record must be associated with an order and relevant seller/buyer data.
- Delivery partners must be able to view their deliveries.
- Available/unassigned delivery jobs may be discovered through the nearby endpoint.
- Claiming a delivery must be atomic so two delivery partners cannot claim the same job.
- Delivery status must follow the configured transition sequence.
- Delivery partner location updates may be recorded during delivery progress.

### FR-12 — Payments

- Cash on delivery must remain available for order creation.
- Stripe and Razorpay integrations may be used when correctly configured.
- Missing provider secrets must produce controlled service errors instead of application crashes.
- Webhook verification must not succeed when the required webhook secret is missing.

### FR-13 — Pricing assistance

- Farmers/fertilizer sellers may request a price suggestion using product type, category, quantity and current price.
- When recent transaction history is available, the system may derive a suggestion from recent order data.
- When the fallback calculation is used, the response must identify the result as simulated/estimated rather than an authoritative market price.

### FR-14 — Notifications

- Authenticated users must be able to retrieve their notifications.
- The platform must create notifications for important order events where implemented.
- Real-time notification delivery may use Socket.IO rooms scoped to a user identifier.

### FR-15 — Administration

Admin capabilities must include:

- summary statistics;
- user listing/search/filtering;
- user activation/deactivation;
- product listing/deletion;
- order listing/status management;
- delivery listing;
- farmer verification review;
- verification-employee creation and area assignment;
- targeted system notifications.

---

## 7. Non-Functional Requirements

### NFR-01 — Security

- Secrets must be stored in environment variables and never hard-coded in source.
- Passwords must be hashed before storage.
- JWT-protected routes must re-check current account status.
- Sensitive verification media must use authenticated/private media delivery where configured.
- Public APIs must not expose password, bank, exact verification evidence or internal admin-review information.
- CORS must permit only configured frontend origins plus explicit local-development origins.

### NFR-02 — Privacy

- Aadhaar evidence must be treated as sensitive identity data.
- The UI should prefer masked Aadhaar evidence where operationally possible.
- Verification evidence must only be available to authorized review roles.
- Public seller profiles must contain marketplace-safe fields only.

### NFR-03 — Reliability and data integrity

- Checkout must protect stock against race conditions.
- Delivery claiming must be atomic.
- Invalid status transitions must be rejected.
- Failed order creation after stock reservation must restore previously reserved stock.

### NFR-04 — Performance

- Product listing must support pagination.
- Location queries must use geospatial indexes.
- Frequently queried role/status/location fields should be indexed where implemented.

### NFR-05 — Maintainability

- Frontend and backend must remain separate `client/` and `server/` applications.
- CI must run backend Jest tests and a frontend production build.
- Node.js version must remain pinned consistently with repository configuration.

### NFR-06 — Usability

- Role-specific dashboards must avoid exposing irrelevant actions.
- Verification status and missing evidence must be clearly communicated.
- Errors should be actionable rather than generic wherever a user can correct the input.

---

## 8. Primary User Journeys

### 8.1 Farmer onboarding and selling

1. Farmer registers and logs in.
2. Farmer opens `/verification`.
3. Farmer uploads required evidence and captures farm location.
4. Farmer submits verification.
5. Application becomes `pending`.
6. Authorized verification employee/admin reviews the application.
7. On approval, farmer becomes `verified`.
8. Farmer can create and publish produce.

### 8.2 Buyer purchase

1. Buyer logs in.
2. Buyer browses/searches active produce.
3. Buyer adds products to cart.
4. Buyer reviews quantities.
5. Buyer provides delivery details and chooses a payment method.
6. Backend revalidates price/stock and creates order.
7. Buyer receives order status updates.

### 8.3 Farmer fertilizer purchase

1. Farmer opens fertilizer store.
2. Farmer adds fertilizer products to cart.
3. Farmer checks out using the same controlled order path.
4. Produce/non-fertilizer items are rejected for farmer-shopping accounts.

### 8.4 Delivery fulfilment

1. Confirmed order produces delivery work according to current backend flow.
2. Delivery partner views available/assigned work.
3. Partner claims an available job.
4. Partner progresses through pickup, transit and delivery states.
5. Delivery status/location updates become available to relevant users.

---

## 9. Acceptance Criteria

A release is acceptable when all of the following hold:

- A new farmer cannot publish produce before manual verification.
- Required verification media and location are enforced server-side.
- Verification employee access is geographically scoped.
- A suspended/deactivated user is blocked on the next protected API call.
- Public product/seller endpoints do not expose Aadhaar evidence, bank details or internal review data.
- A buyer can add, update and remove cart items and create an order from valid stock.
- Concurrent stock changes do not silently oversell inventory.
- A farmer-shopping account can buy fertilizer but cannot buy produce through the farmer cart flow.
- A fertilizer seller can create fertilizer but not produce.
- Delivery claiming prevents duplicate claims.
- Invalid order/delivery state transitions are rejected.
- Frontend production build succeeds.
- Backend automated tests succeed.

---

## 10. Success Measures

For product evaluation, use measurable outcomes rather than implementation activity:

- percentage of farmer applications successfully reaching a review decision;
- percentage of verified farmers who publish at least one product;
- successful cart-to-order conversion rate;
- order failure rate caused by stock conflicts;
- percentage of deliveries completed without manual admin correction;
- number of unauthorized-access/privacy incidents (target: zero);
- API error rate for core auth/product/cart/order flows;
- CI pass rate on release commits.

---

## 11. Constraints and Assumptions

- MongoDB is the primary persistence layer.
- Product and verification media storage depends on Cloudinary in production.
- Stripe/Razorpay features depend on provider credentials and are optional relative to cash-on-delivery ordering.
- GPS quality depends on browser/device location permission and accuracy.
- Manual verification quality depends on reviewer process; the software does not prove land ownership automatically.
- Production frontend and backend are deployed independently and communicate through configured URLs.

---

## 12. Release Scope

The current release scope is the implemented full-stack web application covering authentication, role-based dashboards, farmer verification, marketplace products, fertilizer shopping, cart, ordering, payments integration hooks, delivery, notifications and administration.

Detailed system structure is defined in **`HLD.md`**. Endpoint/module/model behavior is defined in **`LLD.md`**.
