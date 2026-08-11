const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["order", "delivery", "payment", "review", "system", "message"],
      default: "system",
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: function() {
        if (this.type === "order") return "Order";
        if (this.type === "delivery") return "Delivery";
        if (this.type === "payment") return "Payment";
        return undefined;
      },
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    actionUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Index for efficient querying
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
