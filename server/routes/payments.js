const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Payment, Order } = require("../models/Order");
const { protect } = require("../middleware/auth");

const router = express.Router();

// @route   POST /api/payments/create-intent
// @desc    Create Stripe payment intent
// @access  Private
router.post("/create-intent", protect, async (req, res) => {
  try {
    const { orderId, amount } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({ error: "Order ID and amount are required" });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized for this order" });
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "inr",
      metadata: {
        orderId: orderId,
        userId: req.user._id.toString(),
      },
    });

    // Create payment record
    const payment = new Payment({
      user: req.user._id,
      order: orderId,
      amount,
      currency: "INR",
      method: "stripe",
      stripePaymentIntentId: paymentIntent.id,
      status: "initiated",
    });

    await payment.save();

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentId: payment._id,
    });
  } catch (err) {
    res.status(500).json({ error: "Error creating payment intent: " + err.message });
  }
});

// @route   POST /api/payments/confirm
// @desc    Confirm payment after Stripe processing
// @access  Private
router.post("/confirm", protect, async (req, res) => {
  try {
    const { paymentId, orderId } = req.body;

    if (!paymentId || !orderId) {
      return res.status(400).json({ error: "Payment ID and Order ID are required" });
    }

    const payment = await Payment.findById(paymentId);
    const order = await Order.findById(orderId);

    if (!payment || !order) {
      return res.status(404).json({ error: "Payment or Order not found" });
    }

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);

    if (paymentIntent.status === "succeeded") {
      payment.status = "completed";
      payment.transactionId = paymentIntent.id;
      payment.paidAt = new Date();

      order.payment.status = "completed";
      order.payment.transactionId = paymentIntent.id;
      order.payment.paidAt = new Date();
      order.status = "confirmed";

      await payment.save();
      await order.save();

      res.json({
        success: true,
        message: "Payment confirmed successfully",
        order,
      });
    } else {
      payment.status = "failed";
      payment.failureReason = paymentIntent.last_payment_error?.message || "Payment failed";
      await payment.save();

      res.status(400).json({
        error: "Payment was not successful",
        status: paymentIntent.status,
      });
    }
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
  const sig = req.headers["stripe-signature"];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;

      // Update payment and order
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
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
});

module.exports = router;
