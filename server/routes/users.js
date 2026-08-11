const express = require("express");
const User = require("../models/User");
const Product = require("../models/Product");
const { protect, authorize } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { uploadBuffer } = require("../utils/cloudinary");

const router = express.Router();

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -resetPasswordToken -resetPasswordExpire"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const productCount = await Product.countDocuments({ seller: user._id, isActive: true });

    const profile = user.getProfile();
    profile.totalProducts = productCount;

    res.json({
      success: true,
      user: profile,
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching user: " + err.message });
  }
});

// @route   GET /api/users/search/nearby
// @desc    Get nearby farmers/sellers by geolocation
// @access  Public
router.get("/search/nearby", async (req, res) => {
  try {
    const { longitude, latitude, maxDistance, role = "farmer" } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({ error: "Longitude and latitude are required" });
    }

    const parsedMaxDistance = Number(maxDistance);
    const maxDistanceValue = Number.isFinite(parsedMaxDistance) && parsedMaxDistance > 0 ? parsedMaxDistance : 10000;

    const users = await User.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: maxDistanceValue,
        },
      },
      role,
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

// @route   POST /api/users/verification
// @desc    Submit verification documents for farmers or fertilizer sellers
// @access  Private
router.post(
  "/verification",
  protect,
  upload.fields([
    { name: "identityDocument", maxCount: 1 },
    { name: "farmingProof", maxCount: 1 },
    { name: "farmPhoto", maxCount: 1 },
    { name: "shopCertificate", maxCount: 1 },
    { name: "shopPhoto", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        farmerId,
        shopName,
        sellerId,
        farmLocation: farmLocationRaw,
        shopLocation: shopLocationRaw,
        reviewNotes,
      } = req.body;

      let farmLocation = null;
      let shopLocation = null;

      try {
        farmLocation = farmLocationRaw ? JSON.parse(farmLocationRaw) : null;
      } catch (error) {
        farmLocation = farmLocationRaw;
      }

      try {
        shopLocation = shopLocationRaw ? JSON.parse(shopLocationRaw) : null;
      } catch (error) {
        shopLocation = shopLocationRaw;
      }

      const uploadedFiles = {};

      if (req.files?.identityDocument?.[0]) {
        const result = await uploadBuffer(
          req.files.identityDocument[0].buffer,
          "agroconnect/verification",
          `identity_${req.user._id}_${Date.now()}`
        );
        uploadedFiles.identityDocumentUrl = result.secure_url;
      }

      if (req.files?.farmingProof?.[0]) {
        const result = await uploadBuffer(
          req.files.farmingProof[0].buffer,
          "agroconnect/verification",
          `farmingProof_${req.user._id}_${Date.now()}`
        );
        uploadedFiles.farmingProofUrl = result.secure_url;
      }

      if (req.files?.farmPhoto?.[0]) {
        const result = await uploadBuffer(
          req.files.farmPhoto[0].buffer,
          "agroconnect/verification",
          `farmPhoto_${req.user._id}_${Date.now()}`
        );
        uploadedFiles.farmPhotoUrl = result.secure_url;
      }

      if (req.files?.shopCertificate?.[0]) {
        const result = await uploadBuffer(
          req.files.shopCertificate[0].buffer,
          "agroconnect/verification",
          `shopCertificate_${req.user._id}_${Date.now()}`
        );
        uploadedFiles.shopCertificateUrl = result.secure_url;
      }

      if (req.files?.shopPhoto?.[0]) {
        const result = await uploadBuffer(
          req.files.shopPhoto[0].buffer,
          "agroconnect/verification",
          `shopPhoto_${req.user._id}_${Date.now()}`
        );
        uploadedFiles.shopPhotoUrl = result.secure_url;
      }

      if (req.user.role === "farmer") {
        req.user.farmerVerification = {
          ...(req.user.farmerVerification || {}),
          status: "pending",
          identityDocumentUrl:
            uploadedFiles.identityDocumentUrl || req.user.farmerVerification?.identityDocumentUrl,
          farmingProofUrl:
            uploadedFiles.farmingProofUrl || req.user.farmerVerification?.farmingProofUrl,
          farmPhotoUrl: uploadedFiles.farmPhotoUrl || req.user.farmerVerification?.farmPhotoUrl,
          farmerId: farmerId || req.user.farmerVerification?.farmerId,
          farmLocation: farmLocation || req.user.farmerVerification?.farmLocation,
          reviewNotes: reviewNotes || req.user.farmerVerification?.reviewNotes,
          submittedAt: new Date(),
          verifiedAt: null,
          verifiedBy: null,
        };
      } else if (req.user.role === "fertilizer_seller") {
        req.user.sellerVerification = {
          ...(req.user.sellerVerification || {}),
          status: "pending",
          identityDocumentUrl:
            uploadedFiles.identityDocumentUrl || req.user.sellerVerification?.identityDocumentUrl,
          shopCertificateUrl:
            uploadedFiles.shopCertificateUrl || req.user.sellerVerification?.shopCertificateUrl,
          shopPhotoUrl: uploadedFiles.shopPhotoUrl || req.user.sellerVerification?.shopPhotoUrl,
          sellerId: sellerId || req.user.sellerVerification?.sellerId,
          shopName: shopName || req.user.sellerVerification?.shopName,
          shopLocation: shopLocation || req.user.sellerVerification?.shopLocation,
          reviewNotes: reviewNotes || req.user.sellerVerification?.reviewNotes,
          submittedAt: new Date(),
          verifiedAt: null,
          verifiedBy: null,
        };
      } else {
        return res.status(403).json({ error: "Only farmers and fertilizer sellers can submit verification" });
      }

      await req.user.save();

      res.json({ success: true, user: req.user.getProfile(), message: "Verification submitted successfully" });
    } catch (err) {
      res.status(500).json({ error: "Error submitting verification: " + err.message });
    }
  }
);

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
