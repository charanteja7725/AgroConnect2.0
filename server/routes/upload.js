const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
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

const uploadBuffer = async (
  file,
  folder,
  resourceType = "image",
  deliveryType = "upload"
) => {
  ensureCloudinaryConfigured();

  const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

  return cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: resourceType,
    type: deliveryType,
  });
};

const verificationResponse = (uploadResult, resourceType) => ({
  success: true,
  url: uploadResult.secure_url || "",
  publicId: uploadResult.public_id,
  resourceType,
  deliveryType: "authenticated",
});

// Normal product image upload.
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
      return res.status(500).json({ error: err.message || "Error uploading image" });
    }
  }
);

// Aadhaar and verification evidence are stored as authenticated Cloudinary
// assets so they are not normal public product media.
router.post(
  "/verification/aadhaar-front",
  protect,
  authorize("farmer"),
  imageUpload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Aadhaar front image is required" });
      }

      const result = await uploadBuffer(
        req.file,
        `agroconnect/verification/${req.user._id}/aadhaar-front`,
        "image",
        "authenticated"
      );

      return res.json(verificationResponse(result, "image"));
    } catch (err) {
      console.error("Aadhaar front upload error:", err);
      return res.status(500).json({ error: err.message || "Error uploading Aadhaar front" });
    }
  }
);

router.post(
  "/verification/aadhaar-back",
  protect,
  authorize("farmer"),
  imageUpload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Aadhaar back image is required" });
      }

      const result = await uploadBuffer(
        req.file,
        `agroconnect/verification/${req.user._id}/aadhaar-back`,
        "image",
        "authenticated"
      );

      return res.json(verificationResponse(result, "image"));
    } catch (err) {
      console.error("Aadhaar back upload error:", err);
      return res.status(500).json({ error: err.message || "Error uploading Aadhaar back" });
    }
  }
);

router.post(
  "/verification/farm-photo",
  protect,
  authorize("farmer"),
  imageUpload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Farm photo is required" });
      }

      const result = await uploadBuffer(
        req.file,
        `agroconnect/verification/${req.user._id}/farm-photo`,
        "image",
        "authenticated"
      );

      return res.json(verificationResponse(result, "image"));
    } catch (err) {
      console.error("Farm photo upload error:", err);
      return res.status(500).json({ error: err.message || "Error uploading farm photo" });
    }
  }
);

router.post(
  "/verification/farming-video",
  protect,
  authorize("farmer"),
  videoUpload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Farming video is required" });
      }

      const result = await uploadBuffer(
        req.file,
        `agroconnect/verification/${req.user._id}/farming-video`,
        "video",
        "authenticated"
      );

      return res.json(verificationResponse(result, "video"));
    } catch (err) {
      console.error("Farming video upload error:", err);
      return res.status(500).json({ error: err.message || "Error uploading farming video" });
    }
  }
);

// Multer errors are converted to readable JSON responses instead of the
// default HTML error page.
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error:
        err.code === "LIMIT_FILE_SIZE"
          ? "Uploaded file is too large"
          : err.message,
    });
  }

  if (err) {
    return res.status(400).json({ error: err.message || "Invalid upload" });
  }

  next();
});

module.exports = router;
