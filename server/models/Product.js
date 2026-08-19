const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide product name"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Please provide product description"],
      trim: true,
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
        "other",
      ],
      required: true,
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sellerName: String,

    price: {
      type: Number,
      required: [true, "Please provide product price"],
      min: 0,
    },
    originalPrice: Number,
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

    images: [
      {
        url: String,
        publicId: String,
      },
    ],
    mainImage: String,

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (value) =>
            Array.isArray(value) &&
            value.length === 2 &&
            value.every((coordinate) => Number.isFinite(Number(coordinate))),
          message: "Product location must contain longitude and latitude",
        },
      },
    },
    address: String,

    harvestDate: Date,
    organicCertified: Boolean,
    pesticidesUsed: String,

    composition: {
      nitrogen: Number,
      phosphorus: Number,
      potassium: Number,
    },
    validUntil: Date,
    dosagePerAcre: String,

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

    inStock: {
      type: Boolean,
      default: true,
    },
    stockStatus: {
      type: String,
      enum: ["in_stock", "low_stock", "out_of_stock"],
      default: "in_stock",
    },

    aiSuggestedPrice: Number,
    aiSuggestionDate: Date,
    marketTrend: {
      type: String,
      enum: ["increasing", "stable", "decreasing"],
      default: "stable",
    },

    totalSold: {
      type: Number,
      default: 0,
    },
    totalViews: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: true,
    },
    verificationNote: String,

    tags: [String],
    metadata: {
      shelfLife: String,
      storageConditions: String,
      packaging: String,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ location: "2dsphere" });
productSchema.index({ name: "text", description: "text" });
productSchema.index({ seller: 1, category: 1, isActive: 1 });
productSchema.index({ price: 1, rating: 1 });

productSchema.virtual("available").get(function () {
  return this.quantity > 0 && this.isActive;
});

module.exports = mongoose.model("Product", productSchema);
