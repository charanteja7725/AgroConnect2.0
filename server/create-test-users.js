const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function createTestUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agroconnect', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Create admin user
    const adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      password: 'test123',
      phone: '1111111111',
      role: 'admin',
      isActive: true,
      location: { type: 'Point', coordinates: [0, 0] }
    });

    console.log('Created admin user:', adminUser.email);

    // Create buyer user
    const buyerUser = await User.create({
      firstName: 'John',
      lastName: 'Buyer',
      email: 'buyer@test.com',
      password: 'test123',
      phone: '1234567890',
      role: 'buyer',
      isActive: true,
      location: { type: 'Point', coordinates: [0, 0] }
    });

    console.log('Created buyer user:', buyerUser.email);

  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

createTestUsers();