const express = require("express");
const { Order, Cart } = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/orders
// @desc    Get orders (user's or all for admin)
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    let query = {};

    if (req.user.role === "buyer") {
      query.buyer = req.user._id;
    } else if (req.user.role === "farmer" || req.user.role === "fertilizer_seller") {
      query["items.seller"] = req.user._id;
    }

    const orders = await Order.find(query)
      .populate("buyer")
      .populate("items.product")
      .populate("items.seller")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching orders: " + err.message });
  }
});

// @route   GET /api/orders/:id
// @desc    Get single order
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("buyer")
      .populate("items.product")
      .populate("items.seller")
      .populate("delivery.partnerId");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check authorization
    if (
      order.buyer._id.toString() !== req.user._id.toString() &&
      !order.items.some((item) => item.seller._id.toString() === req.user._id.toString()) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: "Not authorized to view this order" });
    }

    res.json({
      success: true,
      order,
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching order: " + err.message });
  }
});

// @route   POST /api/orders/create
// @desc    Create order from cart
// @access  Private (Buyer)
router.post("/create", protect, authorize("buyer"), async (req, res) => {
  try {
    const { billingAddress, deliveryAddress, paymentMethod } = req.body;

    if (!deliveryAddress) {
      return res.status(400).json({ error: "Delivery address is required" });
    }

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Prepare order items
    const orderItems = [];
    for (let item of cart.items) {
      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(400).json({ error: `Product ${item.product} not found` });
      }

      if (product.quantity < item.quantity) {
        return res.status(400).json({
          error: `Insufficient quantity for ${product.name}`,
        });
      }

      orderItems.push({
        product: product._id,
        seller: product.seller,
        sellerName: product.sellerName,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        totalPrice: item.totalPrice,
      });

      // Reduce product quantity
      product.quantity -= item.quantity;
      product.totalSold += item.quantity;
      await product.save();

      // Increase seller's earnings
      await User.findByIdAndUpdate(product.seller, {
        $inc: { totalEarnings: item.totalPrice, totalOrders: 1 },
      });
    }

    // Create order
    const order = new Order({
      buyer: req.user._id,
      items: orderItems,
      billingAddress: billingAddress || deliveryAddress,
      deliveryAddress,
      subtotal: cart.totalPrice,
      shippingCost: 0, // Can be calculated based on distance
      tax: Math.round(cart.totalPrice * 0.05), // 5% tax
      totalAmount: Math.round(cart.totalPrice * 1.05),
      payment: {
        method: paymentMethod || "pending",
        status: "pending",
      },
    });

    await order.save();

    // Clear cart
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [], totalQuantity: 0, totalPrice: 0 });

    // Emit real-time notification
    const io = req.app.get("io");
    for (let item of orderItems) {
      io.to(`user_${item.seller}`).emit("new_order", {
        orderId: order._id,
        message: `New order from ${req.user.firstName}`,
        timestamp: new Date(),
      });
    }

    res.status(201).json({
      success: true,
      order,
      message: "Order created successfully",
    });
  } catch (err) {
    res.status(500).json({ error: "Error creating order: " + err.message });
  }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order status
// @access  Private (Seller/Delivery Partner/Admin)
router.put("/:id/status", protect, async (req, res) => {
  try {
    const { status, note } = req.body;

    const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check authorization
    const isAuthorized =
      order.items.some((item) => item.seller.toString() === req.user._id.toString()) ||
      req.user.role === "admin" ||
      (order.delivery.partnerId && order.delivery.partnerId.toString() === req.user._id.toString());

    if (!isAuthorized) {
      return res.status(403).json({ error: "Not authorized to update this order" });
    }

    order.status = status;
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      note,
    });

    await order.save();

    // Emit real-time notification
    const io = req.app.get("io");
    io.to(`user_${order.buyer}`).emit("order_status_update", {
      orderId: order._id,
      status,
      message: `Your order status has been updated to ${status}`,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      order,
      message: `Order status updated to ${status}`,
    });
  } catch (err) {
    res.status(500).json({ error: "Error updating order: " + err.message });
  }
});

// @route   POST /api/orders/:id/cancel
// @desc    Cancel order
// @access  Private (Buyer)
router.post("/:id/cancel", protect, authorize("buyer"), async (req, res) => {
  try {
    const { cancelReason } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to cancel this order" });
    }

    if (["delivered", "cancelled"].includes(order.status)) {
      return res.status(400).json({ error: `Cannot cancel order with status: ${order.status}` });
    }

    order.status = "cancelled";
    order.cancelReason = cancelReason;
    order.statusHistory.push({
      status: "cancelled",
      timestamp: new Date(),
      note: cancelReason,
    });

    await order.save();

    res.json({
      success: true,
      order,
      message: "Order cancelled successfully",
    });
  } catch (err) {
    res.status(500).json({ error: "Error cancelling order: " + err.message });
  }
});

module.exports = router;
