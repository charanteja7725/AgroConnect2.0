const mongoose = require('mongoose');
require('dotenv').config();

async function createDeliveryIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agroconnect', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Create geospatial indexes for Delivery collection
    const db = mongoose.connection.db;
    const collection = db.collection('deliveries');

    // Create 2dsphere indexes for location fields
    await collection.createIndex({ "senderLocation": "2dsphere" });
    console.log('Created 2dsphere index on senderLocation');

    await collection.createIndex({ "recipientLocation": "2dsphere" });
    console.log('Created 2dsphere index on recipientLocation');

    await collection.createIndex({ "partnerLocation": "2dsphere" });
    console.log('Created 2dsphere index on partnerLocation');

    // Create compound index for efficient queries
    await collection.createIndex({ "status": 1, "partnerId": 1 });
    console.log('Created compound index on status and partnerId');

    console.log('All delivery indexes created successfully');

  } catch (error) {
    console.error('Error creating indexes:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

createDeliveryIndexes();