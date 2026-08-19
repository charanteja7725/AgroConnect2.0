const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
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

const uploadBuffer = async (file, folder) => {
  ensureCloudinaryConfigured();
  const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  return cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "image",
  });
};

router.post(
  "/image",
  protect,
  authorize("farmer", "fertilizer_seller"),
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      const uploadResult = await uploadBuffer(req.file, "agroconnect/products");

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

router.post(
  "/verification/farmer-id",
  protect,
  authorize("farmer"),
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Farmer ID image is required" });
      }

      const uploadResult = await uploadBuffer(
        req.file,
        `agroconnect/verification/${req.user._id}/farmer-id`
      );

      return res.json({
        success: true,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      });
    } catch (err) {
      console.error("Farmer ID upload error:", err);
      return res.status(500).json({ error: err.message || "Error uploading farmer ID" });
    }
  }
);

router.post(
  "/verification/farm-photo",
  protect,
  authorize("farmer"),
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Farm photo is required" });
      }

      const uploadResult = await uploadBuffer(
        req.file,
        `agroconnect/verification/${req.user._id}/farm-photo`
      );

      return res.json({
        success: true,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      });
    } catch (err) {
      console.error("Farm photo upload error:", err);
      return res.status(500).json({ error: err.message || "Error uploading farm photo" });
    }
  }
);

module.exports = router;
