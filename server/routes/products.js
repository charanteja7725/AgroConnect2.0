const express = require("express");
const Product = require("../models/Product");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/products
// @desc    Get all products with filtering and pagination
// @access  Public
router.get("/", async (req, res) => {
  try {
    const { category, minPrice, maxPrice, search, latitude, longitude, maxDistance, sortBy, page = 1, limit = 20 } =
      req.query;

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * pageSize;

    let query = { isActive: true, inStock: true };

    // Type filter
    if (req.query.type) {
      query.type = req.query.type;
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Price filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Geolocation filter
    let products = [];
    if (latitude && longitude) {
      // Use aggregation pipeline for geospatial queries. $geoNear must be the first stage.
      const matchStage = {
        isActive: true,
        inStock: true,
        ...(req.query.type ? { type: req.query.type } : {}),
        ...(category && { category }),
        ...(minPrice || maxPrice
          ? {
              price: {
                ...(minPrice && { $gte: parseFloat(minPrice) }),
                ...(maxPrice && { $lte: parseFloat(maxPrice) }),
              },
            }
          : {}),
        ...(search ? { $text: { $search: search } } : {}),
      };

      const geoPipeline = [
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [parseFloat(longitude), parseFloat(latitude)],
            },
            distanceField: "distance",
            maxDistance: parseInt(maxDistance) || 50000,
            spherical: true,
            query: matchStage,
          },
        },
        { $skip: skip },
        { $limit: pageSize },
        {
          $lookup: {
            from: "users",
            localField: "seller",
            foreignField: "_id",
            as: "seller",
          },
        },
        {
          $unwind: {
            path: "$seller",
            preserveNullAndEmptyArrays: true,
          },
        },
      ];

      products = await Product.aggregate(geoPipeline);

      const countPipeline = [
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [parseFloat(longitude), parseFloat(latitude)],
            },
            distanceField: "distance",
            maxDistance: parseInt(maxDistance) || 50000,
            spherical: true,
            query: matchStage,
          },
        },
        { $count: "count" },
      ];
      const countResult = await Product.aggregate(countPipeline);
      const total = countResult[0]?.count || 0;

      return res.json({
        success: true,
        count: products.length,
        total,
        page: pageNum,
        pages: Math.ceil(total / pageSize),
        products,
      });
    }

    // Non-geospatial query
    let sortOptions = { createdAt: -1 };
    if (sortBy === "price_low") sortOptions = { price: 1 };
    if (sortBy === "price_high") sortOptions = { price: -1 };
    if (sortBy === "rating") sortOptions = { rating: -1 };
    if (sortBy === "newest") sortOptions = { createdAt: -1 };

    const total = await Product.countDocuments(query);
    const queryProducts = await Product.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(pageSize)
      .populate("seller");

    products = queryProducts;

    res.json({
      success: true,
      count: products.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / pageSize),
      products,
    });

  } catch (err) {
    res.status(500).json({ error: "Error fetching products: " + err.message });
  }
});

// @route   GET /api/products/seller/:sellerId
// @desc    Get all products of a seller
// @access  Public
router.get("/seller/:sellerId", async (req, res) => {
  try {
    const products = await Product.find({
      seller: req.params.sellerId,
      isActive: true,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching products: " + err.message });
  }
});

// @route   GET /api/products/:id
// @desc    Get single product
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { totalViews: 1 } },
      { new: true }
    ).populate("seller");

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({
      success: true,
      product,
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching product: " + err.message });
  }
});

// @route   POST /api/products
// @desc    Create new product
// @access  Private (Farmer/Fertilizer Seller)
router.post("/", protect, authorize("farmer", "fertilizer_seller"), async (req, res) => {
  try {
    const { name, description, type, category, price, quantity, unit, images, address, location } =
      req.body;

    // Validate required fields
    if (!name || !description || !type || !category || !price || !quantity) {
      return res.status(400).json({ error: "Please provide all required fields" });
    }

    if (
      !location ||
      !Array.isArray(location.coordinates) ||
      location.coordinates.length !== 2 ||
      !location.coordinates.every((coord) => typeof coord === "number" && Number.isFinite(coord))
    ) {
      return res.status(400).json({
        error: "Product location is required. Please use current location.",
      });
    }

    const geoLocation = {
      type: "Point",
      coordinates: [Number(location.coordinates[0]), Number(location.coordinates[1])],
      address: location.address || address || "",
    };

    const product = new Product({
      name,
      description,
      type,
      category,
      price,
      quantity,
      unit,
      images,
      address: location.address || address || "",
      location: geoLocation,
      seller: req.user._id,
      sellerName: `${req.user.firstName} ${req.user.lastName}`,
      mainImage: images && images[0]?.url ? images[0].url : "https://via.placeholder.com/300",
    });

    await product.save();

    // Update user total products
    await User.findByIdAndUpdate(req.user._id, { $inc: { totalProducts: 1 } });

    res.status(201).json({
      success: true,
      product,
      message: "Product created successfully",
    });
  } catch (err) {
    res.status(500).json({ error: "Error creating product: " + err.message });
  }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private (Product Owner)
router.put("/:id", protect, async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check if user is product owner or admin
    if (product.seller.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to update this product" });
    }

    const allowedFields = [
      "name",
      "description",
      "price",
      "quantity",
      "unit",
      "category",
      "images",
      "address",
      "location",
      "isActive",
    ];

    const updates = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      product,
      message: "Product updated successfully",
    });
  } catch (err) {
    res.status(500).json({ error: "Error updating product: " + err.message });
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete product
// @access  Private (Product Owner/Admin)
router.delete("/:id", protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.seller.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to delete this product" });
    }

    await Product.findByIdAndDelete(req.params.id);

    // Update user total products
    await User.findByIdAndUpdate(req.user._id, { $inc: { totalProducts: -1 } });

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ error: "Error deleting product: " + err.message });
  }
});

// @route   POST /api/products/:id/review
// @desc    Add review to product
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

    // Prevent self-review
    if (product.seller.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: "You cannot review your own product" });
    }

    // Check for duplicate reviews from same user
    const existingReview = product.reviews.find(
      (r) => r.reviewer.toString() === req.user._id.toString()
    );

    if (existingReview) {
      return res.status(400).json({ error: "You have already reviewed this product" });
    }

    product.reviews.push({
      reviewer: req.user._id,
      rating,
      comment,
      verified: true,
      createdAt: new Date(),
    });

    // Recalculate average rating
    const avgRating = product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length;
    product.rating = avgRating;
    product.reviewCount = product.reviews.length;

    await product.save();

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      product,
    });
  } catch (err) {
    res.status(500).json({ error: "Error adding review: " + err.message });
  }
});

module.exports = router;
