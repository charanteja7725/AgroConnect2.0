const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const mediaDocumentSchema = new mongoose.Schema(
  {
    url: String,
    publicId: String,
    resourceType: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    deliveryType: {
      type: String,
      default: "authenticated",
    },
    uploadedAt: Date,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
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
      select: false,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
    },

    role: {
      type: String,
      enum: [
        "farmer",
        "buyer",
        "fertilizer_seller",
        "delivery_partner",
        "verification_employee",
        "admin",
      ],
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
        type: [Number],
        default: [0, 0],
      },
    },

    businessName: String,
    businessRegistration: String,
    farmSize: String,
    farmType: String,
    experienceYears: Number,
    certifications: [String],

    bankAccount: {
      accountHolderName: String,
      accountNumber: String,
      ifscCode: String,
      bankName: String,
    },

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

    isVerified: {
      type: Boolean,
      default: false,
    },

    farmerVerification: {
      status: {
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

    // Verification employees are created by admins and can only review
    // farmers whose submitted farm location falls inside this assigned area.
    verificationArea: {
      state: {
        type: String,
        trim: true,
        default: "",
      },
      districts: {
        type: [String],
        default: [],
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpire: Date,

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
      aadhaarFront: mediaDocumentSchema,
      aadhaarBack: mediaDocumentSchema,
      farmPhoto: mediaDocumentSchema,
      farmingVideo: mediaDocumentSchema,
      farmLocation: {
        latitude: Number,
        longitude: Number,
        address: String,
        village: String,
        district: String,
        state: String,
        pincode: String,
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
userSchema.index({
  role: 1,
  verificationStatus: 1,
  "verificationDocuments.farmLocation.state": 1,
  "verificationDocuments.farmLocation.district": 1,
});

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

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.getProfile = function () {
  const userObj = this.toObject();
  delete userObj.password;
  delete userObj.resetPasswordToken;
  delete userObj.resetPasswordExpire;
  delete userObj.verificationToken;
  return userObj;
};

// Public profile intentionally excludes contact details, exact home address,
// bank data, identity evidence and internal verification/admin information.
userSchema.methods.getPublicProfile = function () {
  return {
    _id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    role: this.role,
    avatar: this.avatar,
    bio: this.bio,
    businessName: this.businessName,
    farmSize: this.farmSize,
    farmType: this.farmType,
    experienceYears: this.experienceYears,
    certifications: this.certifications || [],
    rating: this.rating,
    totalReviews: this.totalReviews,
    isVerified: this.isVerified,
    city: this.address?.city || "",
    state: this.address?.state || "",
  };
};

module.exports = mongoose.model("User", userSchema);
