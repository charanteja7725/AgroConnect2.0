const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const { Payment, Order } = require("../models/Order");
const Delivery = require("../models/Delivery");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const { buildGeoPoint } = require("../utils/geoUtils");

const router = express.Router();

let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn("⚠️ Razorpay is not fully configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the server .env file.");
}

const stripe = process.env.STRIPE_SECRET_KEY ? require("stripe")(process.env.STRIPE_SECRET_KEY) : null;

// @route   POST /api/payments/create-intent
// @desc    Create Razorpay order and payment record
// @access  Private
router.post("/create-intent", protect, async (req, res) => {
  try {
    const { orderId, amount } = req.body;

    if (!orderId || amount == null) {
      return res.status(400).json({ error: "Order ID and amount are required" });
    }

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({ error: "Invalid amount for Razorpay order" });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized for this order" });
    }

    if (!razorpay) {
      return res.status(500).json({ error: "Razorpay is not configured on the server" });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amountNumber * 100),
      currency: "INR",
      receipt: `order_rcptid_${orderId}`,
      payment_capture: 1,
    });

    const payment = new Payment({
      user: req.user._id,
      order: orderId,
      amount,
      currency: "INR",
      method: "razorpay",
      razorpayOrderId: razorpayOrder.id,
      status: "initiated",
    });

    await payment.save();

    res.json({
      success: true,
      paymentId: payment._id,
      razorpayOrderId: razorpayOrder.id,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      orderId: orderId,
    });
  } catch (err) {
    const errorMessage = err?.message || err?.error || JSON.stringify(err) || "Unknown error";
    console.error("Payment create-intent error:", err);
    res.status(500).json({ error: "Error creating Razorpay order: " + errorMessage });
  }
});

// @route   POST /api/payments/confirm
// @desc    Confirm payment after Razorpay processing
// @access  Private
router.post("/confirm", protect, async (req, res) => {
  try {
    const { paymentId, orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    if (!paymentId || !orderId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({ error: "Payment confirmation details are required" });
    }

    const payment = await Payment.findById(paymentId);
    const order = await Order.findById(orderId);

    if (!payment || !order) {
      return res.status(404).json({ error: "Payment or Order not found" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (generatedSignature !== razorpaySignature) {
      payment.status = "failed";
      payment.failureReason = "Invalid Razorpay signature";
      await payment.save();
      return res.status(400).json({ error: "Payment verification failed" });
    }

    payment.status = "completed";
    payment.transactionId = razorpayPaymentId;
    payment.razorpayOrderId = razorpayOrderId;
    payment.razorpaySignature = razorpaySignature;
    payment.paidAt = new Date();

    order.payment.status = "completed";
    order.payment.transactionId = razorpayPaymentId;
    order.payment.paidAt = new Date();
    order.status = "confirmed";

    await payment.save();

    const deliveryPartner = await User.findOne({ role: "delivery_partner", isActive: true }).sort({ updatedAt: 1 });
    const seller = order.items[0]?.seller ? await User.findById(order.items[0].seller) : null;
    const senderGeoPoint = buildGeoPoint(seller?.location, [0, 0]);
    const recipientGeoPoint = buildGeoPoint(order.deliveryAddress?.coordinates, [0, 0]);

    if (deliveryPartner) {
      const deliveryType = order.items.some((item) => item.productType === "fertilizer") ? "fertilizer" : "product";
      const delivery = new Delivery({
        type: deliveryType,
        order: order._id,
        sender: order.items[0]?.seller,
        senderName: order.items[0]?.sellerName,
        senderPhone: order.items[0]?.sellerPhone || "",
        senderLocation: {
          type: "Point",
          coordinates: senderGeoPoint.coordinates,
          address: `${seller?.address?.street || ""} ${seller?.address?.city || ""} ${seller?.address?.state || ""}`.trim(),
        },
        recipient: req.user._id,
        recipientName: `${req.user.firstName} ${req.user.lastName}`,
        recipientPhone: order.deliveryAddress?.phone || req.user.phone || "",
        recipientEmail: req.user.email || "",
        recipientLocation: {
          type: "Point",
          coordinates: recipientGeoPoint.coordinates,
          address: `${order.deliveryAddress?.street || ""} ${order.deliveryAddress?.city || ""} ${order.deliveryAddress?.state || ""}`.trim(),
        },
        items: order.items.map((item) => ({
          product: item.product,
          name: item.productName,
          quantity: item.quantity,
        })),
        status: "assigned",
        deliveryCharge: Math.max(40, Math.round(order.totalAmount * 0.05)),
        totalEarnings: Math.max(40, Math.round(order.totalAmount * 0.05)),
      });

      console.info("Creating delivery with recipient coordinates", recipientGeoPoint, "sender coordinates", senderGeoPoint);
      await delivery.save();

      order.delivery.partnerId = deliveryPartner._id;
      order.delivery.partnerName = `${deliveryPartner.firstName} ${deliveryPartner.lastName}`;
      order.delivery.trackingId = delivery.deliveryNumber;
      order.delivery.estimatedDelivery = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      await order.save();
    } else {
      await order.save();
    }

    res.json({
      success: true,
      message: "Payment confirmed successfully",
      order,
    });
  } catch (err) {
    res.status(500).json({ error: "Error confirming payment: " + err.message });
  }
});

// @route   GET /api/payments/:orderId
// @desc    Get payment details for an order
// @access  Private
router.get("/:orderId", protect, async (req, res) => {
  try {
    const payment = await Payment.findOne({ order: req.params.orderId });

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    if (payment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to view this payment" });
    }

    res.json({
      success: true,
      payment,
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching payment: " + err.message });
  }
});

// @route   POST /api/payments/webhook
// @desc    Stripe webhook for payment confirmations
// @access  Public
router.post("/webhook", async (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("❌ STRIPE_WEBHOOK_SECRET not configured");
    return res.status(400).json({ error: "Stripe webhook not configured" });
  }

  const sig = req.headers["stripe-signature"];

  if (!process.env.STRIPE_WEBHOOK_SECRET || !sig) {
    return res.status(400).json({ error: "Stripe webhook endpoint not configured" });
  }

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const payment = await Payment.findOne({
        stripePaymentIntentId: paymentIntent.id,
      });

      if (payment) {
        payment.status = "completed";
        payment.paidAt = new Date();
        await payment.save();

        const order = await Order.findById(payment.order);
        if (order) {
          order.payment.status = "completed";
          order.status = "confirmed";
          await order.save();
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
});

module.exports = router;
