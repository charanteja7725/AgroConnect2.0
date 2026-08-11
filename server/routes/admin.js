const express = require("express");
const User = require("../models/User");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Delivery = require("../models/Delivery");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/admin/stats
// @desc    Get platform statistics
// @access  Private/Admin
router.get("/stats", protect, authorize("admin"), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $ifNull: ["$totalAmount", "$totalPrice"]
            }
          }
        }
      }
    ]);
    const activeFarmers = await User.countDocuments({ role: "farmer", isActive: true });

    const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalOrders,
        revenue,
        activeFarmers
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching stats: " + err.message });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination
// @access  Private/Admin
router.get("/users", protect, authorize("admin"), async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;

    let query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * pageSize;

    const users = await User.find(query)
      .select("-password -resetPasswordToken -resetPasswordExpire")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users: users.map(u => u.getProfile()),
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / pageSize),
        total
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching users: " + err.message });
  }
});

// @route   GET /api/admin/orders
// @desc    Get all orders with pagination
// @access  Private/Admin
router.get("/orders", protect, authorize("admin"), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    let query = {};
    if (status) query.status = status;
    if (search) {
      // Search by order ID or buyer name
      query.$or = [
        { _id: search },
        { "buyer.firstName": { $regex: search, $options: "i" } },
        { "buyer.lastName": { $regex: search, $options: "i" } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * pageSize;

    const orders = await Order.find(query)
      .populate("buyer")
      .populate("items.product")
      .populate("items.seller")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / pageSize),
        total
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching orders: " + err.message });
  }
});

// @route   GET /api/admin/products
// @desc    Get all products with pagination
// @access  Private/Admin
router.get("/products", protect, authorize("admin"), async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;

    let query = {};
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * pageSize;

    const products = await Product.find(query)
      .populate("seller")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      products,
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / pageSize),
        total
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching products: " + err.message });
  }
});

// @route   GET /api/admin/deliveries
// @desc    Get all deliveries with pagination
// @access  Private/Admin
router.get("/deliveries", protect, authorize("admin"), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    let query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { deliveryNumber: { $regex: search, $options: "i" } },
        { recipientName: { $regex: search, $options: "i" } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * pageSize;

    const deliveries = await Delivery.find(query)
      .populate("deliveryPartner")
      .populate("order")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    const total = await Delivery.countDocuments(query);

    res.json({
      success: true,
      deliveries,
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / pageSize),
        total
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching deliveries: " + err.message });
  }
});

// @route   PUT /api/admin/users/:id/status
// @desc    Update user status (activate/deactivate)
// @access  Private/Admin
router.put("/users/:id/status", protect, authorize("admin"), async (req, res) => {
  try {
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      user: user.getProfile(),
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (err) {
    res.status(500).json({ error: "Error updating user status: " + err.message });
  }
});

// @route   GET /api/admin/verifications
// @desc    Get pending farmer verification requests
// @access  Private/Admin
router.get("/verifications", protect, authorize("admin"), async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ["farmer", "fertilizer_seller"] } })
      .select("-password -resetPasswordToken -resetPasswordExpire")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      verifications: users.map((user) => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        verification: user.role === "farmer" ? user.farmerVerification : user.sellerVerification,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching verifications: " + err.message });
  }
});

// @route   PUT /api/admin/verifications/:id
// @desc    Review farmer verification request
// @access  Private/Admin
router.put("/verifications/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    const user = await User.findById(req.params.id);

    if (!user || !["farmer", "fertilizer_seller"].includes(user.role)) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update verification subdocuments carefully to avoid casting undefined nested fields
    if (user.role === "farmer") {
      user.farmerVerification = user.farmerVerification || {};
      user.farmerVerification.status = status;
      if (typeof reviewNotes !== "undefined") user.farmerVerification.reviewNotes = reviewNotes || user.farmerVerification?.reviewNotes;
      user.farmerVerification.verifiedAt = status === "verified" ? new Date() : user.farmerVerification?.verifiedAt;
      user.farmerVerification.verifiedBy = status === "verified" ? req.user._id : user.farmerVerification?.verifiedBy;
    } else {
      user.sellerVerification = user.sellerVerification || {};
      user.sellerVerification.status = status;
      if (typeof reviewNotes !== "undefined") user.sellerVerification.reviewNotes = reviewNotes || user.sellerVerification?.reviewNotes;
      user.sellerVerification.verifiedAt = status === "verified" ? new Date() : user.sellerVerification?.verifiedAt;
      user.sellerVerification.verifiedBy = status === "verified" ? req.user._id : user.sellerVerification?.verifiedBy;
    }

    await user.save();

    res.json({ success: true, user: user.getProfile(), message: "Verification updated" });
  } catch (err) {
    res.status(500).json({ error: "Error updating verification: " + err.message });
  }
});

// @route   PUT /api/admin/orders/:id/status
// @desc    Update order status
// @access  Private/Admin
router.put("/orders/:id/status", protect, authorize("admin"), async (req, res) => {
  try {
    const { status, note } = req.body;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("buyer");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Create notification for buyer
    const Notification = require("../models/Notification");
    await Notification.create({
      user: order.buyer._id,
      title: "Order Status Updated",
      message: `Your order #${order._id} status has been updated to ${status}`,
      type: "order",
      relatedId: order._id
    });

    res.json({
      success: true,
      order,
      message: "Order status updated successfully"
    });
  } catch (err) {
    res.status(500).json({ error: "Error updating order status: " + err.message });
  }
});

// @route   DELETE /api/admin/products/:id
// @desc    Delete product (admin only)
// @access  Private/Admin
router.delete("/products/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({
      success: true,
      message: "Product deleted successfully"
    });
  } catch (err) {
    res.status(500).json({ error: "Error deleting product: " + err.message });
  }
});

// @route   POST /api/admin/notifications/send
// @desc    Send notification to users
// @access  Private/Admin
router.post("/notifications/send", protect, authorize("admin"), async (req, res) => {
  try {
    const { userIds, title, message, type = "system" } = req.body;

    const notifications = userIds.map(userId => ({
      user: userId,
      title,
      message,
      type
    }));

    const Notification = require("../models/Notification");
    await Notification.insertMany(notifications);

    res.json({
      success: true,
      message: `Notification sent to ${userIds.length} users`
    });
  } catch (err) {
    res.status(500).json({ error: "Error sending notifications: " + err.message });
  }
});

module.exports = router;