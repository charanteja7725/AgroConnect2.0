const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

      if (!process.env.CLOUDINARY_CLOUD_NAME && !process.env.CLOUDINARY_NAME) {
        return res.status(500).json({ error: "Cloudinary cloud name is not configured on the server" });
      }
      if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        return res.status(500).json({ error: "Cloudinary API credentials are not fully configured on the server" });
      }

      const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      const uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder: "agroconnect/products",
        resource_type: "image",
      });

      res.json({
        success: true,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      });
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      res.status(500).json({ error: "Error uploading image" });
    }
  }
);

module.exports = router;
