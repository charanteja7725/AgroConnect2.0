const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Product = require("../models/Product");

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/agroconnect";

async function createIndexes() {
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("🔧 Connected to MongoDB, creating product indexes...");
    await Product.createIndexes();
    console.log("✅ Product indexes created successfully");
  } catch (error) {
    console.error("❌ Failed to create indexes:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

createIndexes();
