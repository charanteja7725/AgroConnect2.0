process.env.NODE_ENV = 'test';
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../server');
const User = require('../models/User');

let mongoServer;
let farmerToken;

describe('Farmer verification gating', () => {
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

    const farmer = new User({
      firstName: 'Test',
      lastName: 'Farmer',
      email: 'farmer-verification@test.com',
      password: 'test123',
      phone: '1111111111',
      role: 'farmer',
      address: { city: 'Test City' },
    });
    await farmer.save();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'farmer-verification@test.com', password: 'test123' });

    farmerToken = loginRes.body.token;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  test('should block product creation for unverified farmers', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        name: 'Tomatoes',
        description: 'Fresh tomatoes',
        type: 'produce',
        category: 'vegetables',
        price: 30,
        quantity: 10,
        unit: 'kg',
        address: 'Farm address',
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/approve|verified/i);
  });
});
