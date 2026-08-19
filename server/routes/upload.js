const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const os = require("os");
const path = require("path");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

const cloudinaryCloudName =
  process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME || "";

cloudinary.config({
  cloud_name: cloudinaryCloudName,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

const persistVerificationMedia = async (
  userId,
  field,
  uploadResult,
  resourceType
) => {
  await ensureFarmerCanReplaceEvidence(userId);

  if (!uploadResult?.public_id || Number(uploadResult?.bytes || 0) <= 0) {
    throw new Error("Cloudinary returned an empty upload result");
  }

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

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    return cb(null, true);
  },
});

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").slice(0, 10);
    const random = Math.random().toString(36).slice(2);
    cb(
      null,
      `agroconnect-verification-${req.user?._id || "farmer"}-${Date.now()}-${random}${extension}`
    );
  },
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith("video/")) {
      return cb(new Error("Only video files are allowed"));
    }
    return cb(null, true);
  },
});

const uploadImageBuffer = (
  file,
  folder,
  deliveryType = "upload"
) => {
  ensureCloudinaryConfigured();

  if (!file?.buffer?.length) {
    return Promise.reject(new Error("Uploaded image is empty"));
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (error, result) => {
      if (settled) return;
      settled = true;

      if (error) return reject(error);

      if (!result?.public_id || Number(result?.bytes || 0) <= 0) {
        return reject(new Error("Cloudinary returned an empty image result"));
      }

      return resolve(result);
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        type: deliveryType,
        timeout: 180000,
      },
      finish
    );

    uploadStream.once("error", (error) => finish(error));
    uploadStream.end(file.buffer);
  });
};

const uploadVideoFile = (filePath, folder) => {
  ensureCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (error, result) => {
      if (settled) return;

      if (error) {
        settled = true;
        return reject(error);
      }

      if (result?.done === false) return;

      settled = true;

      if (!result?.public_id || Number(result?.bytes || 0) <= 0) {
        return reject(new Error("Cloudinary returned an empty video result"));
      }

      return resolve(result);
    };

    try {
      const uploadStream = cloudinary.uploader.upload_large(
        filePath,
        {
          folder,
          resource_type: "video",
          type: "authenticated",
          chunk_size: 6 * 1024 * 1024,
          timeout: 600000,
        },
        finish
      );

      if (uploadStream?.once) {
        uploadStream.once("error", (error) => finish(error));
      }
    } catch (error) {
      finish(error);
    }
  });
};

const sendUploadError = (res, label, error) => {
  console.error(`${label} upload error:`, error);

  const message = String(error?.message || "");
  const timedOut = Number(error?.http_code) === 499 || /timeout/i.test(message);

  if (timedOut) {
    return res.status(504).json({
      error: `${label} upload timed out. Try a shorter or smaller file and submit again.`,
    });
  }

  return res.status(500).json({
    error: message || `Unable to upload ${label}`,
  });
};

router.post(
  "/image",
  protect,
  authorize("farmer", "fertilizer_seller"),
  imageUpload.single("image"),
  async (req, res) => {
    try {
      if (!req.file?.buffer?.length) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      const result = await uploadImageBuffer(
        req.file,
        "agroconnect/products",
        "upload"
      );

      return res.json({
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
      });
    } catch (error) {
      return sendUploadError(res, "Product image", error);
    }
  }
);

const createVerificationImageRoute = ({ routePath, field, label }) => {
  router.post(
    routePath,
    protect,
    authorize("farmer"),
    imageUpload.single("file"),
    async (req, res) => {
      try {
        if (!req.file?.buffer?.length) {
          return res.status(400).json({ error: `${label} is empty or missing` });
        }

        await ensureFarmerCanReplaceEvidence(req.user._id);

        const result = await uploadImageBuffer(
          req.file,
          `agroconnect/verification/${req.user._id}/${field}`,
          "authenticated"
        );

        const media = await persistVerificationMedia(
          req.user._id,
          field,
          result,
          "image"
        );

        return res.json({ success: true, ...media });
      } catch (error) {
        return sendUploadError(res, label, error);
      }
    }
  );
};

createVerificationImageRoute({
  routePath: "/verification/aadhaar-front",
  field: "aadhaarFront",
  label: "Aadhaar front image",
});

createVerificationImageRoute({
  routePath: "/verification/aadhaar-back",
  field: "aadhaarBack",
  label: "Aadhaar back image",
});

createVerificationImageRoute({
  routePath: "/verification/farm-photo",
  field: "farmPhoto",
  label: "Farm photo",
});

router.post(
  "/verification/farming-video",
  protect,
  authorize("farmer"),
  videoUpload.single("file"),
  async (req, res) => {
    const temporaryPath = req.file?.path;

    try {
      if (!temporaryPath || !req.file?.size) {
        return res.status(400).json({ error: "Farming video is empty or missing" });
      }

      await ensureFarmerCanReplaceEvidence(req.user._id);

      const result = await uploadVideoFile(
        temporaryPath,
        `agroconnect/verification/${req.user._id}/farmingVideo`
      );

      const media = await persistVerificationMedia(
        req.user._id,
        "farmingVideo",
        result,
        "video"
      );

      return res.json({ success: true, ...media });
    } catch (error) {
      return sendUploadError(res, "Farming video", error);
    } finally {
      if (temporaryPath) {
        fs.promises.unlink(temporaryPath).catch(() => {});
      }
    }
  }
);

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

  return next();
});

module.exports = router;
