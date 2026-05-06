const mongoose = require("mongoose");

const deliverySchema = new mongoose.Schema(
  {
    deliveryNumber: {
      type: String,
      unique: true,
    },
    deliveryPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    partnerName: String,
    partnerPhone: String,
    partnerLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: [Number],
    },

    // Delivery Type
    type: {
      type: String,
      enum: ["product", "fertilizer"],
      required: true,
    },

    // Order/Shipment Information
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    items: [
      {
        product: mongoose.Schema.Types.ObjectId,
        name: String,
        quantity: Number,
        weight: Number,
      },
    ],

    // Sender Information
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    senderName: String,
    senderPhone: String,
    senderLocation: {
      address: String,
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: [Number],
      },
    },

    // Recipient Information
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    recipientName: String,
    recipientPhone: String,
    recipientEmail: String,
    recipientLocation: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      address: String,
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: [Number],
      },
    },

    // Delivery Details
    pickupTime: Date,
    estimatedDeliveryTime: Date,
    actualDeliveryTime: Date,
    deliveryDuration: Number, // in minutes

    // Distance & Route
    totalDistance: Number, // in km
    route: [
      {
        latitude: Number,
        longitude: Number,
        timestamp: Date,
      },
    ],

    // Status
    status: {
      type: String,
      enum: [
        "assigned",
        "accepted",
        "picked_up",
        "in_transit",
        "near_delivery",
        "delivered",
        "cancelled",
        "failed",
      ],
      default: "assigned",
    },
    statusHistory: [
      {
        status: String,
        timestamp: Date,
        location: {
          latitude: Number,
          longitude: Number,
        },
        note: String,
      },
    ],

    // Delivery Proof
    proof: {
      signature: String, // Image URL
      photo: String, // Image URL
      otp: String,
      verifiedAt: Date,
    },

    // Ratings and Reviews
    rating: {
      score: Number,
      comment: String,
      ratedAt: Date,
    },

    // Charges
    deliveryCharge: Number,
    tips: Number,
    totalEarnings: Number,

    // Issues
    issueReported: Boolean,
    issueType: {
      type: String,
      enum: ["delayed", "damaged", "lost", "other"],
    },
    issueDescription: String,
    issueResolution: String,

    // Additional
    notes: String,
    cancelReason: String,
  },
  {
    timestamps: true,
    index: { partnerLocation: "2dsphere" },
  }
);

// Generate Delivery Number
deliverySchema.pre("save", async function (next) {
  if (this.isNew && !this.deliveryNumber) {
    const count = await mongoose.model("Delivery").countDocuments();
    this.deliveryNumber = `DEL-${Date.now()}-${count + 1}`;
  }
  next();
});

module.exports = mongoose.model("Delivery", deliverySchema);
