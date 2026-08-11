const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: [true, "Please provide product name"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Please provide product description"],
    },
    type: {
      type: String,
      enum: ["produce", "fertilizer", "other"],
      required: true,
    },
    category: {
      type: String,
      enum: [
        "vegetables",
        "fruits",
        "grains",
        "npk",
        "organic",
        "pesticide",
        "seeds",
        "equipment",
      ],
      required: true,
    },

    // Seller/Farmer Information
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sellerName: String,

    // Pricing and Inventory
    price: {
      type: Number,
      required: [true, "Please provide product price"],
      min: 0,
    },
    originalPrice: Number, // For tracking AI-suggested price
    quantity: {
      type: Number,
      required: [true, "Please provide product quantity"],
      min: 0,
    },
    unit: {
      type: String,
      enum: ["kg", "liter", "bag", "piece", "box"],
      default: "kg",
    },

    // Images
    images: [
      {
        url: String,
        publicId: String, // For Cloudinary
      },
    ],
    mainImage: String,

    // Location
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required:true // [longitude, latitude]
      },
    },
    address: String,

    // Product Details (for produce)
    harvestDate: Date,
    organicCertified: Boolean,
    pesticidesUsed: String,

    // Product Details (for fertilizers)
    composition: {
      nitrogen: Number,
      phosphorus: Number,
      potassium: Number,
    },
    validUntil: Date,
    dosagePerAcre: String,

    // Ratings and Reviews
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    reviews: [
      {
        reviewer: mongoose.Schema.Types.ObjectId,
        rating: Number,
        comment: String,
        verified: Boolean,
        createdAt: Date,
      },
    ],

    // Stock Status
    inStock: {
      type: Boolean,
      default: true,
    },
    stockStatus: {
      type: String,
      enum: ["in_stock", "low_stock", "out_of_stock"],
      default: "in_stock",
    },

    // AI Pricing Info
    aiSuggestedPrice: Number,
    aiSuggestionDate: Date,
    marketTrend: {
      type: String,
      enum: ["increasing", "stable", "decreasing"],
      default: "stable",
    },

    // Statistics
    totalSold: {
      type: Number,
      default: 0,
    },
    totalViews: {
      type: Number,
      default: 0,
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: true,
    },
    verificationNote: String,

    // Additional Info
    tags: [String],
    metadata: {
      shelfLife: String,
      storageConditions: String,
      packaging: String,
    },
  },
  {
    timestamps: true,
    index: { location: "2dsphere", name: "text" }, // For geospatial and text search
  }
);

// Index for filtering and searching
productSchema.index({ location: "2dsphere" });
productSchema.index({ seller: 1, category: 1, isActive: 1 });
productSchema.index({ price: 1, rating: 1 });

// Virtual for availability
productSchema.virtual("available").get(function () {
  return this.quantity > 0 && this.isActive;
});

module.exports = mongoose.model("Product", productSchema);
