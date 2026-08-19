# AgroConnect Database Schema

AgroConnect uses MongoDB through Mongoose.

## Main model relationships

```text
User
 |
 +----< Product
 |
 +----1 Cart
 |
 +----< Order (buyer)
 |
 +----< Order.items (seller)
 |
 +----< Delivery (sender / recipient / deliveryPartner)
 |
 +----< Notification
 |
 +----< Payment
```

## User

File: `server/models/User.js`

Important groups:

### Identity

- `firstName`
- `lastName`
- `email` (unique)
- `password` (hashed, not selected by default)
- `phone` (unique)

### Roles

```text
farmer
buyer
fertilizer_seller
delivery_partner
verification_employee
admin
```

### Profile/business

- avatar
- bio
- address
- GeoJSON `location`
- businessName
- businessRegistration
- farmSize
- farmType
- experienceYears
- certifications
- bankAccount

### Statistics/reviews

- rating
- totalReviews
- reviews[]
- totalEarnings
- totalOrders
- totalProducts
- completionRate

### Status

- `isVerified`
- `isActive`
- `verificationStatus`

Farmer verification statuses:

```text
not_submitted
pending
more_information_required
verified
rejected
suspended
```

### Manual farmer verification evidence

`verificationDocuments` contains:

- `aadhaarFront`
- `aadhaarBack`
- `farmPhoto`
- `farmingVideo`
- `farmLocation`
- `submittedAt`
- `additionalNotes`

Each media object can contain:

- url
- publicId
- resourceType
- deliveryType
- uploadedAt

`farmLocation` contains:

- latitude
- longitude
- address
- village
- district
- state
- pincode

### Verification employee assignment

`verificationArea`:

- state
- districts[]

### Admin review

`adminReview`:

- reviewedBy
- reviewedAt
- notes
- rejectionReason
- moreInfoRequest

### User indexes

- `location` 2dsphere
- composite verification lookup index on role, status, state and district

## Product

File: `server/models/Product.js`

Core fields:

- name
- description
- type
- category
- seller -> User
- sellerName
- price
- quantity
- unit
- images[]
- mainImage
- GeoJSON location
- address
- rating/reviews
- stock state
- AI pricing fields
- totalSold
- totalViews
- isActive
- isVerified

Product types:

```text
produce
fertilizer
other
```

Product categories:

```text
vegetables
fruits
grains
npk
organic
pesticide
seeds
equipment
other
```

Units:

```text
kg
liter
bag
piece
box
```

Indexes include:

- `location` 2dsphere
- text index on name/description
- seller/category/active index
- price/rating index

## Cart

Primary runtime file: `server/models/Cart.js`

One cart per user (`user` is unique).

Cart fields:

- user -> User
- items[]
- totalQuantity
- totalPrice
- lastUpdated

Cart item fields:

- product -> Product
- seller -> User
- quantity
- price
- totalPrice
- addedAt

### Compatibility note

`server/models/Order.js` also defines/exports a `Cart` model guarded by `mongoose.models.Cart`. The active cart/order routes import `server/models/Cart.js`, while some test/import paths use the export from `Order.js`. Do not introduce another Cart model name; the current duplication should be treated as compatibility/technical debt if it is refactored later.

## Order

File: `server/models/Order.js`

Core fields:

- orderNumber
- buyer -> User
- items[]
- billingAddress
- deliveryAddress
- subtotal
- shippingCost
- tax
- discount
- totalAmount
- payment
- status
- statusHistory[]
- delivery metadata
- rating
- notes/cancellation/refund fields

Order item fields include:

- product -> Product
- seller -> User
- sellerName
- productName
- productType
- quantity
- price
- totalPrice

Order status values:

```text
pending
confirmed
processing
shipped
delivered
cancelled
refunded
```

Order payment status values:

```text
pending
completed
failed
refunded
```

Supported order payment-method values:

```text
credit_card
debit_card
upi
net_banking
wallet
cash_on_delivery
```

Order numbers are generated in a pre-save hook.

## Payment

File: `server/models/Order.js`

Payment is a separate Mongoose model exported from the same file as Order.

Fields include:

- user -> User
- order -> Order
- amount
- currency
- method
- status
- transactionId
- failure/receipt fields
- Stripe identifiers
- Razorpay identifiers/signature
- refund fields

Payment methods:

```text
stripe
razorpay
paypal
wallet
```

Payment statuses:

```text
initiated
processing
completed
failed
refunded
```

## Delivery

File: `server/models/Delivery.js`

Core fields:

- deliveryNumber
- deliveryPartner -> User
- partner contact/location
- type
- order -> Order
- items[]
- sender -> User
- sender contact/location
- recipient -> User
- recipient contact/location
- pickup/delivery timestamps
- route[]
- status
- statusHistory[]
- proof
- rating
- deliveryCharge/tips/earnings
- issue fields

Delivery types:

```text
product
fertilizer
```

Delivery statuses:

```text
assigned
accepted
picked_up
in_transit
near_delivery
delivered
cancelled
failed
```

Geospatial indexes exist for:

- partnerLocation
- recipientLocation
- senderLocation

Delivery numbers are generated in a pre-save hook.

## Notification

File: `server/models/Notification.js`

Fields:

- user -> User
- title
- message
- type
- relatedId
- relatedModel
- read
- timestamp
- metadata

Notification types:

```text
info
order
system
alert
```

Related model options:

```text
Order
Product
User
```

## Geospatial convention

MongoDB GeoJSON coordinate arrays use:

```text
[longitude, latitude]
```

Do not reverse this order when writing product/user/delivery GeoJSON fields.

Farmer verification form data stores named latitude/longitude fields, then the backend converts the accepted farm location into the user's GeoJSON `location` as `[longitude, latitude]`.

## Sensitive-data boundary

The presence of sensitive fields in the User model does not mean they should be returned publicly.

Public marketplace responses should use `getPublicProfile()` or explicit public seller field lists and must not expose bank or verification evidence.
