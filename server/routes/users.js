const express = require("express");
const cloudinary = require("cloudinary").v2;
const User = require("../models/User");
const Product = require("../models/Product");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

const cloudinaryCloudName =
  process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME || "";
const cloudinaryConfigured = Boolean(
  cloudinaryCloudName &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

cloudinary.config({
  cloud_name: cloudinaryCloudName,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const VERIFICATION_MEDIA_KEYS = [
  "aadhaarFront",
  "aadhaarBack",
  "farmPhoto",
  "farmingVideo",
];

const VERIFICATION_STATUSES = [
  "not_submitted",
  "pending",
  "more_information_required",
  "verified",
  "rejected",
  "suspended",
];

const toPlainObject = (value) => value?.toObject?.() || value || {};
const hasMedia = (media) => Boolean(media?.publicId || media?.url);
const normalizeArea = (value) => String(value || "").trim().toLowerCase();

const isValidFarmLocation = (location) => {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
};

const isCompleteFarmAddress = (location) =>
  Boolean(
    String(location?.address || "").trim() &&
      String(location?.district || "").trim() &&
      String(location?.state || "").trim()
  );

const employeeCanReviewFarmer = (employee, farmer) => {
  if (employee.role === "admin") return true;
  if (employee.role !== "verification_employee") return false;

  const assignedState = normalizeArea(employee.verificationArea?.state);
  const assignedDistricts = (employee.verificationArea?.districts || [])
    .map(normalizeArea)
    .filter(Boolean);

  const farmerState = normalizeArea(
    farmer.verificationDocuments?.farmLocation?.state
  );
  const farmerDistrict = normalizeArea(
    farmer.verificationDocuments?.farmLocation?.district
  );

  if (!assignedState || !farmerState || assignedState !== farmerState) {
    return false;
  }

  return assignedDistricts.length === 0 || assignedDistricts.includes(farmerDistrict);
};

const createSignedPreviewUrl = (media) => {
  if (!media) return "";

  const item = toPlainObject(media);
  if (!item.publicId) return item.url || "";

  // Unit/integration tests intentionally run without Cloudinary secrets. Avoid
  // noisy SDK warnings there. Production returns no private preview unless the
  // secure Cloudinary configuration is actually present.
  if (!cloudinaryConfigured) {
    return process.env.NODE_ENV === "test" ? item.url || "" : "";
  }

  try {
    return cloudinary.url(item.publicId, {
      secure: true,
      sign_url: true,
      type: item.deliveryType || "authenticated",
      resource_type: item.resourceType || "image",
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Unable to create verification preview URL:", error.message);
    }
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

const deactivateSellerProducts = async (sellerId) => {
  await Product.updateMany(
    { seller: sellerId, isActive: true },
    { $set: { isActive: false } }
  );
};

const hasCompleteVerificationEvidence = (farmer) => {
  const documents = farmer.verificationDocuments;
  return (
    hasMedia(documents?.aadhaarFront) &&
    hasMedia(documents?.aadhaarBack) &&
    hasMedia(documents?.farmPhoto) &&
    hasMedia(documents?.farmingVideo) &&
    isValidFarmLocation(documents?.farmLocation) &&
    isCompleteFarmAddress(documents?.farmLocation)
  );
};

// Farmer submits evidence/location for manual local review.
router.post("/verify/submit", protect, authorize("farmer"), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "Farmer account not found" });

    if (user.verificationStatus === "verified") {
      return res.status(400).json({ error: "Your account is already verified." });
    }
    if (user.verificationStatus === "suspended") {
      return res.status(403).json({ error: "Your account has been suspended." });
    }

    const { farmLocation, additionalNotes } = req.body;
    const existingDocuments = toPlainObject(user.verificationDocuments);

    if (!hasMedia(existingDocuments.aadhaarFront)) {
      return res.status(400).json({ error: "Aadhaar front photo is required." });
    }
    if (!hasMedia(existingDocuments.aadhaarBack)) {
      return res.status(400).json({ error: "Aadhaar back photo is required." });
    }
    if (!hasMedia(existingDocuments.farmPhoto)) {
      return res.status(400).json({ error: "A current farm photo is required." });
    }
    if (!hasMedia(existingDocuments.farmingVideo)) {
      return res.status(400).json({ error: "A farming verification video is required." });
    }

    const nextLocation = farmLocation || existingDocuments.farmLocation;
    if (!isValidFarmLocation(nextLocation)) {
      return res.status(400).json({
        error: "Valid non-zero farm GPS latitude and longitude are required.",
      });
    }
    if (!isCompleteFarmAddress(nextLocation)) {
      return res.status(400).json({
        error: "Farm address, district and state are required for manual verification.",
      });
    }

    const normalizedLocation = {
      latitude: Number(nextLocation.latitude),
      longitude: Number(nextLocation.longitude),
      address: String(nextLocation.address || "").trim(),
      village: String(nextLocation.village || "").trim(),
      district: String(nextLocation.district || "").trim(),
      state: String(nextLocation.state || "").trim(),
      pincode: String(nextLocation.pincode || "").trim(),
    };

    user.verificationDocuments = {
      ...existingDocuments,
      farmLocation: normalizedLocation,
      submittedAt: new Date(),
      additionalNotes: String(additionalNotes || "").trim(),
    };
    user.verificationStatus = "pending";
    user.isVerified = false;
    user.farmerVerification = {
      ...toPlainObject(user.farmerVerification),
      status: "pending",
      submittedAt: new Date(),
      reviewNotes: "",
    };
    user.adminReview = {
      reviewedBy: undefined,
      reviewedAt: undefined,
      notes: "",
      rejectionReason: "",
      moreInfoRequest: "",
    };
    user.location = {
      type: "Point",
      coordinates: [normalizedLocation.longitude, normalizedLocation.latitude],
    };

    // If this is a resubmission after a previous approval/rejection cycle,
    // products stay hidden until a reviewer approves the farmer again.
    await deactivateSellerProducts(user._id);
    await user.save();

    return res.json({
      success: true,
      message:
        "Verification submitted. An AgroConnect verification employee assigned to your area will manually review your evidence.",
      verificationStatus: user.verificationStatus,
    });
  } catch (err) {
    return res.status(500).json({ error: "Error submitting verification: " + err.message });
  }
});

// Admin sees all farmers; verification employees see only assigned state/district.
router.get(
  "/verify/pending",
  protect,
  authorize("admin", "verification_employee"),
  async (req, res) => {
    try {
      const requestedStatus = String(req.query.status || "pending");
      const filterStatus = VERIFICATION_STATUSES.includes(requestedStatus)
        ? requestedStatus
        : "pending";

      let farmers = await User.find({
        role: "farmer",
        verificationStatus: filterStatus,
      })
        .select("-password -resetPasswordToken -resetPasswordExpire -bankAccount")
        .sort({ "verificationDocuments.submittedAt": -1 });

      if (req.user.role === "verification_employee") {
        if (!String(req.user.verificationArea?.state || "").trim()) {
          return res.status(403).json({
            error: "No verification area is assigned to this employee account.",
          });
        }
        farmers = farmers.filter((farmer) => employeeCanReviewFarmer(req.user, farmer));
      }

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
  }
);

router.put(
  "/verify/:id",
  protect,
  authorize("admin", "verification_employee"),
  async (req, res) => {
    try {
      const { action, notes, rejectionReason, moreInfoRequest } = req.body;
      const validActions = ["verified", "rejected", "more_information_required"];
      if (req.user.role === "admin") validActions.push("suspended");

      if (!validActions.includes(action)) {
        return res.status(400).json({ error: "Invalid verification action." });
      }

      const farmer = await User.findById(req.params.id);
      if (!farmer) return res.status(404).json({ error: "Farmer not found" });
      if (farmer.role !== "farmer") {
        return res.status(400).json({ error: "User is not a farmer" });
      }

      if (!employeeCanReviewFarmer(req.user, farmer)) {
        return res.status(403).json({
          error: "This farmer is outside your assigned verification area.",
        });
      }

      if (action === "verified" && !hasCompleteVerificationEvidence(farmer)) {
        return res.status(400).json({
          error:
            "Cannot approve: Aadhaar front/back, farm photo, farming video, valid GPS, farm address, district and state are all required.",
        });
      }

      farmer.verificationStatus = action;
      farmer.adminReview = {
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
        notes: String(notes || "").trim(),
        rejectionReason: String(rejectionReason || "").trim(),
        moreInfoRequest: String(moreInfoRequest || "").trim(),
      };
      farmer.farmerVerification = {
        ...toPlainObject(farmer.farmerVerification),
        status: action,
        reviewNotes: String(notes || rejectionReason || moreInfoRequest || "").trim(),
        verifiedAt: action === "verified" ? new Date() : undefined,
        verifiedBy: action === "verified" ? req.user._id : undefined,
      };

      if (action === "verified") {
        farmer.isVerified = true;
        farmer.isActive = true;
      } else {
        farmer.isVerified = false;
        await deactivateSellerProducts(farmer._id);
        if (action === "suspended") farmer.isActive = false;
      }

      await farmer.save();

      return res.json({
        success: true,
        message: `Farmer ${action === "verified" ? "approved" : action} successfully.`,
        farmer: farmer.getProfile(),
      });
    } catch (err) {
      return res.status(500).json({ error: "Error updating verification: " + err.message });
    }
  }
);

router.put("/:id/suspend", protect, authorize("admin"), async (req, res) => {
  try {
    const { action } = req.body;
    if (!["suspend", "activate"].includes(action)) {
      return res.status(400).json({ error: "Action must be suspend or activate" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (action === "suspend") {
      user.isActive = false;
      if (user.role === "farmer") {
        user.verificationStatus = "suspended";
        user.isVerified = false;
        user.farmerVerification = {
          ...toPlainObject(user.farmerVerification),
          status: "suspended",
          verifiedAt: undefined,
          verifiedBy: undefined,
        };
        await deactivateSellerProducts(user._id);
      } else if (user.role === "fertilizer_seller") {
        await deactivateSellerProducts(user._id);
      }
    } else {
      user.isActive = true;
      if (user.role === "farmer" && user.verificationStatus === "suspended") {
        // Reactivating the account does not restore trust automatically.
        user.verificationStatus = "more_information_required";
        user.isVerified = false;
        user.farmerVerification = {
          ...toPlainObject(user.farmerVerification),
          status: "more_information_required",
          reviewNotes: "Account reactivated; farmer verification must be reviewed again.",
        };
      }
    }

    await user.save();

    return res.json({
      success: true,
      message:
        action === "suspend"
          ? "User suspended successfully. Active seller listings were hidden."
          : "User activated successfully.",
      user: user.getProfile(),
    });
  } catch (err) {
    return res.status(500).json({ error: "Error updating user status: " + err.message });
  }
});

router.get("/role/:role", protect, authorize("admin"), async (req, res) => {
  try {
    const users = await User.find({ role: req.params.role }).select(
      "-password -resetPasswordToken -resetPasswordExpire"
    );

    return res.json({
      success: true,
      count: users.length,
      users: users.map((user) => user.getProfile()),
    });
  } catch (err) {
    return res.status(500).json({ error: "Error fetching users: " + err.message });
  }
});

router.get("/search/nearby", async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 5000, role = "farmer" } = req.query;
    const lng = Number(longitude);
    const lat = Number(latitude);
    const distance = Math.min(100000, Math.max(1, Number(maxDistance) || 5000));

    if (
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      lng < -180 ||
      lng > 180 ||
      lat < -90 ||
      lat > 90
    ) {
      return res.status(400).json({ error: "Valid longitude and latitude are required" });
    }

    if (!["farmer", "fertilizer_seller"].includes(role)) {
      return res.status(400).json({ error: "Invalid nearby-user role" });
    }

    const users = await User.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: distance,
        },
      },
      role,
      isActive: true,
      ...(role === "farmer" ? { verificationStatus: "verified" } : {}),
    });

    return res.json({
      success: true,
      count: users.length,
      users: users.map((user) => user.getPublicProfile()),
    });
  } catch (err) {
    return res.status(500).json({ error: "Error searching users: " + err.message });
  }
});

router.get("/:id", protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -resetPasswordToken -resetPasswordExpire"
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    const canViewPrivate =
      req.user._id.toString() === user._id.toString() || req.user.role === "admin";

    return res.json({
      success: true,
      user: canViewPrivate ? user.getProfile() : user.getPublicProfile(),
    });
  } catch (err) {
    return res.status(500).json({ error: "Error fetching user: " + err.message });
  }
});

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
      if (allowedFields.includes(key)) updates[key] = req.body[key];
    });

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({
      success: true,
      user: user.getProfile(),
      message: "Profile updated successfully",
    });
  } catch (err) {
    return res.status(500).json({ error: "Error updating profile: " + err.message });
  }
});

router.post("/:id/review", protect, async (req, res) => {
  try {
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim();

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: "You cannot review your own account" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const existingReview = user.reviews.find(
      (review) => review.reviewer.toString() === req.user._id.toString()
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
    user.rating =
      user.reviews.reduce((sum, review) => sum + Number(review.rating), 0) /
      user.reviews.length;
    user.totalReviews = user.reviews.length;
    await user.save();

    return res.status(201).json({
      success: true,
      message: "Review added successfully",
      user: user.getPublicProfile(),
    });
  } catch (err) {
    return res.status(500).json({ error: "Error adding review: " + err.message });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to delete this user" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (["farmer", "fertilizer_seller"].includes(user.role)) {
      await deactivateSellerProducts(user._id);
    }
    await User.findByIdAndDelete(user._id);

    return res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: "Error deleting user: " + err.message });
  }
});

module.exports = router;
