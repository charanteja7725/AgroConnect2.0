process.env.NODE_ENV = 'test';
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Notification = require('../models/Notification');

let mongoServer;
let sellerToken, buyerToken, adminToken;
let testProduct, testUser, testSeller;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }

  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  await mongoose.connection.db.dropDatabase();

  // Create test users
  const seller = new User({
    firstName: 'Test',
    lastName: 'Seller',
    email: 'seller@test.com',
    password: 'test123',
    role: 'farmer',
    location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    address: 'Test Address',
    phone: '1234567890'
  });
  await seller.save();

  const buyer = new User({
    firstName: 'Test',
    lastName: 'Buyer',
    email: 'buyer@test.com',
    password: 'test123',
    role: 'buyer',
    location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    address: 'Test Address',
    phone: '0987654321'
  });
  await buyer.save();

  const admin = new User({
    firstName: 'Test',
    lastName: 'Admin',
    email: 'admin@test.com',
    password: 'test123',
    role: 'admin',
    phone: '5555555555'
  });
  await admin.save();

  // Create test product
  testProduct = new Product({
    name: 'Test Tomatoes',
    description: 'Fresh red tomatoes from test farm',
    type: 'produce',
    category: 'vegetables',
    price: 40,
    quantity: 100,
    unit: 'kg',
    seller: seller._id,
    location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    isActive: true,
    inStock: true
  });
  await testProduct.save();

  testUser = buyer;
  testSeller = seller;

  // Get tokens
  const sellerLogin = await request(app).post('/api/auth/login').send({
    email: 'seller@test.com',
    password: 'test123'
  });
  sellerToken = sellerLogin.body.token;

  const buyerLogin = await request(app).post('/api/auth/login').send({
    email: 'buyer@test.com',
    password: 'test123'
  });
  buyerToken = buyerLogin.body.token;

  const adminLogin = await request(app).post('/api/auth/login').send({
    email: 'admin@test.com',
    password: 'test123'
  });
  adminToken = adminLogin.body.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Authentication Tests', () => {
  test('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'New',
        lastName: 'User',
        email: 'new@test.com',
        password: 'test123',
        role: 'buyer',
        phone: '7777777777'
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('should login user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'buyer@test.com', password: 'test123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('should prevent email enumeration in forgot password', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('If account exists');
  });
});

describe('Product Tests', () => {
  test('should get products with pagination', async () => {
    const res = await request(app).get('/api/products?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.products).toBeDefined();
    expect(res.body.page).toBe(1);
    expect(res.body.total).toBeDefined();
  });

  test('should filter products by category', async () => {
    const res = await request(app).get('/api/products?category=vegetables');
    expect(res.status).toBe(200);
    expect(res.body.products.every(p => p.category === 'vegetables')).toBe(true);
  });

  test('should prevent self-review', async () => {
    const res = await request(app)
      .post(`/api/products/${testProduct._id}/review`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ rating: 4, comment: 'Self review' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('own product');
  });

  test('should prevent duplicate reviews', async () => {
    // First review
    await request(app)
      .post(`/api/products/${testProduct._id}/review`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ rating: 4, comment: 'Good product' });

    // Duplicate review
    const res = await request(app)
      .post(`/api/products/${testProduct._id}/review`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ rating: 5, comment: 'Another review' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already reviewed');
  });
});

describe('Cart Tests', () => {
  test('should add item to cart', async () => {
    const res = await request(app)
      .post('/api/cart/add')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ productId: testProduct._id, quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('should get cart', async () => {
    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.cart).toBeDefined();
  });

  test('should update cart item quantity', async () => {
    const cart = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${buyerToken}`);
    const itemId = cart.body.cart.items[0]._id;

    const res = await request(app)
      .put(`/api/cart/update/${itemId}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ quantity: 3 });
    expect(res.status).toBe(200);
  });
});

describe('Order Tests', () => {
  test('should create order with transaction', async () => {
    const res = await request(app)
      .post('/api/orders/create')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        deliveryAddress: {
          fullName: 'Test Buyer',
          phone: '1234567890',
          street: 'Test Street',
          city: 'Test City',
          state: 'Test State',
          zipCode: '123456',
          country: 'India'
        },
        paymentMethod: 'upi'
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('should prevent overselling with transaction rollback', async () => {
    // Add a valid cart item first
    await request(app)
      .post('/api/cart/add')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ productId: testProduct._id, quantity: 2 });

    // Simulate stock reduction before checkout
    await Product.findByIdAndUpdate(testProduct._id, { quantity: 1 });

    const res = await request(app)
      .post('/api/orders/create')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        deliveryAddress: {
          fullName: 'Test Buyer',
          phone: '1234567890',
          street: 'Test Street',
          city: 'Test City',
          state: 'Test State',
          zipCode: '123456',
          country: 'India'
        },
        paymentMethod: 'upi'
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Insufficient quantity');
  });
});

describe('Notification Tests', () => {
  test('should get notifications', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.notifications).toBeDefined();
    expect(res.body.unreadCount).toBeDefined();
  });

  test('should mark notification as read', async () => {
    // Create a notification first
    const notification = new Notification({
      user: testUser._id,
      title: 'Test Notification',
      message: 'Test message',
      type: 'system'
    });
    await notification.save();

    const res = await request(app)
      .put(`/api/notifications/${notification._id}/read`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
  });
});

describe('User Tests', () => {
  test('should allow public access to user profile', async () => {
    const res = await request(app).get(`/api/users/${testUser._id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('should allow authenticated access to user profile', async () => {
    const res = await request(app)
      .get(`/api/users/${testUser._id}`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
  });

  test('should search nearby users', async () => {
    const res = await request(app)
      .get('/api/users/search/nearby?latitude=12.9716&longitude=77.5946&maxDistance=&role=farmer');
    expect(res.status).toBe(200);
    expect(res.body.users).toBeDefined();
  });
});

describe('Payment Tests', () => {
  test('should handle webhook without secret', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .send({ type: 'payment_intent.succeeded' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not configured');
  });
});