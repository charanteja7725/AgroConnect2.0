const express = require("express");
const Notification = require("../models/Notification");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");

const router = express.Router();

// @route   POST /api/notifications/send
// @desc    Send notification to user
// @access  Private
router.post("/send", protect, async (req, res) => {
  try {
    const { userId, title, message, type } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const io = req.app.get("io");

    const notification = await Notification.create({
      user: userId,
      title,
      message,
      type: type || "info",
    });

    // Send real-time notification
    if (io) {
      io.to(`user_${userId}`).emit("notification", {
        ...notification.toObject(),
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      notification,
      message: "Notification sent successfully",
    });
  } catch (err) {
    console.error("Error creating notification:", err);
  }
};

// @route   GET /api/notifications
// @desc    Get user notifications
// @access  Private
router.get("/", protect, async (req, res) => {
router.get("/", protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
    const unreadCount = notifications.filter((n) => !n.read).length;

    res.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching notifications: " + err.message });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put("/:id/read", protect, async (req, res) => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    notification.read = true;
    await notification.save();

    res.json({
      success: true,
      notification,
    });
  } catch (err) {
    res.status(500).json({ error: "Error marking notification as read: " + err.message });
  }
});

module.exports = router;
