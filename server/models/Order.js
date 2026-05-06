const mongoose = require("mongoose");

// Cart Schema
const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        seller: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: Number,
        totalPrice: Number,
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    totalQuantity: {
      type: Number,
      default: 0,
    },
    totalPrice: {
      type: Number,
      default: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Order Schema
const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        seller: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        sellerName: String,
        productName: String,
        quantity: Number,
        price: Number,
        totalPrice: Number,
      },
    ],

    // Billing Information
    billingAddress: {
      fullName: String,
      phone: String,
      email: String,
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      landmark: String,
    },

    // Delivery Information
    deliveryAddress: {
      fullName: String,
      phone: String,
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      landmark: String,
    },

    // Pricing
    subtotal: Number,
    shippingCost: Number,
    tax: Number,
    discount: Number,
    totalAmount: {
      type: Number,
      required: true,
    },

    // Payment Information
    payment: {
      method: {
        type: String,
        enum: ["credit_card", "debit_card", "upi", "net_banking", "wallet"],
      },
      transactionId: String,
      status: {
        type: String,
        enum: ["pending", "completed", "failed", "refunded"],
        default: "pending",
      },
      paidAt: Date,
      paymentProof: String,
    },

    // Order Status
    status: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"],
      default: "pending",
    },
    statusHistory: [
      {
        status: String,
        timestamp: Date,
        note: String,
      },
    ],

    // Delivery
    delivery: {
      partnerId: mongoose.Schema.Types.ObjectId,
      partnerName: String,
      trackingId: String,
      estimatedDelivery: Date,
      actualDelivery: Date,
      location: {
        type: {
          type: String,
          enum: ["Point"],
        },
        coordinates: [Number],
      },
    },

    // Ratings
    rating: {
      score: Number,
      comment: String,
      ratedAt: Date,
    },

    // Additional
    notes: String,
    cancelReason: String,
    refundAmount: Number,
    refundReason: String,
  },
  { timestamps: true }
);

// Payment Schema
const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    method: {
      type: String,
      enum: ["stripe", "razorpay", "paypal", "wallet"],
      required: true,
    },
    status: {
      type: String,
      enum: ["initiated", "processing", "completed", "failed", "refunded"],
      default: "initiated",
    },
    transactionId: String,
    receipt: String,
    failureReason: String,
    receiptUrl: String,

    // Stripe specific
    stripePaymentIntentId: String,
    stripeChargeId: String,

    // Refund information
    refundStatus: {
      type: String,
      enum: ["none", "partial", "full"],
      default: "none",
    },
    refundAmount: Number,
    refundAt: Date,
  },
  { timestamps: true }
);

// Generate Order Number
orderSchema.pre("save", async function (next) {
  if (this.isNew && !this.orderNumber) {
    const count = await mongoose.model("Order").countDocuments();
    this.orderNumber = `ORD-${Date.now()}-${count + 1}`;
  }
  next();
});

module.exports = {
  Cart: mongoose.model("Cart", cartSchema),
  Order: mongoose.model("Order", orderSchema),
  Payment: mongoose.model("Payment", paymentSchema),
};
