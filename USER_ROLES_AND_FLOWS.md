# AgroConnect User Roles and Flows

## Role overview

The current `User` model supports six roles:

| Role | Public registration | Main purpose |
|---|---:|---|
| `buyer` | Yes | Browse products, manage cart, place orders |
| `farmer` | Yes | Sell produce after manual verification; buy fertilizer |
| `fertilizer_seller` | Yes | Sell fertilizer products |
| `delivery_partner` | Yes | Claim and deliver open delivery jobs |
| `verification_employee` | No | Manually review farmers in assigned state/district |
| `admin` | No | Platform administration and employee management |

Public registration is restricted by `server/routes/auth.js` and does not accept admin or verification employee roles.

## Buyer flow

```text
Register / Login
      |
      v
/buyer
      |
      +--> browse/search/filter products
      +--> add products to cart
      +--> /buyer/cart
      +--> create order
      +--> pay / choose supported order payment method
      +--> follow order/delivery status
```

Buyer API access is scoped to the buyer's own cart, orders and deliveries.

## Farmer flow

### Registration and verification

```text
Register as farmer
      |
      v
/farmer
      |
      v
/verification
      |
      +--> upload Aadhaar front
      +--> upload Aadhaar back
      +--> upload current farm photo
      +--> upload farming video
      +--> capture GPS
      +--> enter farm address/district/state
      |
      v
POST /api/users/verify/submit
      |
      v
verificationStatus = pending
      |
      v
manual employee/admin review
```

Verification statuses:

- `not_submitted`
- `pending`
- `more_information_required`
- `verified`
- `rejected`
- `suspended`

### Selling

A farmer can publish produce only when:

```text
verificationStatus === "verified"
```

Farmer product type is restricted to:

```text
produce
```

### Farmer as shopper

Farmers can also use:

- `/fertilizer-store`
- `/buyer/cart`
- `/farmer/purchases`

The backend restricts farmer shopping to fertilizer products.

## Fertilizer seller flow

```text
Register / Login
      |
      v
/fertilizer
      |
      +--> add fertilizer product
      +--> edit product
      +--> view/manage relevant orders
```

Fertilizer seller product type is restricted to:

```text
fertilizer
```

## Delivery partner flow

```text
Register / Login
      |
      v
/delivery
      |
      +--> view own deliveries
      +--> find nearby unclaimed deliveries
      +--> accept delivery atomically
      +--> update status/location
      |
      v
/delivery/:id
```

Main delivery progression:

```text
assigned -> accepted -> picked_up -> in_transit -> near_delivery -> delivered
```

The backend prevents invalid status transitions.

## Verification employee flow

Verification employees are created by an admin, not by public registration.

Each employee has:

```text
verificationArea.state
verificationArea.districts[]
```

Flow:

```text
Admin creates employee
      |
      v
Admin assigns state/districts
      |
      v
Employee logs in
      |
      v
/verification-employee
      |
      v
GET /api/users/verify/pending
      |
      v
Only farmers in assigned area are returned
      |
      v
Review Aadhaar + farm media + GPS/location
      |
      +--> verified
      +--> rejected
      +--> more_information_required
```

A verification employee cannot suspend a farmer through the verification review route; suspension is reserved for admin-level control.

## Admin flow

```text
Admin login
      |
      v
/admin
      |
      +--> platform stats
      +--> user management
      +--> products
      +--> orders
      +--> farmer verification
      |
      v
/admin/verification-employees
      |
      +--> create employee
      +--> assign state/districts
      +--> activate/deactivate employee
```

Admin backend routes are mounted under:

```text
/api/admin
```

## Farmer verification decision rules

A farmer cannot be approved unless the backend finds all of the following persisted evidence:

- Aadhaar front
- Aadhaar back
- farm photo
- farming video
- valid non-zero latitude
- valid non-zero longitude
- farm address
- district
- state

The browser cannot make a farmer pending/verified merely by sending arbitrary media URLs; evidence is expected to have been persisted by protected upload routes first.

## Suspension/reactivation behavior

When a user is inactive:

```text
protect middleware -> 403
```

For farmers, suspension also removes verified selling trust and hides active products.

Reactivating a suspended farmer does not automatically restore `verified`; the farmer returns to a review-required state.

## Frontend route matrix

| Route | Allowed role(s) |
|---|---|
| `/buyer` | buyer |
| `/buyer/cart` | buyer, farmer |
| `/farmer` | farmer |
| `/farmer/add-product` | farmer |
| `/farmer/edit-product/:id` | farmer |
| `/farmer/purchases` | farmer |
| `/verification` | farmer |
| `/fertilizer` | fertilizer_seller |
| `/fertilizer/add-product` | fertilizer_seller |
| `/fertilizer/edit-product/:id` | fertilizer_seller |
| `/fertilizer-store` | buyer, farmer |
| `/delivery` | delivery_partner |
| `/delivery/:id` | delivery_partner |
| `/verification-employee` | verification_employee |
| `/admin` | admin |
| `/admin/verification-employees` | admin |

Backend authorization remains authoritative even if a frontend route is accidentally exposed.
