const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();
const storage = multer.memoryStorage();

const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

const cloudinaryCloudName =
  process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME || "";

cloudinary.config({
  cloud_name: cloudinaryCloudName,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const VERIFICATION_FIELDS = {
  aadhaarFront: { resourceType: "image", label: "Aadhaar front image" },
  aadhaarBack: { resourceType: "image", label: "Aadhaar back image" },
  farmPhoto: { resourceType: "image", label: "Farm photo" },
  farmingVideo: { resourceType: "video", label: "Farming video" },
};

const ensureCloudinaryConfigured = () => {
  if (!cloudinaryCloudName) {
    throw new Error("Cloudinary cloud name is not configured on the server");
  }
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary API credentials are not fully configured on the server");
  }
};

const ensureFarmerCanReplaceEvidence = async (userId) => {
  const currentUser = await User.findById(userId).select("verificationStatus");
  if (!currentUser) throw new Error("Farmer account not found");
  if (currentUser.verificationStatus === "verified") {
    throw new Error("Verified farmer evidence cannot be replaced without admin review");
  }
  if (currentUser.verificationStatus === "suspended") {
    throw new Error("Suspended farmer accounts cannot upload verification evidence");
  }
};

const persistVerificationMedia = async (userId, field, uploadResult, resourceType) => {
  await ensureFarmerCanReplaceEvidence(userId);

  const media = {
    url: uploadResult.secure_url || "",
    publicId: uploadResult.public_id,
    resourceType,
    deliveryType: "authenticated",
    uploadedAt: new Date(),
  };

  await User.findByIdAndUpdate(userId, {
    $set: { [`verificationDocuments.${field}`]: media },
  });

  return media;
};

const uploadBuffer = (file, folder, resourceType = "image") => {
  ensureCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        timeout: 120000,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Cloudinary returned no upload result"));
        return resolve(result);
      }
    );

    uploadStream.on("error", reject);
    uploadStream.end(file.buffer);
  });
};

// Product images are still sent through the backend because they are small
// public assets. Farmer identity/farm evidence uses the signed direct-upload
// flow below so large videos do not pass through Express/Render first.
router.post(
  "/image",
  protect,
  authorize("farmer", "fertilizer_seller"),
  imageUpload.single("image"),
  async (req, res) => {
    try {
      if (!req.file || !req.file.buffer?.length) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      const uploadResult = await uploadBuffer(
        req.file,
        "agroconnect/products",
        "image"
      );

      return res.json({
        success: true,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      });
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      const timedOut = err?.http_code === 499 || /timeout/i.test(err?.message || "");
      return res.status(timedOut ? 504 : 500).json({
        error: timedOut
          ? "Media upload timed out. Please retry with a smaller image."
          : err.message || "Error uploading image",
      });
    }
  }
);

// Step 1 of private verification upload.
// The browser receives a short-lived signature but NEVER receives the API secret.
router.post(
  "/verification/signature",
  protect,
  authorize("farmer"),
  async (req, res) => {
    try {
      ensureCloudinaryConfigured();
      await ensureFarmerCanReplaceEvidence(req.user._id);

      const field = String(req.body.field || "");
      const config = VERIFICATION_FIELDS[field];
      if (!config) {
        return res.status(400).json({ error: "Invalid verification media field" });
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const folder = `agroconnect/verification/${req.user._id}/${field}`;
      const type = "authenticated";
      const paramsToSign = { folder, timestamp, type };
      const signature = cloudinary.utils.api_sign_request(
        paramsToSign,
        process.env.CLOUDINARY_API_SECRET
      );

      return res.json({
        success: true,
        cloudName: cloudinaryCloudName,
        apiKey: process.env.CLOUDINARY_API_KEY,
        timestamp,
        signature,
        folder,
        type,
        resourceType: config.resourceType,
      });
    } catch (err) {
      return res.status(500).json({
        error: err.message || "Unable to create verification upload signature",
      });
    }
  }
);

// Step 2: after Cloudinary receives the file directly from the browser,
// verify the asset server-side before saving its metadata to the farmer account.
router.post(
  "/verification/complete",
  protect,
  authorize("farmer"),
  async (req, res) => {
    try {
      ensureCloudinaryConfigured();
      await ensureFarmerCanReplaceEvidence(req.user._id);

      const field = String(req.body.field || "");
      const publicId = String(req.body.publicId || "").trim();
      const config = VERIFICATION_FIELDS[field];

      if (!config || !publicId) {
        return res.status(400).json({
          error: "Verification field and uploaded asset ID are required",
        });
      }

      const expectedPrefix = `agroconnect/verification/${req.user._id}/${field}/`;
      if (!publicId.startsWith(expectedPrefix)) {
        return res.status(400).json({ error: "Uploaded verification asset is invalid" });
      }

      const asset = await cloudinary.api.resource(publicId, {
        resource_type: config.resourceType,
        type: "authenticated",
      });

      if (!asset || !asset.public_id || Number(asset.bytes || 0) <= 0) {
        return res.status(400).json({ error: "Uploaded verification file is empty or unavailable" });
      }

      const media = await persistVerificationMedia(
        req.user._id,
        field,
        asset,
        config.resourceType
      );

      return res.json({ success: true, ...media });
    } catch (err) {
      console.error("Verification upload completion error:", err);
      const notFound = Number(err?.http_code) === 404;
      return res.status(notFound ? 400 : 500).json({
        error: notFound
          ? "Cloudinary could not find the uploaded verification file"
          : err.message || "Unable to save verification upload",
      });
    }
  }
);

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: err.code === "LIMIT_FILE_SIZE" ? "Uploaded file is too large" : err.message,
    });
  }

  if (err) {
    return res.status(400).json({ error: err.message || "Invalid upload" });
  }

  next();
});

module.exports = router;
