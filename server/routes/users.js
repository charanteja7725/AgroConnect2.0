const express = require("express");
const cloudinary = require("cloudinary").v2;
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const VERIFICATION_MEDIA_KEYS = [
  "aadhaarFront",
  "aadhaarBack",
  "farmPhoto",
  "farmingVideo",
];

const toPlainObject = (value) => value?.toObject?.() || value || {};

const normalizeMedia = (existing, incoming, defaultResourceType = "image") => {
  if (!incoming || (!incoming.publicId && !incoming.url)) {
    return existing;
  }

  return {
    url: incoming.url || "",
    publicId: incoming.publicId || "",
    resourceType: incoming.resourceType || defaultResourceType,
    deliveryType: incoming.deliveryType || "authenticated",
    uploadedAt: new Date(),
  };
};

const hasMedia = (media) => Boolean(media?.publicId || media?.url);

const isValidFarmLocation = (location) => {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};

const createSignedPreviewUrl = (media) => {
  if (!media) return "";

  const item = toPlainObject(media);

  if (!item.publicId) {
    return item.url || "";
  }

  try {
    return cloudinary.url(item.publicId, {
      secure: true,
      sign_url: true,
      type: item.deliveryType || "authenticated",
      resource_type: item.resourceType || "image",
    });
  } catch (error) {
    console.warn("Unable to create verification preview URL:", error.message);
    return "";
  }
};

const profileWithVerificationPreviews = (user) => {
  const profile = user.getProfile();
  const documents = profile.verificationDocuments || {};

  VERIFICATION_MEDIA_KEYS.forEach((key) => {
    if (documents[key]) {
      documents[key] = {
        ...documents[key],
        previewUrl: createSignedPreviewUrl(documents[key]),
      };
    }
  });

  profile.verificationDocuments = documents;
  return profile;
};

// ─────────────────────────────────────────────────────────────────
// FARMER MANUAL VERIFICATION ROUTES
// ─────────────────────────────────────────────────────────────────

// @route   POST /api/users/verify/submit
// @desc    Farmer submits Aadhaar/farm evidence for local employee review
// @access  Private (Farmer only)
router.post("/verify/submit", protect, authorize("farmer"), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: "Farmer account not found" });
    }

    if (user.verificationStatus === "verified") {
      return res.status(400).json({ error: "Your account is already verified." });
    }

    if (user.verificationStatus === "suspended") {
      return res.status(403).json({ error: "Your account has been suspended." });
    }

    const {
      aadhaarFront,
      aadhaarBack,
      farmPhoto,
      farmingVideo,
      farmLocation,
      additionalNotes,
    } = req.body;

    const existingDocuments = toPlainObject(user.verificationDocuments);

    const nextDocuments = {
      ...existingDocuments,
      aadhaarFront: normalizeMedia(
        existingDocuments.aadhaarFront,
        aadhaarFront,
        "image"
      ),
      aadhaarBack: normalizeMedia(
        existingDocuments.aadhaarBack,
        aadhaarBack,
        "image"
      ),
      farmPhoto: normalizeMedia(
        existingDocuments.farmPhoto,
        farmPhoto,
        "image"
      ),
      farmingVideo: normalizeMedia(
        existingDocuments.farmingVideo,
        farmingVideo,
        "video"
      ),
      farmLocation: farmLocation || existingDocuments.farmLocation,
      submittedAt: new Date(),
      additionalNotes: additionalNotes || "",
    };

    if (!hasMedia(nextDocuments.aadhaarFront)) {
      return res.status(400).json({ error: "Aadhaar front photo is required." });
    }

    if (!hasMedia(nextDocuments.aadhaarBack)) {
      return res.status(400).json({ error: "Aadhaar back photo is required." });
    }

    if (!hasMedia(nextDocuments.farmPhoto)) {
      return res.status(400).json({ error: "A current farm photo is required." });
    }

    if (!hasMedia(nextDocuments.farmingVideo)) {
      return res.status(400).json({ error: "A farming verification video is required." });
    }

    if (!isValidFarmLocation(nextDocuments.farmLocation)) {
      return res.status(400).json({
        error: "Valid farm GPS latitude and longitude are required.",
      });
    }

    nextDocuments.farmLocation = {
      latitude: Number(nextDocuments.farmLocation.latitude),
      longitude: Number(nextDocuments.farmLocation.longitude),
      address: String(nextDocuments.farmLocation.address || "").trim(),
      village: String(nextDocuments.farmLocation.village || "").trim(),
      district: String(nextDocuments.farmLocation.district || "").trim(),
      state: String(nextDocuments.farmLocation.state || "").trim(),
      pincode: String(nextDocuments.farmLocation.pincode || "").trim(),
    };

    user.verificationDocuments = nextDocuments;
    user.verificationStatus = "pending";
    user.isVerified = false;

    user.farmerVerification = {
      ...(toPlainObject(user.farmerVerification)),
      status: "pending",
      submittedAt: new Date(),
      reviewNotes: "",
    };

    // Keep the farmer's marketplace location in sync with the verified farm
    // coordinates. MongoDB GeoJSON uses [longitude, latitude].
    user.location = {
      type: "Point",
      coordinates: [
        nextDocuments.farmLocation.longitude,
        nextDocuments.farmLocation.latitude,
      ],
    };

    await user.save();

    return res.json({
      success: true,
      message:
        "Verification submitted. A local AgroConnect verification employee will manually review your Aadhaar photos, farm photo, farming video and farm location.",
      verificationStatus: user.verificationStatus,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error submitting verification: " + err.message,
    });
  }
});

// @route   GET /api/users/verify/pending
// @desc    Get farmers by verification status with secure media previews
// @access  Private/Admin
router.get("/verify/pending", protect, authorize("admin"), async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const validStatuses = [
      "not_submitted",
      "pending",
      "more_information_required",
      "verified",
      "rejected",
      "suspended",
    ];
    const filterStatus = validStatuses.includes(status) ? status : "pending";

    const farmers = await User.find({
      role: "farmer",
      verificationStatus: filterStatus,
    })
      .select("-password -resetPasswordToken -resetPasswordExpire")
      .sort({ "verificationDocuments.submittedAt": -1 });

    return res.json({
      success: true,
      count: farmers.length,
      farmers: farmers.map(profileWithVerificationPreviews),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error fetching pending verifications: " + err.message,
    });
  }
});

// @route   PUT /api/users/verify/:id
// @desc    Admin/local verification employee approves or rejects farmer
// @access  Private/Admin
router.put("/verify/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const { action, notes, rejectionReason, moreInfoRequest } = req.body;
    const validActions = [
      "verified",
      "rejected",
      "more_information_required",
      "suspended",
    ];

    if (!validActions.includes(action)) {
      return res.status(400).json({
        error:
          "Invalid action. Use: verified, rejected, more_information_required, suspended",
      });
    }

    const farmer = await User.findById(req.params.id);

    if (!farmer) {
      return res.status(404).json({ error: "Farmer not found" });
    }

    if (farmer.role !== "farmer") {
      return res.status(400).json({ error: "User is not a farmer" });
    }

    if (action === "verified") {
      const documents = farmer.verificationDocuments;

      if (!hasMedia(documents?.aadhaarFront)) {
        return res.status(400).json({
          error: "Cannot approve: Aadhaar front photo is missing.",
        });
      }

      if (!hasMedia(documents?.aadhaarBack)) {
        return res.status(400).json({
          error: "Cannot approve: Aadhaar back photo is missing.",
        });
      }

      if (!hasMedia(documents?.farmPhoto)) {
        return res.status(400).json({
          error: "Cannot approve: Farm photo is missing.",
        });
      }

      if (!hasMedia(documents?.farmingVideo)) {
        return res.status(400).json({
          error: "Cannot approve: Farming verification video is missing.",
        });
      }

      if (!isValidFarmLocation(documents?.farmLocation)) {
        return res.status(400).json({
          error: "Cannot approve: Valid farm GPS location is missing.",
        });
      }
    }

    farmer.verificationStatus = action;
    farmer.adminReview = {
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      notes: notes || "",
      rejectionReason: rejectionReason || "",
      moreInfoRequest: moreInfoRequest || "",
    };

    farmer.farmerVerification = {
      ...(toPlainObject(farmer.farmerVerification)),
      status: action,
      reviewNotes: notes || rejectionReason || moreInfoRequest || "",
      verifiedAt:
        action === "verified"
          ? new Date()
          : farmer.farmerVerification?.verifiedAt,
      verifiedBy:
        action === "verified"
          ? req.user._id
          : farmer.farmerVerification?.verifiedBy,
    };

    if (action === "verified") {
      farmer.isVerified = true;
      farmer.isActive = true;
    } else {
      farmer.isVerified = false;
      if (action === "suspended") {
        farmer.isActive = false;
      }
    }

    await farmer.save();

    return res.json({
      success: true,
      message: `Farmer ${action === "verified" ? "approved" : action} successfully.`,
      farmer: farmer.getProfile(),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error updating verification: " + err.message,
    });
  }
});

// @route   PUT /api/users/:id/suspend
// @desc    Admin suspends/reactivates a user
// @access  Private/Admin
router.put("/:id/suspend", protect, authorize("admin"), async (req, res) => {
  try {
    const { action } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ error: "User not found" });

    user.isActive = action === "activate";

    if (action === "suspend" && user.role === "farmer") {
      user.verificationStatus = "suspended";
      user.isVerified = false;
      user.farmerVerification.status = "suspended";
    }

    await user.save();

    return res.json({
      success: true,
      message: `User ${action === "suspend" ? "suspended" : "activated"} successfully.`,
      user: user.getProfile(),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error updating user status: " + err.message,
    });
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

    return res.json({
      success: true,
      count: users.length,
      users: users.map((u) => u.getProfile()),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error fetching users: " + err.message,
    });
  }
});

// @route   GET /api/users/search/nearby
// @desc    Get nearby farmers/sellers by geolocation
// @access  Public
router.get("/search/nearby", async (req, res) => {
  try {
    const {
      longitude,
      latitude,
      maxDistance = 5000,
      role = "farmer",
    } = req.query;

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
      role,
      isActive: true,
    });

    return res.json({
      success: true,
      count: users.length,
      users: users.map((u) => u.getProfile()),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error searching users: " + err.message,
    });
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

    return res.json({
      success: true,
      user: user.getProfile(),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error fetching user: " + err.message,
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user profile
// @access  Private
router.put("/:id", protect, async (req, res) => {
  try {
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

    return res.json({
      success: true,
      user: user.getProfile(),
      message: "Profile updated successfully",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error updating profile: " + err.message,
    });
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

    const avgRating =
      user.reviews.reduce((sum, r) => sum + r.rating, 0) / user.reviews.length;
    user.rating = avgRating;
    user.totalReviews = user.reviews.length;

    await user.save();

    return res.status(201).json({
      success: true,
      message: "Review added successfully",
      user: user.getProfile(),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error adding review: " + err.message,
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user account
// @access  Private
router.delete("/:id", protect, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to delete this user" });
    }

    await User.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error deleting user: " + err.message,
    });
  }
});

module.exports = router;
