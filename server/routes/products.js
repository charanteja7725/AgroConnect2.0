const express = require("express");
const Product = require("../models/Product");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   POST /api/products
// @desc    Create a new product
// @access  Private/Farmer
router.post("/", protect, authorize("farmer", "fertilizer_seller"), async (req, res) => {
  try {
    const user = req.user;

    const roleVerificationStatus =
      user.role === "farmer"
        ? user.farmerVerification?.status
        : user.role === "fertilizer_seller"
        ? user.sellerVerification?.status
        : "verified";

    if (["farmer", "fertilizer_seller"].includes(user.role) && roleVerificationStatus !== "verified") {
      return res.status(403).json({
        error: `Your ${user.role === "farmer" ? "farmer" : "seller"} verification is not approved yet. Please complete verification first.`,
      });
    }

    const { name, description, type, category, price, quantity, unit, images, address, location, sellerName } = req.body;

    if (!name || !description || !type || !category || !price || !quantity) {
      return res.status(400).json({ error: "Please provide all required product fields" });
    }

    const product = await Product.create({
      name,
      description,
      type,
      category,
      seller: user._id,
      sellerName: sellerName || `${user.firstName} ${user.lastName}`,
      price,
      quantity,
      unit: unit || "kg",
      images: images || [],
      address,
      location: location || { type: "Point", coordinates: [0, 0] },
      isActive: true,
      inStock: true,
    });

    res.status(201).json({ success: true, product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// @route   GET /api/products
// @desc    Get all products with filtering, geolocation and sorting
// @access  Public
router.get("/", async (req, res) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      search,
      latitude,
      longitude,
      maxDistance,
      sortBy,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, parseInt(limit) || 20);
    const skip = (pageNum - 1) * pageSize;

    // -----------------------
    // Build Match Query
    // -----------------------

    const matchQuery = {
      isActive: true,
      inStock: true,
    };

    if (category) {
      matchQuery.category = category;
    }

    if (minPrice || maxPrice) {
      matchQuery.price = {};

      if (minPrice) matchQuery.price.$gte = parseFloat(minPrice);
      if (maxPrice) matchQuery.price.$lte = parseFloat(maxPrice);
    }

    if (search) {
      matchQuery.$text = {
        $search: search,
      };
    }

    // -----------------------
    // Sort Options
    // -----------------------

    let sortOptions = {};

    switch (sortBy) {
      case "price_low":
        sortOptions = { price: 1 };
        break;

      case "price_high":
        sortOptions = { price: -1 };
        break;

      case "rating":
        sortOptions = { rating: -1 };
        break;

      case "newest":
        sortOptions = { createdAt: -1 };
        break;

      default:
        sortOptions = { createdAt: -1 };
    }

    let products;
    let total = 0;

    // ==================================================
    // CASE 1 : User searching nearby products
    // ==================================================
    if (latitude && longitude) {
      const geoNearStage = {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          distanceField: "distance",
          spherical: true,
          maxDistance: parseInt(maxDistance) || 10000,
          query: matchQuery,
        },
      };

      const pipeline = [geoNearStage, { $sort: sortOptions }, { $skip: skip }, { $limit: pageSize }];

      products = await Product.aggregate(pipeline);
      await Product.populate(products, { path: "seller" });

      const countResult = await Product.aggregate([geoNearStage, { $count: "count" }]);
      total = countResult[0]?.count || 0;
    } else {
      total = await Product.countDocuments(matchQuery);
      products = await Product.find(matchQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(pageSize)
        .populate("seller");
    }

    res.json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / pageSize),
      products,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message,
    });
  }
});

// @route   GET /api/products/seller/:sellerId
// @desc    Get products for a specific seller
// @access  Public
router.get("/seller/:sellerId", async (req, res) => {
  try {
    const products = await Product.find({
      seller: req.params.sellerId,
      isActive: true,
      inStock: true,
    }).populate("seller");

    res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// @route   GET /api/products/:id
// @desc    Get single product details
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("seller");
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ success: true, product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// @route   PUT /api/products/:id
// @desc    Update a product
// @access  Private/Farmer or Fertilizer Seller or Admin
router.put("/:id", protect, authorize("farmer", "fertilizer_seller", "admin"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.seller.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "You are not authorized to update this product" });
    }

    const allowedFields = [
      "name",
      "description",
      "type",
      "category",
      "price",
      "quantity",
      "unit",
      "images",
      "mainImage",
      "address",
      "location",
      "harvestDate",
      "organicCertified",
      "pesticidesUsed",
      "composition",
      "validUntil",
      "dosagePerAcre",
      "isActive",
      "inStock",
      "stockStatus",
      "aiSuggestedPrice",
      "aiSuggestionDate",
      "marketTrend",
      "tags",
      "metadata",
      "sellerName",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    if (req.body.location && Array.isArray(req.body.location.coordinates)) {
      product.location = {
        type: "Point",
        coordinates: [
          parseFloat(req.body.location.coordinates[0]),
          parseFloat(req.body.location.coordinates[1]),
        ],
      };
    }

    await product.save();

    res.json({ success: true, product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete a product
// @access  Private/Farmer or Fertilizer Seller or Admin
router.delete("/:id", protect, authorize("farmer", "fertilizer_seller", "admin"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.seller.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "You are not authorized to delete this product" });
    }

    await product.deleteOne();

    res.json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// @route   POST /api/products/:id/review
// @desc    Add review to a product
// @access  Private
router.post("/:id/review", protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.seller.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: "You cannot review your own product" });
    }

    const existingReview = product.reviews.find(
      (review) => review.reviewer.toString() === req.user._id.toString()
    );
    if (existingReview) {
      return res.status(400).json({ error: "You have already reviewed this product" });
    }

    product.reviews.push({
      reviewer: req.user._id,
      rating,
      comment: comment || "",
      createdAt: new Date(),
    });
    product.reviewCount = product.reviews.length;
    product.rating =
      product.reviews.reduce((total, review) => total + review.rating, 0) /
      product.reviews.length;

    await product.save();

    res.status(201).json({ success: true, product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
