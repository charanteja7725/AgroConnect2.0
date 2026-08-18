const express = require("express");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// ─────────────────────────────────────────────────────────────────
// FARMER VERIFICATION ROUTES
// ─────────────────────────────────────────────────────────────────

// @route   POST /api/users/verify/submit
// @desc    Farmer submits verification request
// @access  Private (Farmer only)
router.post("/verify/submit", protect, authorize("farmer"), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.verificationStatus === "verified") {
      return res.status(400).json({ error: "Your account is already verified." });
    }
    if (user.verificationStatus === "suspended") {
      return res.status(403).json({ error: "Your account has been suspended." });
    }

    const {
      additionalNotes,
      gpsLatitude,
      gpsLongitude,
      governmentIdUrl,
      governmentIdPublicId,
      farmerIdUrl,
      farmerIdPublicId,
      farmPhotoUrl,
      farmPhotoPublicId,
    } = req.body;

    user.verificationStatus = "pending";
    user.verificationDocuments = {
      ...(user.verificationDocuments || {}),
      governmentId: governmentIdUrl
        ? { url: governmentIdUrl, publicId: governmentIdPublicId || "", uploadedAt: new Date() }
        : user.verificationDocuments?.governmentId,
      farmerId: farmerIdUrl
        ? { url: farmerIdUrl, publicId: farmerIdPublicId || "", uploadedAt: new Date() }
        : user.verificationDocuments?.farmerId,
      farmPhoto: farmPhotoUrl
        ? { url: farmPhotoUrl, publicId: farmPhotoPublicId || "", uploadedAt: new Date() }
        : user.verificationDocuments?.farmPhoto,
      gpsCoordinates:
        gpsLatitude && gpsLongitude
          ? { latitude: parseFloat(gpsLatitude), longitude: parseFloat(gpsLongitude) }
          : user.verificationDocuments?.gpsCoordinates,
      submittedAt: new Date(),
      additionalNotes: additionalNotes || "",
    };

    await user.save();

    res.json({
      success: true,
      message: "Verification request submitted. An admin will review it shortly.",
      verificationStatus: user.verificationStatus,
    });
  } catch (err) {
    res.status(500).json({ error: "Error submitting verification: " + err.message });
  }
});

// @route   GET /api/users/verify/pending
// @desc    Get all farmers awaiting verification (admin only)
// @access  Private/Admin
router.get("/verify/pending", protect, authorize("admin"), async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const validStatuses = ["not_submitted", "pending", "more_information_required", "verified", "rejected", "suspended"];
    const filterStatus = validStatuses.includes(status) ? status : "pending";

    const farmers = await User.find({ role: "farmer", verificationStatus: filterStatus })
      .select("-password -resetPasswordToken -resetPasswordExpire")
      .sort({ "verificationDocuments.submittedAt": -1 });

    res.json({
      success: true,
      count: farmers.length,
      farmers: farmers.map((u) => u.getProfile()),
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching pending verifications: " + err.message });
  }
});

// @route   PUT /api/users/verify/:id
// @desc    Admin approves/rejects farmer verification
// @access  Private/Admin
router.put("/verify/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const { action, notes, rejectionReason, moreInfoRequest } = req.body;
    const validActions = ["verified", "rejected", "more_information_required", "suspended"];

    if (!validActions.includes(action)) {
      return res.status(400).json({ error: "Invalid action. Use: verified, rejected, more_information_required, suspended" });
    }

    const farmer = await User.findById(req.params.id);
    if (!farmer) {
      return res.status(404).json({ error: "Farmer not found" });
    }
    if (farmer.role !== "farmer") {
      return res.status(400).json({ error: "User is not a farmer" });
    }

    farmer.verificationStatus = action;
    farmer.adminReview = {
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      notes: notes || "",
      rejectionReason: rejectionReason || "",
      moreInfoRequest: moreInfoRequest || "",
    };

    if (action === "verified") {
      farmer.isVerified = true;
    } else if (action === "suspended") {
      farmer.isActive = false;
    }

    await farmer.save();

    res.json({
      success: true,
      message: `Farmer ${action === "verified" ? "approved" : action} successfully.`,
      farmer: farmer.getProfile(),
    });
  } catch (err) {
    res.status(500).json({ error: "Error updating verification: " + err.message });
  }
});

// @route   PUT /api/users/:id/suspend
// @desc    Admin suspends/reactivates a user
// @access  Private/Admin
router.put("/:id/suspend", protect, authorize("admin"), async (req, res) => {
  try {
    const { action, reason } = req.body; // action: "suspend" | "activate"
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.isActive = action === "activate";
    if (action === "suspend" && user.role === "farmer") {
      user.verificationStatus = "suspended";
    }
    await user.save();

    res.json({
      success: true,
      message: `User ${action === "suspend" ? "suspended" : "activated"} successfully.`,
      user: user.getProfile(),
    });
  } catch (err) {
    res.status(500).json({ error: "Error updating user status: " + err.message });
  }
});

// @route   GET /api/users/role/:role
// @desc    Get all users of a specific role
// @access  Private/Admin
// NOTE: This MUST be before /:id to avoid Express matching "role" as an ID
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

// @route   GET /api/users/search/nearby
// @desc    Get nearby farmers/sellers by geolocation
// @access  Public
// NOTE: This MUST be before /:id to avoid Express matching "search" as an ID
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

// (Moved above /:id — see earlier in file)

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
