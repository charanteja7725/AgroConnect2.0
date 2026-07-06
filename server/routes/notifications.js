const express = require("express");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Helper function to send and save notification
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

    // Send real-time notification via Socket.IO
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

    return notification;
  } catch (err) {
    console.error("Error creating notification:", err);
  }
};

// @route   GET /api/notifications
// @desc    Get user notifications
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    const { page = 1, limit = 20, read } = req.query;
    const skip = (page - 1) * limit;

    let query = { user: req.user._id };
    if (read !== undefined) {
      query.read = read === "true";
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });

    res.json({
      success: true,
      notifications,
      total,
      unreadCount,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching notifications: " + err.message });
  }
});

// @route   GET /api/notifications/:id
// @desc    Get single notification
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    if (notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to view this notification" });
    }

    res.json({
      success: true,
      notification,
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching notification: " + err.message });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put("/:id/read", protect, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    if (notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to update this notification" });
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({
      success: true,
      notification,
      message: "Notification marked as read",
    });
  } catch (err) {
    res.status(500).json({ error: "Error updating notification: " + err.message });
  }
});

// @route   PUT /api/notifications/mark-all-read
// @desc    Mark all notifications as read
// @access  Private
router.put("/mark-all/read", protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (err) {
    res.status(500).json({ error: "Error updating notifications: " + err.message });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
// @access  Private
router.delete("/:id", protect, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    if (notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to delete this notification" });
    }

    await Notification.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ error: "Error deleting notification: " + err.message });
  }
});

// Export helper function for use in other routes
router.sendNotification = sendNotification;

module.exports = router;
