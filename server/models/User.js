const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // Basic Information
    firstName: {
      type: String,
      required: [true, "Please provide a first name"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Please provide a last name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: 6,
      select: false, // Don't return password by default
    },
    phone: {
      type: String,
      required: true,
      unique: true,
    },

    // Role and Profile
    role: {
      type: String,
      enum: ["farmer", "buyer", "fertilizer_seller", "delivery_partner", "admin"],
      required: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: "",
    },

    // Location
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },

    // Business Information (for farmers and sellers)
    businessName: String,
    businessRegistration: String,
    farmSize: String, // For farmers
    farmType: String, // For farmers
    experienceYears: Number,
    certifications: [String],

    // Bank Details
    bankAccount: {
      accountHolderName: String,
      accountNumber: String,
      ifscCode: String,
      bankName: String,
    },

    // Ratings and Reviews
    rating: {
      type: Number,
      default: 5,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    reviews: [
      {
        reviewer: mongoose.Schema.Types.ObjectId,
        rating: Number,
        comment: String,
        createdAt: Date,
      },
    ],

    // Statistics
    totalEarnings: {
      type: Number,
      default: 0,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalProducts: {
      type: Number,
      default: 0,
    },
    completionRate: {
      type: Number,
      default: 100,
    },

    // Status
    isVerified: {
      type: Boolean,
      default: false,
    },
    farmerVerification: {
      status: {
        type: String,
        enum: ["not_submitted", "pending", "more_information_required", "verified", "rejected", "suspended"],
        default: "not_submitted",
      },
      identityDocumentUrl: String,
      farmingProofUrl: String,
      farmPhotoUrl: String,
      farmerId: String,
      farmLocation: {
        latitude: Number,
        longitude: Number,
      },
      submittedAt: Date,
      verifiedAt: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      reviewNotes: String,
    },
    sellerVerification: {
      status: {
        type: String,
        enum: ["not_submitted", "pending", "verified", "rejected", "suspended"],
        default: "not_submitted",
      },
      identityDocumentUrl: String,
      shopCertificateUrl: String,
      shopPhotoUrl: String,
      sellerId: String,
      shopName: String,
      shopLocation: {
        latitude: Number,
        longitude: Number,
      },
      submittedAt: Date,
      verifiedAt: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      reviewNotes: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    // Farmer Verification System
    verificationStatus: {
      type: String,
      enum: [
        "not_submitted",
        "pending",
        "more_information_required",
        "verified",
        "rejected",
        "suspended",
      ],
      default: "not_submitted",
    },
    verificationDocuments: {
      governmentId: { url: String, publicId: String, uploadedAt: Date },
      farmerId: { url: String, publicId: String, uploadedAt: Date },
      farmPhoto: { url: String, publicId: String, uploadedAt: Date },
      gpsCoordinates: {
        latitude: Number,
        longitude: Number,
      },
      submittedAt: Date,
      additionalNotes: String,
    },
    adminReview: {
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reviewedAt: Date,
      notes: String,
      rejectionReason: String,
      moreInfoRequest: String,
    },

    // Preferences
    language: {
      type: String,
      enum: ["en", "hi", "es", "fr"],
      default: "en",
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ location: "2dsphere" });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to get user profile (without sensitive data)
userSchema.methods.getProfile = function () {
  const userObj = this.toObject();
  delete userObj.password;
  delete userObj.resetPasswordToken;
  delete userObj.resetPasswordExpire;
  return userObj;
};

module.exports = mongoose.model("User", userSchema);
