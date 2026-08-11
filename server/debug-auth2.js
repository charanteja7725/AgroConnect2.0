const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('./server');
const request = require('supertest');
const User = require('./models/User');

(async () => {
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { useNewUrlParser: true, useUnifiedTopology: true });
  await mongoose.connection.db.dropDatabase();

  const seller = new User({ firstName: 'Test', lastName: 'Seller', email: 'seller@test.com', password: 'test123', role: 'farmer', location: { type: 'Point', coordinates: [77.5946, 12.9716] }, address: 'Test Address', phone: '1234567890' });
  const buyer = new User({ firstName: 'Test', lastName: 'Buyer', email: 'buyer@test.com', password: 'test123', role: 'buyer', location: { type: 'Point', coordinates: [77.5946, 12.9716] }, address: 'Test Address', phone: '0987654321' });
  const admin = new User({ firstName: 'Test', lastName: 'Admin', email: 'admin@test.com', password: 'test123', role: 'admin', phone: '5555555555' });
  await seller.save();
  await buyer.save();
  await admin.save();

  const loginRes = await request(app).post('/api/auth/login').send({ email: 'buyer@test.com', password: 'test123' });
  console.log('login status', loginRes.status);
  console.log('login body', loginRes.body);

  await mongoose.disconnect();
  await mongoServer.stop();
})();
