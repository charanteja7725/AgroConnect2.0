const express = require("express");
const mongoose = require("mongoose");
const { Order, Cart } = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");
const Delivery = require("../models/Delivery");
const Notification = require("../models/Notification");
const { protect, authorize } = require("../middleware/auth");
const { sendOrderConfirmation } = require("../services/mailService");
const { buildGeoPoint } = require("../utils/geoUtils");

const router = express.Router();

// Helper function to create and emit notification
const sendNotification = async (userId, title, message, type, relatedId, actionUrl, io) => {
  try {
    const notification = new Notification({
      user: userId,
      title,
      message,
      type,
      relatedId,
      actionUrl,
    });
    await notification.save();

    if (io) {
      io.to(`user_${userId}`).emit("notification", {
        id: notification._id,
        title,
        message,
        type,
        timestamp: new Date(),
        read: false,
      });
    }
  } catch (err) {
    console.error("Error sending notification:", err);
  }
};

// Automatic delivery creation helper
const createDeliveryForOrder = async (order) => {
  try {
    const itemsBySeller = {};
    for (const item of order.items) {
      const sellerId = item.seller.toString();
      if (!itemsBySeller[sellerId]) {
        itemsBySeller[sellerId] = [];
      }
      itemsBySeller[sellerId].push(item);
    }

    const buyer = await User.findById(order.buyer);
    if (!buyer) {
      console.error(`Buyer ${order.buyer} not found for delivery creation`);
      return;
    }

    for (const sellerId of Object.keys(itemsBySeller)) {
      const seller = await User.findById(sellerId);
      if (!seller) {
        console.error(`Seller ${sellerId} not found for delivery creation`);
        continue;
      }

      const sellerItems = itemsBySeller[sellerId];
      const deliveryItems = sellerItems.map((item) => ({
        product: item.product,
        name: item.productName,
        quantity: item.quantity,
        weight: item.quantity,
      }));

      const recipientName = order.deliveryAddress?.fullName || `${buyer.firstName} ${buyer.lastName}`;
      const recipientPhone = order.deliveryAddress?.phone || buyer.phone;
      const recipientEmail = buyer.email;

      const hasFertilizer = sellerItems.some((item) => item.productType === "fertilizer");
      const deliveryType = hasFertilizer ? "fertilizer" : "product";

      const deliveryCoords =
        order.deliveryAddress?.coordinates?.coordinates &&
        order.deliveryAddress.coordinates.coordinates.length === 2
          ? order.deliveryAddress.coordinates.coordinates
          : buyer.location?.coordinates && buyer.location.coordinates.length === 2
          ? buyer.location.coordinates
          : [0, 0];

      const senderCoords =
        seller.location?.coordinates && seller.location.coordinates.length === 2
          ? seller.location.coordinates
          : [0, 0];

      const delivery = new Delivery({
        type: deliveryType,
        order: order._id,
        sender: seller._id,
        senderName: seller.businessName || `${seller.firstName} ${seller.lastName}`,
        senderPhone: seller.phone,
        senderLocation: {
          type: "Point",
          coordinates: senderCoords,
          address: seller.address
            ? `${seller.address.street || ""}, ${seller.address.city || ""}`.trim()
            : "Seller Address",
        },
        recipient: buyer._id,
        recipientName,
        recipientPhone,
        recipientEmail,
        recipientLocation: {
          type: "Point",
          coordinates: deliveryCoords,
          address: order.deliveryAddress
            ? `${order.deliveryAddress.street || ""}, ${order.deliveryAddress.city || ""}`.trim()
            : "Recipient Address",
        },
        items: deliveryItems,
        status: "assigned",
      });

      await delivery.save();
    }
  } catch (err) {
    console.error("Error creating delivery automatically:", err);
  }
};

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
// @desc    Create order from cart without replica set transactions for local development
// @access  Private (Buyer)
router.post("/create", protect, authorize("buyer"), async (req, res) => {
  try {
    const { billingAddress, deliveryAddress, paymentMethod } = req.body;

    if (!deliveryAddress) {
      return res.status(400).json({ error: "Delivery address is required" });
    }

    const sanitizeAddress = (address) => {
      if (!address) return address;
      if (typeof address === "string") {
        return { street: address };
      }
      const sanitized = { ...address };
      if (address.coordinates) {
        const coordinates = buildGeoPoint(address.coordinates);
        if (!coordinates) {
          return null;
        }
        sanitized.coordinates = coordinates;
      }
      return sanitized;
    };

    const sanitizedDeliveryAddress = sanitizeAddress(deliveryAddress);
    if (!sanitizedDeliveryAddress) {
      return res.status(400).json({ error: "Invalid delivery address coordinates" });
    }

    const sanitizedBillingAddress = billingAddress ? sanitizeAddress(billingAddress) : sanitizedDeliveryAddress;
    if (billingAddress && !sanitizedBillingAddress) {
      return res.status(400).json({ error: "Invalid billing address coordinates" });
    }

    const paymentMethodValue = paymentMethod || "cash_on_delivery";
    const validPaymentMethods = ["credit_card", "debit_card", "upi", "net_banking", "wallet", "cash_on_delivery"];
    if (!validPaymentMethods.includes(paymentMethodValue)) {
      return res.status(400).json({ error: "Invalid payment method" });
    }

    const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Validate inventory before making updates.
    const orderItems = [];
    for (const item of cart.items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(400).json({ error: `Product ${item.product} not found` });
      }
      if (product.quantity < item.quantity) {
        return res.status(400).json({ error: `Insufficient quantity for ${product.name}` });
      }

      orderItems.push({
        product: product._id,
        seller: product.seller,
        sellerName: product.sellerName,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        totalPrice: item.totalPrice,
        productType: product.type || "produce",
      });
    }

    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: -item.quantity, totalSold: item.quantity },
      }, { new: true, runValidators: true });

      await User.findByIdAndUpdate(item.product.seller || item.seller, {
        $inc: { totalEarnings: item.totalPrice, totalOrders: 1 },
      });
    }

    const order = new Order({
      buyer: req.user._id,
      items: orderItems,
      billingAddress: sanitizedBillingAddress || sanitizedDeliveryAddress,
      deliveryAddress: sanitizedDeliveryAddress,
      subtotal: cart.totalPrice,
      shippingCost: 0,
      tax: Math.round(cart.totalPrice * 0.05),
      totalAmount: Math.round(cart.totalPrice * 1.05),
      payment: {
        method: paymentMethodValue,
        status: "pending",
      },
    });

    await order.save();

    // Send order confirmation email
    try {
      await sendOrderConfirmation(order, req.user);
    } catch (emailError) {
      console.error('Order confirmation email failed:', emailError);
      // Don't fail order if email fails
    }

    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalOrders: 1 },
    });

    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { items: [], totalQuantity: 0, totalPrice: 0 }
    );

    const io = req.app.get("io");
    for (const item of orderItems) {
      await sendNotification(
        item.seller,
        "New Order Received",
        `New order from ${req.user.firstName} ${req.user.lastName}`,
        "order",
        order._id,
        `/orders/${order._id}`,
        io
      );
      if (io) {
        io.to(`user_${item.seller}`).emit("new_order", {
          orderId: order._id,
          message: `New order from ${req.user.firstName}`,
          timestamp: new Date(),
        });
      }
    }

    await sendNotification(
      req.user._id,
      "Order Placed Successfully",
      `Your order #${order._id} has been placed`,
      "order",
      order._id,
      `/orders/${order._id}`,
      io
    );

    res.status(201).json({
      success: true,
      order,
      message: "Order created successfully",
    });
  } catch (err) {
    console.error("Order creation error:", err);
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

    if (status === "confirmed") {
      await createDeliveryForOrder(order);
    }

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
