const express = require("express");
const User = require("../models/User");
const { Order } = require("../models/Order");
const Product = require("../models/Product");
const Delivery = require("../models/Delivery");
const Notification = require("../models/Notification");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();
const adminOnly = [protect, authorize("admin")];

const hasMedia = (media) => Boolean(media?.publicId || media?.url);
const hasCompleteFarmerEvidence = (user) => {
  const docs = user.verificationDocuments;
  const location = docs?.farmLocation;
  return Boolean(
    hasMedia(docs?.aadhaarFront) &&
      hasMedia(docs?.aadhaarBack) &&
      hasMedia(docs?.farmPhoto) &&
      hasMedia(docs?.farmingVideo) &&
      Number.isFinite(Number(location?.latitude)) &&
      Number.isFinite(Number(location?.longitude)) &&
      String(location?.address || "").trim() &&
      String(location?.district || "").trim() &&
      String(location?.state || "").trim()
  );
};

router.get("/stats", ...adminOnly, async (req, res) => {
  try {
    const [totalUsers, totalOrders, activeFarmers, verificationEmployees, totalRevenue] =
      await Promise.all([
        User.countDocuments(),
        Order.countDocuments(),
        User.countDocuments({ role: "farmer", isActive: true }),
        User.countDocuments({ role: "verification_employee", isActive: true }),
        Order.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: { $ifNull: ["$totalAmount", 0] } },
            },
          },
        ]),
      ]);

    return res.json({
      success: true,
      stats: {
        totalUsers,
        totalOrders,
        revenue: totalRevenue[0]?.total || 0,
        activeFarmers,
        verificationEmployees,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Error fetching stats: " + err.message });
  }
});

router.get("/users", ...adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * pageSize;

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password -resetPasswordToken -resetPasswordExpire")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      User.countDocuments(query),
    ]);

    return res.json({
      success: true,
      users: users.map((u) => u.getProfile()),
      pagination: { page: pageNum, pages: Math.ceil(total / pageSize), total },
    });
  } catch (err) {
    return res.status(500).json({ error: "Error fetching users: " + err.message });
  }
});

// Admin creates employee accounts; public registration can never create this role.
router.post("/verification-employees", ...adminOnly, async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, state, districts = [] } = req.body;

    if (!firstName || !lastName || !email || !password || !phone || !String(state || "").trim()) {
      return res.status(400).json({
        error: "First name, last name, email, password, phone and assigned state are required.",
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: "Employee password must be at least 8 characters." });
    }

    const duplicate = await User.findOne({
      $or: [{ email: String(email).toLowerCase() }, { phone: String(phone) }],
    });
    if (duplicate) {
      return res.status(400).json({ error: "A user already exists with this email or phone." });
    }

    const employee = await User.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: String(email).trim().toLowerCase(),
      password: String(password),
      phone: String(phone).trim(),
      role: "verification_employee",
      isActive: true,
      verificationArea: {
        state: String(state).trim(),
        districts: Array.isArray(districts)
          ? [...new Set(districts.map((d) => String(d).trim()).filter(Boolean))]
          : [],
      },
    });

    return res.status(201).json({
      success: true,
      employee: employee.getProfile(),
      message: "Verification employee created successfully.",
    });
  } catch (err) {
    return res.status(500).json({ error: "Error creating verification employee: " + err.message });
  }
});

router.get("/verification-employees", ...adminOnly, async (req, res) => {
  try {
    const employees = await User.find({ role: "verification_employee" })
      .select("-password -resetPasswordToken -resetPasswordExpire -bankAccount -verificationDocuments")
      .sort({ "verificationArea.state": 1, firstName: 1 });

    return res.json({
      success: true,
      employees: employees.map((employee) => employee.getProfile()),
    });
  } catch (err) {
    return res.status(500).json({ error: "Error fetching verification employees: " + err.message });
  }
});

router.put("/verification-employees/:id", ...adminOnly, async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee || employee.role !== "verification_employee") {
      return res.status(404).json({ error: "Verification employee not found." });
    }

    if (typeof req.body.state !== "undefined") {
      employee.verificationArea.state = String(req.body.state || "").trim();
    }
    if (Array.isArray(req.body.districts)) {
      employee.verificationArea.districts = [
        ...new Set(req.body.districts.map((d) => String(d).trim()).filter(Boolean)),
      ];
    }
    if (typeof req.body.isActive === "boolean") {
      employee.isActive = req.body.isActive;
    }

    if (!String(employee.verificationArea.state || "").trim()) {
      return res.status(400).json({ error: "Assigned state cannot be empty." });
    }

    await employee.save();
    return res.json({
      success: true,
      employee: employee.getProfile(),
      message: "Verification employee assignment updated.",
    });
  } catch (err) {
    return res.status(500).json({ error: "Error updating verification employee: " + err.message });
  }
});

router.get("/orders", ...adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = status ? { status } : {};
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * pageSize;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("buyer", "firstName lastName email phone")
        .populate("items.product")
        .populate("items.seller", "firstName lastName businessName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      Order.countDocuments(query),
    ]);

    return res.json({
      success: true,
      orders,
      pagination: { page: pageNum, pages: Math.ceil(total / pageSize), total },
    });
  } catch (err) {
    return res.status(500).json({ error: "Error fetching orders: " + err.message });
  }
});

router.get("/products", ...adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;
    const query = {};
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * pageSize;

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("seller", "firstName lastName email phone role businessName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      Product.countDocuments(query),
    ]);

    return res.json({
      success: true,
      products,
      pagination: { page: pageNum, pages: Math.ceil(total / pageSize), total },
    });
  } catch (err) {
    return res.status(500).json({ error: "Error fetching products: " + err.message });
  }
});

router.get("/deliveries", ...adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = status ? { status } : {};
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * pageSize;

    const [deliveries, total] = await Promise.all([
      Delivery.find(query)
        .populate("deliveryPartner", "firstName lastName phone")
        .populate("order")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      Delivery.countDocuments(query),
    ]);

    return res.json({
      success: true,
      deliveries,
      pagination: { page: pageNum, pages: Math.ceil(total / pageSize), total },
    });
  } catch (err) {
    return res.status(500).json({ error: "Error fetching deliveries: " + err.message });
  }
});

router.put("/users/:id/status", ...adminOnly, async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id && req.body.isActive === false) {
      return res.status(400).json({ error: "You cannot deactivate your own admin account." });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: Boolean(req.body.isActive) },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({
      success: true,
      user: user.getProfile(),
      message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (err) {
    return res.status(500).json({ error: "Error updating user status: " + err.message });
  }
});

router.get("/verifications", ...adminOnly, async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ["farmer", "fertilizer_seller"] } })
      .select("-password -resetPasswordToken -resetPasswordExpire -bankAccount")
      .sort({ "verificationDocuments.submittedAt": -1, createdAt: -1 });

    return res.json({
      success: true,
      verifications: users.map((user) => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        verificationStatus: user.verificationStatus,
        verification: user.role === "farmer" ? user.farmerVerification : user.sellerVerification,
        farmLocation: user.verificationDocuments?.farmLocation,
        submittedAt: user.verificationDocuments?.submittedAt,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: "Error fetching verifications: " + err.message });
  }
});

router.put("/verifications/:id", ...adminOnly, async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    const validStatuses = ["verified", "rejected", "more_information_required", "suspended"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid verification status." });
    }

    const user = await User.findById(req.params.id);
    if (!user || !["farmer", "fertilizer_seller"].includes(user.role)) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role === "farmer" && status === "verified" && !hasCompleteFarmerEvidence(user)) {
      return res.status(400).json({ error: "Cannot verify farmer: required manual evidence is incomplete." });
    }

    if (user.role === "farmer") {
      user.verificationStatus = status;
      user.isVerified = status === "verified";
      user.farmerVerification.status = status;
      user.farmerVerification.reviewNotes = reviewNotes || "";
      if (status === "verified") {
        user.farmerVerification.verifiedAt = new Date();
        user.farmerVerification.verifiedBy = req.user._id;
      }
    } else {
      user.sellerVerification.status = status;
      user.sellerVerification.reviewNotes = reviewNotes || "";
      if (status === "verified") {
        user.sellerVerification.verifiedAt = new Date();
        user.sellerVerification.verifiedBy = req.user._id;
      }
    }

    if (status === "suspended") user.isActive = false;
    await user.save();

    return res.json({ success: true, user: user.getProfile(), message: "Verification updated" });
  } catch (err) {
    return res.status(500).json({ error: "Error updating verification: " + err.message });
  }
});

router.put("/orders/:id/status", ...adminOnly, async (req, res) => {
  try {
    const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(req.body.status)) {
      return res.status(400).json({ error: "Invalid order status" });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    ).populate("buyer", "firstName lastName");
    if (!order) return res.status(404).json({ error: "Order not found" });

    await Notification.create({
      user: order.buyer._id,
      title: "Order Status Updated",
      message: `Your order #${order._id} status has been updated to ${req.body.status}`,
      type: "order",
      relatedId: order._id,
    });

    return res.json({ success: true, order, message: "Order status updated successfully" });
  } catch (err) {
    return res.status(500).json({ error: "Error updating order status: " + err.message });
  }
});

router.delete("/products/:id", ...adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    return res.json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: "Error deleting product: " + err.message });
  }
});

router.post("/notifications/send", ...adminOnly, async (req, res) => {
  try {
    const { userIds, title, message, type = "system" } = req.body;
    if (!Array.isArray(userIds) || !userIds.length || !title || !message) {
      return res.status(400).json({ error: "userIds, title and message are required" });
    }

    await Notification.insertMany(
      userIds.map((userId) => ({ user: userId, title, message, type }))
    );

    return res.json({ success: true, message: `Notification sent to ${userIds.length} users` });
  } catch (err) {
    return res.status(500).json({ error: "Error sending notifications: " + err.message });
  }
});

module.exports = router;
