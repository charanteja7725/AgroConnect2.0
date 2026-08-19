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
    longitude <= 180
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

  // Empty districts means the employee covers the entire assigned state.
  return assignedDistricts.length === 0 || assignedDistricts.includes(farmerDistrict);
};

const createSignedPreviewUrl = (media) => {
  if (!media) return "";

  const item = toPlainObject(media);
  if (!item.publicId) return item.url || "";

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

// Farmer submits location/notes after the required evidence has already been
// uploaded and persisted by the protected Cloudinary upload endpoints.
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

    const { farmLocation, additionalNotes } = req.body;
    const existingDocuments = toPlainObject(user.verificationDocuments);

    // Never trust media metadata sent by the browser. Verification evidence
    // must exist in MongoDB because the server persisted it after Cloudinary
    // accepted the authenticated upload.
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
        error: "Valid farm GPS latitude and longitude are required.",
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
      ...(toPlainObject(user.farmerVerification)),
      status: "pending",
      submittedAt: new Date(),
      reviewNotes: "",
    };

    user.location = {
      type: "Point",
      coordinates: [normalizedLocation.longitude, normalizedLocation.latitude],
    };

    await user.save();

    return res.json({
      success: true,
      message:
        "Verification submitted. An AgroConnect verification employee assigned to your area will manually review your evidence.",
      verificationStatus: user.verificationStatus,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error submitting verification: " + err.message,
    });
  }
});

// Admins see all matching farmers. Verification employees only see farmers in
// their assigned state/district area.
router.get(
  "/verify/pending",
  protect,
  authorize("admin", "verification_employee"),
  async (req, res) => {
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

      if (req.user.role === "admin") {
        validActions.push("suspended");
      }

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

      if (action === "verified") {
        const documents = farmer.verificationDocuments;
        if (!hasMedia(documents?.aadhaarFront)) {
          return res.status(400).json({ error: "Cannot approve: Aadhaar front photo is missing." });
        }
        if (!hasMedia(documents?.aadhaarBack)) {
          return res.status(400).json({ error: "Cannot approve: Aadhaar back photo is missing." });
        }
        if (!hasMedia(documents?.farmPhoto)) {
          return res.status(400).json({ error: "Cannot approve: Farm photo is missing." });
        }
        if (!hasMedia(documents?.farmingVideo)) {
          return res.status(400).json({ error: "Cannot approve: Farming verification video is missing." });
        }
        if (!isValidFarmLocation(documents?.farmLocation) || !isCompleteFarmAddress(documents?.farmLocation)) {
          return res.status(400).json({ error: "Cannot approve: Complete farm location is missing." });
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
        verifiedAt: action === "verified" ? new Date() : farmer.farmerVerification?.verifiedAt,
        verifiedBy: action === "verified" ? req.user._id : farmer.farmerVerification?.verifiedBy,
      };

      if (action === "verified") {
        farmer.isVerified = true;
        farmer.isActive = true;
      } else {
        farmer.isVerified = false;
        if (action === "suspended") farmer.isActive = false;
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

    user.isActive = action === "activate";

    if (action === "suspend" && user.role === "farmer") {
      user.verificationStatus = "suspended";
      user.isVerified = false;
      user.farmerVerification = {
        ...(toPlainObject(user.farmerVerification)),
        status: "suspended",
      };
    }

    await user.save();

    return res.json({
      success: true,
      message: `User ${action === "suspend" ? "suspended" : "activated"} successfully.`,
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
      users: users.map((u) => u.getProfile()),
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

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
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
      users: users.map((u) => u.getPublicProfile()),
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
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: "You cannot review your own account" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const existingReview = user.reviews.find(
      (r) => r.reviewer.toString() === req.user._id.toString()
    );
    if (existingReview) {
      return res.status(400).json({ error: "You have already reviewed this user" });
    }

    user.reviews.push({ reviewer: req.user._id, rating, comment, createdAt: new Date() });
    user.rating = user.reviews.reduce((sum, r) => sum + r.rating, 0) / user.reviews.length;
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

    await User.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: "Error deleting user: " + err.message });
  }
});

module.exports = router;
