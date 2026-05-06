# AgroConnect - Testing Guide

## API Testing Guide

### Authentication Endpoints

#### 1. User Registration
**Endpoint:** `POST /api/auth/register`
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Farmer",
    "email": "john@farm.com",
    "password": "SecurePass123",
    "phone": "9876543210",
    "role": "farmer",
    "address": {
      "street": "123 Farm Lane",
      "city": "Punjab",
      "state": "Punjab",
      "zipCode": "160001",
      "country": "India"
    }
  }'
```

#### 2. User Login
**Endpoint:** `POST /api/auth/login`
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@farm.com",
    "password": "SecurePass123"
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "_id": "60d5ec49c1234a1b2c3d4e5f",
    "firstName": "John",
    "email": "john@farm.com",
    "role": "farmer"
  }
}
```

---

### Product Endpoints

#### 1. Get All Products
**Endpoint:** `GET /api/products`
```bash
curl http://localhost:5000/api/products
```

**With Filters:**
```bash
curl "http://localhost:5000/api/products?category=vegetables&maxPrice=500"
```

#### 2. Create Product (Farmer)
**Endpoint:** `POST /api/products`
```bash
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Fresh Tomatoes",
    "description": "Organic red tomatoes",
    "category": "vegetables",
    "price": 40,
    "quantity": 100,
    "unit": "kg",
    "harvestDate": "2024-05-01",
    "description": "Fresh harvest",
    "image": "https://example.com/tomato.jpg"
  }'
```

---

### Cart Endpoints

#### 1. Get Cart
**Endpoint:** `GET /api/cart`
```bash
curl http://localhost:5000/api/cart \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 2. Add to Cart
**Endpoint:** `POST /api/cart/add`
```bash
curl -X POST http://localhost:5000/api/cart/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "productId": "60d5ec49c1234a1b2c3d4e5f",
    "quantity": 5
  }'
```

#### 3. Update Cart Item
**Endpoint:** `PUT /api/cart/update/:itemId`
```bash
curl -X PUT http://localhost:5000/api/cart/update/60d5ec49c1234a1b2c3d4e5f \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "quantity": 10
  }'
```

#### 4. Remove from Cart
**Endpoint:** `DELETE /api/cart/remove/:itemId`
```bash
curl -X DELETE http://localhost:5000/api/cart/remove/60d5ec49c1234a1b2c3d4e5f \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Order Endpoints

#### 1. Create Order
**Endpoint:** `POST /api/orders/create`
```bash
curl -X POST http://localhost:5000/api/orders/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "deliveryAddress": {
      "fullName": "John Doe",
      "phone": "9876543210",
      "street": "123 Main St",
      "city": "Bangalore",
      "state": "Karnataka",
      "zipCode": "560001",
      "country": "India"
    },
    "paymentMethod": "upi"
  }'
```

#### 2. Get Orders
**Endpoint:** `GET /api/orders`
```bash
curl http://localhost:5000/api/orders \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 3. Update Order Status
**Endpoint:** `PUT /api/orders/:id/status`
```bash
curl -X PUT http://localhost:5000/api/orders/60d5ec49c1234a1b2c3d4e5f/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "status": "confirmed",
    "note": "Order confirmed by seller"
  }'
```

---

### Payment Endpoints

#### 1. Create Payment Intent (Stripe)
**Endpoint:** `POST /api/payments/create-intent`
```bash
curl -X POST http://localhost:5000/api/payments/create-intent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "60d5ec49c1234a1b2c3d4e5f",
    "amount": 5000
  }'
```

---

### Delivery Endpoints

#### 1. Get Deliveries
**Endpoint:** `GET /api/delivery`
```bash
curl http://localhost:5000/api/delivery \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 2. Update Delivery Status
**Endpoint:** `PUT /api/delivery/:id/status`
```bash
curl -X PUT http://localhost:5000/api/delivery/60d5ec49c1234a1b2c3d4e5f/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "status": "in_transit",
    "location": {
      "latitude": 28.7041,
      "longitude": 77.1025
    },
    "note": "Out for delivery"
  }'
```

---

## Frontend Testing

### Manual Testing Checklist

#### Authentication Flow
- [ ] User can register as farmer
- [ ] User can register as buyer
- [ ] User can register as delivery partner
- [ ] User can register as fertilizer seller
- [ ] Login works with valid credentials
- [ ] Login fails with invalid credentials
- [ ] Token is stored in localStorage
- [ ] User is redirected to correct dashboard

#### Buyer Dashboard
- [ ] Products load from backend
- [ ] Search functionality works
- [ ] Voice search works (when available)
- [ ] Add to cart works
- [ ] Cart count updates
- [ ] Notifications appear

#### Cart Flow
- [ ] Cart loads items
- [ ] Quantity can be updated
- [ ] Items can be removed
- [ ] Total price calculates correctly
- [ ] Checkout button works
- [ ] Order submission works

#### Farmer Dashboard
- [ ] Farmer can add new product
- [ ] Product form validation works
- [ ] Products appear after creation
- [ ] Farmer can view orders
- [ ] Farmer can update order status

#### Delivery Partner
- [ ] Can see available deliveries
- [ ] Can accept delivery
- [ ] Can update delivery status
- [ ] Location tracking works

#### Admin Panel
- [ ] Can view all users
- [ ] Can view orders
- [ ] Can view statistics
- [ ] Can manage platform

---

## Automated Testing Scripts

### Backend Tests
Create `server/tests/api.test.js`:

```javascript
// Example test structure for Jest/Mocha
const request = require('supertest');
const app = require('../server');

describe('Authentication API', () => {
  test('POST /api/auth/login should return token', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });
});
```

---

## Performance Testing

### Load Testing with Apache JMeter
1. Download JMeter
2. Create test plan
3. Add HTTP requests to key endpoints
4. Configure thread groups (virtual users)
5. Run tests and analyze results

### Example Metrics to Track
- Response time (avg, min, max)
- Throughput (requests/second)
- Error rate
- CPU/Memory usage

---

## Mobile Testing

### iOS Testing
- Use Safari DevTools or BrowserStack
- Test on iOS 14+
- Check voice search with Siri integration

### Android Testing
- Use Chrome DevTools
- Test on Android 9+
- Verify location permissions

---

## User Acceptance Testing (UAT)

### Test Scenarios

1. **Farmer User Story:**
   - Farmer registers
   - Farmer lists products
   - Farmer receives orders
   - Farmer confirms orders
   - Farmer receives payment

2. **Buyer User Story:**
   - Buyer searches products
   - Buyer adds to cart
   - Buyer checks out
   - Buyer tracks delivery
   - Buyer receives product

3. **Delivery Partner User Story:**
   - Partner sees delivery request
   - Partner accepts delivery
   - Partner tracks location
   - Partner completes delivery
   - Partner receives payment

---

## Bug Reporting Template

```markdown
## Bug Title
[Brief description]

## Environment
- OS: [Windows/Mac/Linux]
- Browser: [Chrome/Firefox/Safari]
- Device: [Desktop/Mobile/Tablet]

## Steps to Reproduce
1. ...
2. ...
3. ...

## Expected Result
[What should happen]

## Actual Result
[What actually happened]

## Screenshots/Logs
[Attach relevant files]

## Severity
[Critical/High/Medium/Low]
```

---

## Health Check

### Server Health Check
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-05-05T10:30:00.000Z",
  "uptime": 3600,
  "mongodb": "Connected"
}
```

---

## Testing Tools

### Recommended Tools
- **API Testing:** Postman, Insomnia, Thunder Client
- **Frontend Testing:** Cypress, Playwright, Jest
- **Load Testing:** Apache JMeter, k6
- **Monitoring:** Sentry, New Relic, DataDog
- **CI/CD:** GitHub Actions, Jenkins, GitLab CI

---

## Test Results Report

Date: 2024-05-05
Status: ✅ All Core Features Tested

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | ✅ Pass | All roles working |
| Product Management | ✅ Pass | Create, Read, Update working |
| Cart Management | ✅ Pass | Add, update, remove functional |
| Orders | ✅ Pass | Creation and status updates working |
| Payments | ✅ Pass | Stripe integration operational |
| Delivery Tracking | ✅ Pass | Real-time updates working |
| Notifications | ✅ Pass | Socket.io notifications functional |
| Voice Search | ✅ Pass | Web Speech API working |
| Location Services | ✅ Pass | Geolocation functional |
