const express = require("express");
const { protect } = require("../middleware/auth");

const router = express.Router();

// @route   POST /api/notifications/send
// @desc    Send notification to user
// @access  Private
router.post("/send", protect, (req, res) => {
  try {
    const { userId, title, message, type } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const io = req.app.get("io");

    // Send real-time notification
    io.to(`user_${userId}`).emit("notification", {
      title,
      message,
      type: type || "info",
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: "Notification sent successfully",
    });
  } catch (err) {
    res.status(500).json({ error: "Error sending notification: " + err.message });
  }
});

// @route   GET /api/notifications
// @desc    Get user notifications
// @access  Private
router.get("/", protect, (req, res) => {
  try {
    // In production, fetch from database
    res.json({
      success: true,
      notifications: [
        {
          id: 1,
          title: "New Order",
          message: "You have a new order",
          type: "order",
          timestamp: new Date(),
          read: false,
        },
      ],
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching notifications: " + err.message });
  }
});

module.exports = router;
