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

const videoUpload = multer({
  storage,
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new Error("Only video files are allowed"));
    }
    cb(null, true);
  },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ensureCloudinaryConfigured = () => {
  if (!process.env.CLOUDINARY_CLOUD_NAME && !process.env.CLOUDINARY_NAME) {
    throw new Error("Cloudinary cloud name is not configured on the server");
  }
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary API credentials are not fully configured on the server");
  }
};

// Stream upload buffers to Cloudinary instead of converting them to base64.
// Base64 increases payload size substantially and made larger farming videos
// much more likely to hit Cloudinary/hosting request timeouts.
const uploadBuffer = (
  file,
  folder,
  resourceType = "image",
  deliveryType = "upload"
) => {
  ensureCloudinaryConfigured();

  const timeout = resourceType === "video" ? 300000 : 120000;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        type: deliveryType,
        timeout,
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

const persistVerificationMedia = async (userId, field, uploadResult, resourceType) => {
  const media = {
    url: uploadResult.secure_url || "",
    publicId: uploadResult.public_id,
    resourceType,
    deliveryType: "authenticated",
    uploadedAt: new Date(),
  };

  const currentUser = await User.findById(userId).select("verificationStatus");
  if (!currentUser) throw new Error("Farmer account not found");
  if (currentUser.verificationStatus === "verified") {
    throw new Error("Verified farmer evidence cannot be replaced without admin review");
  }
  if (currentUser.verificationStatus === "suspended") {
    throw new Error("Suspended farmer accounts cannot upload verification evidence");
  }

  await User.findByIdAndUpdate(userId, {
    $set: { [`verificationDocuments.${field}`]: media },
  });

  return media;
};

router.post(
  "/image",
  protect,
  authorize("farmer", "fertilizer_seller"),
  imageUpload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      const uploadResult = await uploadBuffer(
        req.file,
        "agroconnect/products",
        "image",
        "upload"
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
          ? "Media upload timed out. Please retry with a shorter or smaller file."
          : err.message || "Error uploading image",
      });
    }
  }
);

const createVerificationUploadRoute = ({ path, field, label, resourceType, middleware }) => {
  router.post(
    path,
    protect,
    authorize("farmer"),
    middleware.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: `${label} is required` });
        }

        const result = await uploadBuffer(
          req.file,
          `agroconnect/verification/${req.user._id}/${field}`,
          resourceType,
          "authenticated"
        );

        const media = await persistVerificationMedia(
          req.user._id,
          field,
          result,
          resourceType
        );

        return res.json({ success: true, ...media });
      } catch (err) {
        console.error(`${label} upload error:`, err);
        const timedOut = err?.http_code === 499 || /timeout/i.test(err?.message || "");
        return res.status(timedOut ? 504 : 500).json({
          error: timedOut
            ? `${label} upload timed out. Please retry with a shorter or smaller file.`
            : err.message || `Error uploading ${label}`,
        });
      }
    }
  );
};

createVerificationUploadRoute({
  path: "/verification/aadhaar-front",
  field: "aadhaarFront",
  label: "Aadhaar front image",
  resourceType: "image",
  middleware: imageUpload,
});

createVerificationUploadRoute({
  path: "/verification/aadhaar-back",
  field: "aadhaarBack",
  label: "Aadhaar back image",
  resourceType: "image",
  middleware: imageUpload,
});

createVerificationUploadRoute({
  path: "/verification/farm-photo",
  field: "farmPhoto",
  label: "Farm photo",
  resourceType: "image",
  middleware: imageUpload,
});

createVerificationUploadRoute({
  path: "/verification/farming-video",
  field: "farmingVideo",
  label: "Farming video",
  resourceType: "video",
  middleware: videoUpload,
});

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
