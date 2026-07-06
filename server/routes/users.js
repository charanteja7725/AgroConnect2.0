const express = require("express");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/users/search/nearby
// @desc    Get nearby farmers/sellers by geolocation
// @access  Public
router.get("/search/nearby", async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 5000, role = "farmer" } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({ error: "Longitude and latitude are required" });
    }

    const users = await User.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseInt(maxDistance),
        },
      },
      role: role,
      isActive: true,
    });

    res.json({
      success: true,
      count: users.length,
      users: users.map((u) => u.getProfile()),
    });
  } catch (err) {
    res.status(500).json({ error: "Error searching users: " + err.message });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -resetPasswordToken -resetPasswordExpire"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      user: user.getProfile(),
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching user: " + err.message });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user profile
// @access  Private
router.put("/:id", protect, async (req, res) => {
  try {
    // Users can only update their own profile (or admin can update any)
    if (req.user._id.toString() !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to update this user" });
    }

    const allowedFields = [
      "firstName",
      "lastName",
      "avatar",
      "bio",
      "address",
      "location",
      "phone",
      "bankAccount",
      "language",
    ];

    const updates = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      user: user.getProfile(),
      message: "Profile updated successfully",
    });
  } catch (err) {
    res.status(500).json({ error: "Error updating profile: " + err.message });
  }
});

// @route   GET /api/users/role/:role
// @desc    Get all users of a specific role
// @access  Private/Admin
router.get("/role/:role", protect, authorize("admin"), async (req, res) => {
  try {
    const users = await User.find({ role: req.params.role }).select(
      "-password -resetPasswordToken -resetPasswordExpire"
    );

    res.json({
      success: true,
      count: users.length,
      users: users.map((u) => u.getProfile()),
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching users: " + err.message });
  }
});

// @route   POST /api/users/:id/review
// @desc    Add review to user
// @access  Private
router.post("/:id/review", protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user already reviewed
    const existingReview = user.reviews.find(
      (r) => r.reviewer.toString() === req.user._id.toString()
    );

    if (existingReview) {
      return res.status(400).json({ error: "You have already reviewed this user" });
    }

    user.reviews.push({
      reviewer: req.user._id,
      rating,
      comment,
      createdAt: new Date(),
    });

    // Recalculate average rating
    const avgRating =
      user.reviews.reduce((sum, r) => sum + r.rating, 0) / user.reviews.length;
    user.rating = avgRating;
    user.totalReviews = user.reviews.length;

    await user.save();

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      user: user.getProfile(),
    });
  } catch (err) {
    res.status(500).json({ error: "Error adding review: " + err.message });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user account
// @access  Private
router.delete("/:id", protect, async (req, res) => {
  try {
    // Users can only delete their own account (or admin)
    if (req.user._id.toString() !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to delete this user" });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ error: "Error deleting user: " + err.message });
  }
});

module.exports = router;
