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
const asObject = (value) => value?.toObject?.() || value || {};

const hasCompleteFarmerEvidence = (user) => {
  const docs = user.verificationDocuments;
  const location = docs?.farmLocation;
  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);

  return Boolean(
    hasMedia(docs?.aadhaarFront) &&
      hasMedia(docs?.aadhaarBack) &&
      hasMedia(docs?.farmPhoto) &&
      hasMedia(docs?.farmingVideo) &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      !(lat === 0 && lng === 0) &&
      String(location?.address || "").trim() &&
      String(location?.district || "").trim() &&
      String(location?.state || "").trim()
  );
};

const deactivateSellerProducts = (sellerId) =>
  Product.updateMany(
    { seller: sellerId, isActive: true },
    { $set: { isActive: false } }
  );

const restoreInventory = async (order) => {
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: {
        quantity: Number(item.quantity) || 0,
        totalSold: -(Number(item.quantity) || 0),
      },
    });
  }
};

const createDeliveriesForOrder = async (order) => {
  const buyer = await User.findById(order.buyer);
  if (!buyer) return;

  const itemsBySeller = new Map();
  order.items.forEach((item) => {
    if (!item.seller) return;
    const sellerId = item.seller.toString();
    if (!itemsBySeller.has(sellerId)) itemsBySeller.set(sellerId, []);
    itemsBySeller.get(sellerId).push(item);
  });

  for (const [sellerId, sellerItems] of itemsBySeller.entries()) {
    const existing = await Delivery.findOne({ order: order._id, sender: sellerId });
    if (existing) continue;

    const seller = await User.findById(sellerId);
    if (!seller) continue;

    const recipientCoords =
      order.deliveryAddress?.coordinates?.coordinates?.length === 2
        ? order.deliveryAddress.coordinates.coordinates
        : buyer.location?.coordinates?.length === 2
          ? buyer.location.coordinates
          : [0, 0];
    const senderCoords =
      seller.location?.coordinates?.length === 2 ? seller.location.coordinates : [0, 0];
    const sellerSubtotal = sellerItems.reduce(
      (sum, item) => sum + (Number(item.totalPrice) || Number(item.price) * Number(item.quantity) || 0),
      0
    );
    const deliveryCharge = Math.max(40, Math.round(sellerSubtotal * 0.05));

    await Delivery.create({
      type: sellerItems.some((item) => item.productType === "fertilizer")
        ? "fertilizer"
        : "product",
      order: order._id,
      sender: seller._id,
      senderName: seller.businessName || `${seller.firstName} ${seller.lastName}`,
      senderPhone: seller.phone || "",
      senderLocation: {
        type: "Point",
        coordinates: senderCoords,
        address: [seller.address?.street, seller.address?.city, seller.address?.state]
          .filter(Boolean)
          .join(", "),
      },
      recipient: buyer._id,
      recipientName:
        order.deliveryAddress?.fullName || `${buyer.firstName} ${buyer.lastName}`,
      recipientPhone: order.deliveryAddress?.phone || buyer.phone || "",
      recipientEmail: buyer.email || "",
      recipientLocation: {
        type: "Point",
        coordinates: recipientCoords,
        address: [
          order.deliveryAddress?.street,
          order.deliveryAddress?.city,
          order.deliveryAddress?.state,
          order.deliveryAddress?.zipCode,
        ]
          .filter(Boolean)
          .join(", "),
      },
      items: sellerItems.map((item) => ({
        product: item.product,
        name: item.productName,
        quantity: item.quantity,
        weight: item.quantity,
      })),
      status: "assigned",
      deliveryCharge,
      totalEarnings: deliveryCharge,
      statusHistory: [
        {
          status: "assigned",
          timestamp: new Date(),
          note: "Delivery job created by admin order confirmation",
        },
      ],
    });
  }
};

const ORDER_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "shipped", "delivered", "cancelled"],
  processing: ["shipped", "delivered", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
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
          { $match: { status: { $ne: "cancelled" } } },
          { $group: { _id: null, total: { $sum: { $ifNull: ["$totalAmount", 0] } } } },
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
      users: users.map((user) => user.getProfile()),
      pagination: { page: pageNum, pages: Math.ceil(total / pageSize), total },
    });
  } catch (err) {
    return res.status(500).json({ error: "Error fetching users: " + err.message });
  }
});

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
      $or: [{ email: String(email).trim().toLowerCase() }, { phone: String(phone).trim() }],
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
          ? [...new Set(districts.map((district) => String(district).trim()).filter(Boolean))]
          : [],
      },
    });

    return res.status(201).json({
      success: true,
      employee: employee.getProfile(),
      message: "Verification employee created successfully.",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error creating verification employee: " + err.message,
    });
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
    return res.status(500).json({
      error: "Error fetching verification employees: " + err.message,
    });
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
        ...new Set(req.body.districts.map((district) => String(district).trim()).filter(Boolean)),
      ];
    }
    if (typeof req.body.isActive === "boolean") employee.isActive = req.body.isActive;

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
    return res.status(500).json({
      error: "Error updating verification employee: " + err.message,
    });
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
        .populate("buyer", "firstName lastName email phone role")
        .populate("items.product")
        .populate("items.seller", "firstName lastName businessName role")
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
    if (typeof req.body.isActive !== "boolean") {
      return res.status(400).json({ error: "isActive must be true or false" });
    }
    if (req.user._id.toString() === req.params.id && req.body.isActive === false) {
      return res.status(400).json({ error: "You cannot deactivate your own admin account." });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.isActive = req.body.isActive;
    if (!req.body.isActive && ["farmer", "fertilizer_seller"].includes(user.role)) {
      await deactivateSellerProducts(user._id);
    }

    if (user.role === "farmer") {
      if (!req.body.isActive) {
        user.verificationStatus = "suspended";
        user.isVerified = false;
        user.farmerVerification = {
          ...asObject(user.farmerVerification),
          status: "suspended",
          verifiedAt: undefined,
          verifiedBy: undefined,
        };
      } else if (user.verificationStatus === "suspended") {
        user.verificationStatus = "more_information_required";
        user.isVerified = false;
        user.farmerVerification = {
          ...asObject(user.farmerVerification),
          status: "more_information_required",
          reviewNotes: "Account reactivated; farmer verification must be reviewed again.",
        };
      }
    }

    await user.save();

    return res.json({
      success: true,
      user: user.getProfile(),
      message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (err) {
    return res.status(500).json({ error: "Error updating user status: " + err.message });
  }
});

// Compatibility admin verification endpoints. They enforce the same farmer
// evidence/status rules as /api/users/verify/* rather than maintaining a weaker path.
router.get("/verifications", ...adminOnly, async (req, res) => {
  try {
    const users = await User.find({ role: "farmer" })
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
        verificationDocuments: user.verificationDocuments,
        adminReview: user.adminReview,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: "Error fetching verifications: " + err.message });
  }
});

router.put("/verifications/:id", ...adminOnly, async (req, res) => {
  try {
    const status = req.body.status;
    if (!["verified", "rejected", "more_information_required", "suspended"].includes(status)) {
      return res.status(400).json({ error: "Invalid verification status" });
    }

    const farmer = await User.findOne({ _id: req.params.id, role: "farmer" });
    if (!farmer) return res.status(404).json({ error: "Farmer not found" });

    if (status === "verified" && !hasCompleteFarmerEvidence(farmer)) {
      return res.status(400).json({
        error:
          "Cannot approve: Aadhaar front/back, farm photo, farming video, valid non-zero GPS, farm address, district and state are required.",
      });
    }

    farmer.verificationStatus = status;
    farmer.isVerified = status === "verified";
    farmer.adminReview = {
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      notes: String(req.body.reviewNotes || "").trim(),
      rejectionReason: status === "rejected" ? String(req.body.reviewNotes || "").trim() : "",
      moreInfoRequest:
        status === "more_information_required" ? String(req.body.reviewNotes || "").trim() : "",
    };
    farmer.farmerVerification = {
      ...asObject(farmer.farmerVerification),
      status,
      reviewNotes: String(req.body.reviewNotes || "").trim(),
      verifiedAt: status === "verified" ? new Date() : undefined,
      verifiedBy: status === "verified" ? req.user._id : undefined,
    };

    if (status === "verified") {
      farmer.isActive = true;
    } else {
      await deactivateSellerProducts(farmer._id);
      if (status === "suspended") farmer.isActive = false;
    }

    await farmer.save();
    return res.json({
      success: true,
      user: farmer.getProfile(),
      message: "Verification updated",
    });
  } catch (err) {
    return res.status(500).json({ error: "Error updating verification: " + err.message });
  }
});

router.put("/orders/:id/status", ...adminOnly, async (req, res) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const allowedNext = ORDER_TRANSITIONS[order.status] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        error: `Order cannot move from ${order.status} to ${status}`,
      });
    }

    const previousStatus = order.status;
    order.status = status;
    order.statusHistory.push({ status, timestamp: new Date(), note });

    if (status === "cancelled" && previousStatus !== "cancelled") {
      await restoreInventory(order);
    }

    await order.save();
    if (status === "confirmed") await createDeliveriesForOrder(order);

    await Notification.create({
      user: order.buyer,
      title: "Order Status Updated",
      message: `Your order #${order.orderNumber || order._id} status is now ${status}`,
      type: "order",
      relatedId: order._id,
    });

    return res.json({
      success: true,
      order,
      message: "Order status updated successfully",
    });
  } catch (err) {
    return res.status(500).json({ error: "Error updating order status: " + err.message });
  }
});

router.delete("/products/:id", ...adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    await User.findByIdAndUpdate(product.seller, {
      $inc: { totalProducts: -1 },
    });

    return res.json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: "Error deleting product: " + err.message });
  }
});

router.post("/notifications/send", ...adminOnly, async (req, res) => {
  try {
    const { userIds, title, message, type = "system" } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0 || !title || !message) {
      return res.status(400).json({ error: "userIds, title and message are required" });
    }

    const validUsers = await User.find({ _id: { $in: userIds } }).select("_id");
    const validIds = validUsers.map((user) => user._id);
    if (validIds.length === 0) {
      return res.status(400).json({ error: "No valid notification recipients found" });
    }

    await Notification.insertMany(
      validIds.map((userId) => ({ user: userId, title, message, type }))
    );

    const io = req.app.get("io");
    if (io) {
      validIds.forEach((userId) => {
        io.to(`user_${userId}`).emit("notification", {
          title,
          message,
          type,
          timestamp: new Date(),
          read: false,
        });
      });
    }

    return res.json({
      success: true,
      message: `Notification sent to ${validIds.length} users`,
    });
  } catch (err) {
    return res.status(500).json({ error: "Error sending notifications: " + err.message });
  }
});

module.exports = router;
