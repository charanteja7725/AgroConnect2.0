const express = require("express");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

const FARMER_VERIFICATION_API_URL =
  process.env.FARMER_VERIFICATION_API_URL ||
  "https://kycapizone.in/api/v3/agristack/newcard.php";

const normalizeProviderFarmer = (payload = {}) => {
  const details =
    payload?.result?.farmer_details ||
    payload?.data?.farmer_details ||
    payload?.result?.farmer ||
    payload?.data?.farmer ||
    payload?.farmer_details ||
    payload?.data ||
    payload?.result ||
    payload;

  return {
    farmerName:
      details?.farmerName ||
      details?.farmer_name ||
      details?.name ||
      "",
    farmerNumber:
      details?.farmerNumber ||
      details?.farmer_number ||
      details?.farmerId ||
      details?.farmer_id ||
      "",
    centralId:
      details?.centralId ||
      details?.central_id ||
      details?.centralID ||
      "",
    approvalStatus:
      details?.approvalStatus ||
      details?.approval_status ||
      details?.approval ||
      "",
    registrationStatus:
      details?.registrationStatus ||
      details?.registration_status ||
      details?.status ||
      "",
  };
};

const providerResultIsVerified = (farmer) => {
  const approval = String(farmer.approvalStatus || "");
  const registration = String(farmer.registrationStatus || "");

  return (
    /approved|verified/i.test(approval) &&
    /registered|active|verified/i.test(registration)
  );
};

// ─────────────────────────────────────────────────────────────────
// FARMER VERIFICATION ROUTES
// ─────────────────────────────────────────────────────────────────

// @route   POST /api/users/verify/check-registry
// @desc    Check a Farmer ID/Enrollment Number with the configured registry provider
// @access  Private (Farmer only)
router.post(
  "/verify/check-registry",
  protect,
  authorize("farmer"),
  async (req, res) => {
    try {
      const { idType = "centralid", farmerId } = req.body;
      const allowedTypes = ["centralid", "enrollmentnumber"];

      if (!allowedTypes.includes(idType)) {
        return res.status(400).json({
          error: "Invalid ID type. Use centralid or enrollmentnumber.",
        });
      }

      if (!farmerId || !String(farmerId).trim()) {
        return res.status(400).json({ error: "Farmer ID is required" });
      }

      if (!process.env.APIZONE_API_KEY) {
        return res.status(500).json({
          error: "Farmer verification API is not configured on the server",
        });
      }

      const url = new URL(FARMER_VERIFICATION_API_URL);
      url.searchParams.set("api_key", process.env.APIZONE_API_KEY);
      url.searchParams.set("id_type", idType);
      url.searchParams.set("id", String(farmerId).trim());

      const providerResponse = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      let providerPayload;
      try {
        providerPayload = await providerResponse.json();
      } catch (parseError) {
        return res.status(502).json({
          error: "Farmer verification provider returned an invalid response",
        });
      }

      if (!providerResponse.ok) {
        return res.status(502).json({
          error:
            providerPayload?.message ||
            providerPayload?.error ||
            "Farmer verification provider request failed",
        });
      }

      const farmer = normalizeProviderFarmer(providerPayload);
      const apiVerified = providerResultIsVerified(farmer);
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({ error: "Farmer account not found" });
      }

      user.farmerVerification = {
        ...(user.farmerVerification?.toObject?.() || user.farmerVerification || {}),
        idType,
        farmerId: String(farmerId).trim(),
        farmerName: farmer.farmerName,
        farmerNumber: farmer.farmerNumber,
        centralId: farmer.centralId,
        approvalStatus: farmer.approvalStatus,
        registrationStatus: farmer.registrationStatus,
        apiVerified,
        provider: "API_ZONE_AGRISTACK",
        source: FARMER_VERIFICATION_API_URL,
        apiCheckedAt: new Date(),
      };

      if (!apiVerified && user.verificationStatus !== "verified") {
        user.verificationStatus = "more_information_required";
      }

      await user.save();

      return res.status(200).json({
        success: true,
        verified: apiVerified,
        farmer,
        verificationStatus: user.verificationStatus,
        message: apiVerified
          ? "Farmer registration verified. Upload the farmer ID document and a current farm photo to continue."
          : "The supplied ID could not be confirmed as an approved active farmer registration.",
      });
    } catch (err) {
      console.error("Farmer registry verification error:", err);
      return res.status(500).json({
        error: "Error verifying farmer registration: " + err.message,
      });
    }
  }
);

// @route   POST /api/users/verify/submit
// @desc    Farmer submits verification request after registry and document checks
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
      additionalNotes,
      gpsLatitude,
      gpsLongitude,
      farmerIdUrl,
      farmerIdPublicId,
      farmPhotoUrl,
      farmPhotoPublicId,
    } = req.body;

    if (!user.farmerVerification?.apiVerified) {
      return res.status(400).json({
        error: "Verify your Farmer ID with the government registry before submitting.",
      });
    }

    const existingFarmerIdUrl = user.verificationDocuments?.farmerId?.url;
    const existingFarmPhotoUrl = user.verificationDocuments?.farmPhoto?.url;

    if (!farmerIdUrl && !existingFarmerIdUrl) {
      return res.status(400).json({
        error: "A government-certified Farmer ID image is required.",
      });
    }

    if (!farmPhotoUrl && !existingFarmPhotoUrl) {
      return res.status(400).json({
        error: "A current farm photo is required.",
      });
    }

    user.verificationStatus = "pending";
    user.verificationDocuments = {
      ...(user.verificationDocuments?.toObject?.() || user.verificationDocuments || {}),
      farmerId: farmerIdUrl
        ? {
            url: farmerIdUrl,
            publicId: farmerIdPublicId || "",
            uploadedAt: new Date(),
          }
        : user.verificationDocuments?.farmerId,
      farmPhoto: farmPhotoUrl
        ? {
            url: farmPhotoUrl,
            publicId: farmPhotoPublicId || "",
            uploadedAt: new Date(),
          }
        : user.verificationDocuments?.farmPhoto,
      gpsCoordinates:
        gpsLatitude !== undefined && gpsLongitude !== undefined
          ? {
              latitude: parseFloat(gpsLatitude),
              longitude: parseFloat(gpsLongitude),
            }
          : user.verificationDocuments?.gpsCoordinates,
      submittedAt: new Date(),
      additionalNotes: additionalNotes || "",
    };

    user.farmerVerification.status = "pending";
    user.farmerVerification.identityDocumentUrl =
      farmerIdUrl || existingFarmerIdUrl || "";
    user.farmerVerification.farmPhotoUrl =
      farmPhotoUrl || existingFarmPhotoUrl || "";
    user.farmerVerification.submittedAt = new Date();

    await user.save();

    return res.json({
      success: true,
      message:
        "Verification submitted. Your registry check passed and the documents are now waiting for admin review.",
      verificationStatus: user.verificationStatus,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error submitting verification: " + err.message,
    });
  }
});

// @route   GET /api/users/verify/pending
// @desc    Get farmers by verification status (admin only)
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
      farmers: farmers.map((u) => u.getProfile()),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error fetching pending verifications: " + err.message,
    });
  }
});

// @route   PUT /api/users/verify/:id
// @desc    Admin approves/rejects farmer verification
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
      if (!farmer.farmerVerification?.apiVerified) {
        return res.status(400).json({
          error: "Cannot approve: Farmer ID has not passed registry verification.",
        });
      }
      if (!farmer.verificationDocuments?.farmerId?.url) {
        return res.status(400).json({
          error: "Cannot approve: Farmer ID document is missing.",
        });
      }
      if (!farmer.verificationDocuments?.farmPhoto?.url) {
        return res.status(400).json({
          error: "Cannot approve: Farm photo is missing.",
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

    farmer.farmerVerification.status = action;
    farmer.farmerVerification.reviewNotes = notes || rejectionReason || moreInfoRequest || "";

    if (action === "verified") {
      farmer.isVerified = true;
      farmer.farmerVerification.verifiedAt = new Date();
      farmer.farmerVerification.verifiedBy = req.user._id;
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
    return res.status(500).json({ error: "Error fetching users: " + err.message });
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
    return res.status(500).json({ error: "Error searching users: " + err.message });
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
    return res.status(500).json({ error: "Error fetching user: " + err.message });
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
    return res.status(500).json({ error: "Error updating profile: " + err.message });
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
    return res.status(500).json({ error: "Error adding review: " + err.message });
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
    return res.status(500).json({ error: "Error deleting user: " + err.message });
  }
});

module.exports = router;
