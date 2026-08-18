const express = require("express");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");

const router = express.Router();

// ======================================================
// POST /api/notifications/send
// Send notification to a user
// Private route
// ======================================================

router.post("/send", protect, async (req, res) => {
  try {
    const { userId, title, message, type } = req.body;

    // Validate required fields
    if (!userId || !title || !message) {
      return res.status(400).json({
        success: false,
        error: "User ID, title, and message are required",
      });
    }

    // Get Socket.IO instance
    const io = req.app.get("io");

    // Create notification in database
    const notification = await Notification.create({
      user: userId,
      title,
      message,
      type: type || "info",
    });

    // Send notification in real time if Socket.IO is available
    if (io) {
      io.to(`user_${userId}`).emit("notification", {
        ...notification.toObject(),
        timestamp: new Date(),
      });
    }

    return res.status(201).json({
      success: true,
      notification,
      message: "Notification sent successfully",
    });
  } catch (err) {
    console.error("Error creating notification:", err);

    return res.status(500).json({
      success: false,
      error: "Error creating notification: " + err.message,
    });
  }
});

// ======================================================
// GET /api/notifications
// Get notifications for logged-in user
// Private route
// ======================================================

router.get("/", protect, async (req, res) => {
  try {
    const notifications = await Notification.find({
      user: req.user._id,
    }).sort({
      createdAt: -1,
    });

    const unreadCount = notifications.filter(
      (notification) => !notification.read
    ).length;

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (err) {
    console.error("Error fetching notifications:", err);

    return res.status(500).json({
      success: false,
      error: "Error fetching notifications: " + err.message,
    });
  }
});

// ======================================================
// PUT /api/notifications/:id/read
// Mark notification as read
// Private route
// ======================================================

router.put("/:id/read", protect, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    notification.read = true;

    await notification.save();

    return res.status(200).json({
      success: true,
      notification,
      message: "Notification marked as read",
    });
  } catch (err) {
    console.error("Error marking notification as read:", err);

    return res.status(500).json({
      success: false,
      error: "Error marking notification as read: " + err.message,
    });
  }
});

// ======================================================
// Export router
// ======================================================

module.exports = router;