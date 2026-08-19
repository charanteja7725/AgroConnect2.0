const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const { Payment, Order } = require("../models/Order");
const Delivery = require("../models/Delivery");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const { buildGeoPoint } = require("../utils/geoUtils");

const router = express.Router();

const isProduction = process.env.NODE_ENV === "production";

let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn(
    "⚠️ Razorpay is not fully configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
  );
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? require("stripe")(process.env.STRIPE_SECRET_KEY)
  : null;

const createDeliveryAfterPayment = async (order, buyer) => {
  // Do not create a duplicate delivery when confirmation is retried.
  const existingDelivery = await Delivery.findOne({ order: order._id });
  if (existingDelivery) return existingDelivery;

  const deliveryPartner = await User.findOne({
    role: "delivery_partner",
    isActive: true,
  }).sort({ updatedAt: 1 });

  if (!deliveryPartner) return null;

  const seller = order.items[0]?.seller
    ? await User.findById(order.items[0].seller)
    : null;

  const senderGeoPoint = buildGeoPoint(seller?.location, [0, 0]);
  const recipientGeoPoint = buildGeoPoint(order.deliveryAddress?.coordinates, [0, 0]);
  const deliveryType = order.items.some((item) => item.productType === "fertilizer")
    ? "fertilizer"
    : "product";

  const delivery = await Delivery.create({
    type: deliveryType,
    order: order._id,
    deliveryPartner: deliveryPartner._id,
    partnerName: `${deliveryPartner.firstName} ${deliveryPartner.lastName}`,
    partnerPhone: deliveryPartner.phone || "",
    sender: order.items[0]?.seller,
    senderName: order.items[0]?.sellerName || seller?.businessName || "Seller",
    senderPhone: seller?.phone || "",
    senderLocation: {
      type: "Point",
      coordinates: senderGeoPoint.coordinates,
      address: [seller?.address?.street, seller?.address?.city, seller?.address?.state]
        .filter(Boolean)
        .join(", "),
    },
    recipient: buyer._id,
    recipientName:
      order.deliveryAddress?.fullName || `${buyer.firstName || ""} ${buyer.lastName || ""}`.trim(),
    recipientPhone: order.deliveryAddress?.phone || buyer.phone || "",
    recipientEmail: buyer.email || "",
    recipientLocation: {
      type: "Point",
      coordinates: recipientGeoPoint.coordinates,
      address: [
        order.deliveryAddress?.street,
        order.deliveryAddress?.city,
        order.deliveryAddress?.state,
      ]
        .filter(Boolean)
        .join(", "),
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

  order.delivery.partnerId = deliveryPartner._id;
  order.delivery.partnerName = `${deliveryPartner.firstName} ${deliveryPartner.lastName}`;
  order.delivery.trackingId = delivery.deliveryNumber;
  order.delivery.estimatedDelivery = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

  return delivery;
};

// POST /api/payments/create-intent
router.post("/create-intent", protect, async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized for this order" });
    }

    if (order.payment?.status === "completed") {
      return res.status(409).json({ error: "This order has already been paid" });
    }

    const amountNumber = Number(order.totalAmount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({ error: "Order has an invalid payable amount" });
    }

    if (!razorpay) {
      return res.status(503).json({ error: "Razorpay is not configured on the server" });
    }

    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: Math.round(amountNumber * 100),
        currency: "INR",
        receipt: `order_${order._id}`.slice(0, 40),
        payment_capture: 1,
      });
    } catch (razorpayError) {
      console.error("Razorpay order creation failed:", razorpayError.message || razorpayError);

      // Mock checkout is a development/test convenience only. Never create a
      // mock payable order in production, even when placeholder credentials are present.
      if (isProduction) {
        return res.status(502).json({ error: "Payment provider could not create the payment order" });
      }

      razorpayOrder = {
        id: `order_mock_${crypto.randomBytes(8).toString("hex")}`,
        amount: Math.round(amountNumber * 100),
        currency: "INR",
      };
    }

    // Invalidate any older unfinished intents for the same order so a checkout
    // confirmation must refer to the newest stored provider order ID.
    await Payment.updateMany(
      { order: order._id, user: req.user._id, status: { $in: ["initiated", "processing"] } },
      { $set: { status: "failed", failureReason: "Superseded by a new payment attempt" } }
    );

    const payment = await Payment.create({
      user: req.user._id,
      order: order._id,
      amount: amountNumber,
      currency: "INR",
      method: "razorpay",
      razorpayOrderId: razorpayOrder.id,
      status: "initiated",
    });

    return res.json({
      success: true,
      paymentId: payment._id,
      razorpayOrderId: razorpayOrder.id,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      orderId: order._id,
    });
  } catch (err) {
    console.error("Payment create-intent error:", err);
    return res.status(500).json({ error: "Error creating payment order: " + err.message });
  }
});

// POST /api/payments/confirm
router.post("/confirm", protect, async (req, res) => {
  try {
    const {
      paymentId,
      orderId,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
    } = req.body;

    if (!paymentId || !orderId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({ error: "Payment confirmation details are required" });
    }

    const [payment, order] = await Promise.all([
      Payment.findById(paymentId),
      Order.findById(orderId),
    ]);

    if (!payment || !order) {
      return res.status(404).json({ error: "Payment or order not found" });
    }

    const userId = req.user._id.toString();
    if (
      payment.user.toString() !== userId ||
      order.buyer.toString() !== userId ||
      payment.order.toString() !== order._id.toString()
    ) {
      return res.status(403).json({ error: "Not authorized to confirm this payment" });
    }

    if (payment.status === "completed" && order.payment?.status === "completed") {
      return res.json({ success: true, message: "Payment already confirmed", order });
    }

    if (payment.razorpayOrderId !== razorpayOrderId) {
      return res.status(400).json({ error: "Payment order ID does not match the stored payment attempt" });
    }

    const isStoredMockOrder = payment.razorpayOrderId?.startsWith("order_mock_");
    const allowMock = !isProduction && isStoredMockOrder;

    if (isStoredMockOrder && !allowMock) {
      return res.status(400).json({ error: "Mock payments are disabled in production" });
    }

    if (!allowMock) {
      if (!process.env.RAZORPAY_KEY_SECRET) {
        return res.status(503).json({ error: "Payment verification is not configured" });
      }

      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      const expected = Buffer.from(generatedSignature, "utf8");
      const received = Buffer.from(String(razorpaySignature), "utf8");
      const signatureValid =
        expected.length === received.length && crypto.timingSafeEqual(expected, received);

      if (!signatureValid) {
        payment.status = "failed";
        payment.failureReason = "Invalid Razorpay signature";
        await payment.save();
        return res.status(400).json({ error: "Payment verification failed" });
      }
    }

    payment.status = "completed";
    payment.transactionId = razorpayPaymentId;
    payment.razorpayOrderId = razorpayOrderId;
    payment.razorpaySignature = allowMock ? "development-mock" : razorpaySignature;
    payment.paidAt = new Date();

    order.payment.status = "completed";
    order.payment.transactionId = razorpayPaymentId;
    order.payment.paidAt = new Date();
    order.status = "confirmed";

    await payment.save();
    await createDeliveryAfterPayment(order, req.user);
    await order.save();

    return res.json({
      success: true,
      message: "Payment confirmed successfully",
      order,
    });
  } catch (err) {
    console.error("Payment confirmation error:", err);
    return res.status(500).json({ error: "Error confirming payment: " + err.message });
  }
});

router.get("/:orderId", protect, async (req, res) => {
  try {
    const payment = await Payment.findOne({ order: req.params.orderId });
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    if (payment.user.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to view this payment" });
    }

    return res.json({ success: true, payment });
  } catch (err) {
    return res.status(500).json({ error: "Error fetching payment: " + err.message });
  }
});

router.post("/webhook", async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "Stripe webhook is not configured" });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).json({ error: "Stripe signature is required" });
  }

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntent.id });

      if (payment && payment.status !== "completed") {
        payment.status = "completed";
        payment.paidAt = new Date();
        await payment.save();

        const order = await Order.findById(payment.order);
        if (order) {
          order.payment.status = "completed";
          order.payment.paidAt = new Date();
          order.status = "confirmed";
          await order.save();
        }
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
});

module.exports = router;
