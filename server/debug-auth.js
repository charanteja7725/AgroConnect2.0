const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('./models/User');
const { app } = require('./server');
const request = require('supertest');

(async () => {
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { useNewUrlParser: true, useUnifiedTopology: true });
  const user = new User({ firstName:'Test', lastName:'Buyer', email:'buyer@test.com', password:'test123', phone:'0987654321', role:'buyer' });
  await user.save();
  const stored = await User.findOne({ email:'buyer@test.com' }).select('+password');
  console.log('stored password:', stored.password);
  console.log('compare', await stored.comparePassword('test123'));
  const res = await request(app).post('/api/auth/login').send({ email:'buyer@test.com', password:'test123' });
  console.log('login status', res.status);
  console.log('login body', res.body);
  await mongoose.disconnect();
  await mongoServer.stop();
})();
