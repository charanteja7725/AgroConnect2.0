const express = require("express");
const Product = require("../models/Product");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// Only these seller fields may leave a public product endpoint.
const PUBLIC_SELLER_FIELDS =
  "_id firstName lastName role avatar bio businessName farmSize farmType experienceYears certifications rating totalReviews isVerified";

const publicSellerShape = {
  _id: "$seller._id",
  firstName: "$seller.firstName",
  lastName: "$seller.lastName",
  role: "$seller.role",
  avatar: "$seller.avatar",
  bio: "$seller.bio",
  businessName: "$seller.businessName",
  farmSize: "$seller.farmSize",
  farmType: "$seller.farmType",
  experienceYears: "$seller.experienceYears",
  certifications: "$seller.certifications",
  rating: "$seller.rating",
  totalReviews: "$seller.totalReviews",
  isVerified: "$seller.isVerified",
};

const buildProductQuery = (req) => {
  const { category, minPrice, maxPrice, search } = req.query;
  const query = { isActive: true, inStock: true };

  if (req.query.type) query.type = req.query.type;
  if (category) query.category = category;

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
    ];
  }

  return query;
};

router.get("/", async (req, res) => {
  try {
    const { latitude, longitude, maxDistance, sortBy, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * pageSize;
    const query = buildProductQuery(req);

    if (latitude !== undefined || longitude !== undefined) {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ success: false, error: "Invalid latitude or longitude" });
      }

      const distance = Math.min(200000, Math.max(1, Number(maxDistance) || 50000));
      const geoNear = {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] },
          distanceField: "distance",
          maxDistance: distance,
          spherical: true,
          query,
        },
      };

      const products = await Product.aggregate([
        geoNear,
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
        { $unwind: { path: "$seller", preserveNullAndEmptyArrays: true } },
        // Replace the raw user document from $lookup with an explicit public
        // shape so bank data, contact details and verification evidence never
        // leave this public endpoint.
        { $set: { seller: publicSellerShape } },
      ]);

      const countResult = await Product.aggregate([geoNear, { $count: "count" }]);
      const total = countResult[0]?.count || 0;

      return res.status(200).json({
        success: true,
        count: products.length,
        total,
        page: pageNum,
        pages: Math.ceil(total / pageSize),
        products,
      });
    }

    let sortOptions = { createdAt: -1 };
    if (sortBy === "price_low") sortOptions = { price: 1 };
    if (sortBy === "price_high") sortOptions = { price: -1 };
    if (sortBy === "rating") sortOptions = { rating: -1 };

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(pageSize)
      .populate("seller", PUBLIC_SELLER_FIELDS);

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / pageSize),
      products,
    });
  } catch (err) {
    console.error("Error fetching products:", err);
    return res.status(500).json({ success: false, error: "Error fetching products: " + err.message });
  }
});

router.get("/seller/:sellerId", async (req, res) => {
  try {
    const products = await Product.find({
      seller: req.params.sellerId,
      isActive: true,
    }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: products.length, products });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error fetching products: " + err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { totalViews: 1 } },
      { new: true }
    ).populate("seller", PUBLIC_SELLER_FIELDS);

    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    return res.status(200).json({ success: true, product });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error fetching product: " + err.message });
  }
});

router.post(
  "/",
  protect,
  authorize("farmer", "fertilizer_seller"),
  async (req, res) => {
    try {
      const {
        name,
        description,
        type,
        category,
        price,
        quantity,
        unit,
        images,
        address,
        location,
        composition,
      } = req.body;

      if (!name || !description || !type || !category || price === undefined || quantity === undefined) {
        return res.status(400).json({ success: false, error: "Please provide all required fields" });
      }

      const numericPrice = Number(price);
      const numericQuantity = Number(quantity);
      if (!Number.isFinite(numericPrice) || numericPrice < 0 || !Number.isFinite(numericQuantity) || numericQuantity < 0) {
        return res.status(400).json({ success: false, error: "Price and quantity must be valid non-negative numbers" });
      }

      const seller = await User.findById(req.user._id);
      if (!seller) {
        return res.status(404).json({ success: false, error: "Seller account not found" });
      }

      if (req.user.role === "farmer" && seller.verificationStatus !== "verified") {
        return res.status(403).json({
          success: false,
          error: "Your farmer account must be verified and approved before you can create products.",
        });
      }

      let geoCoords = [0, 0];
      let locationProvided = false;
      if (
        location &&
        Array.isArray(location.coordinates) &&
        location.coordinates.length === 2 &&
        location.coordinates.every((coordinate) => Number.isFinite(Number(coordinate)))
      ) {
        geoCoords = [Number(location.coordinates[0]), Number(location.coordinates[1])];
        locationProvided = true;
      }

      const product = new Product({
        name,
        description,
        type,
        category,
        price: numericPrice,
        quantity: numericQuantity,
        unit: unit || "kg",
        images: images || [],
        address: location?.address || address || "",
        location: {
          type: "Point",
          coordinates: geoCoords,
          address: location?.address || address || "",
        },
        seller: req.user._id,
        sellerName: [req.user.firstName, req.user.lastName].filter(Boolean).join(" "),
        mainImage: images?.[0]?.url || null,
        isActive: locationProvided,
        inStock: numericQuantity > 0,
        ...(composition ? { composition } : {}),
      });

      await product.save();
      await User.findByIdAndUpdate(req.user._id, { $inc: { totalProducts: 1 } });

      return res.status(201).json({
        success: true,
        product,
        message: locationProvided
          ? "Product created successfully"
          : "Product saved as draft. Add your GPS location to publish it.",
        isPublished: product.isActive,
      });
    } catch (err) {
      console.error("Error creating product:", err);
      return res.status(500).json({ success: false, error: "Error creating product: " + err.message });
    }
  }
);

router.put("/:id", protect, async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });

    if (product.seller.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ success: false, error: "Not authorized to update this product" });
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
      if (allowedFields.includes(key)) updates[key] = req.body[key];
    });

    if (req.user.role === "farmer" && updates.isActive === true) {
      const seller = await User.findById(req.user._id);
      if (!seller || seller.verificationStatus !== "verified") {
        return res.status(403).json({
          success: false,
          error: "Your farmer account must be verified and approved before publishing products.",
        });
      }
    }

    product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({ success: true, product, message: "Product updated successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error updating product: " + err.message });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });

    if (product.seller.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ success: false, error: "Not authorized to delete this product" });
    }

    await Product.findByIdAndDelete(req.params.id);
    if (product.seller.toString() === req.user._id.toString()) {
      await User.findByIdAndUpdate(req.user._id, { $inc: { totalProducts: -1 } });
    }

    return res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error deleting product: " + err.message });
  }
});

router.post("/:id/review", protect, async (req, res) => {
  try {
    const numericRating = Number(req.body.rating);
    const comment = req.body.comment;

    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, error: "Rating must be between 1 and 5" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });

    if (product.seller.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: "You cannot review your own product" });
    }

    const existingReview = product.reviews.find(
      (review) => review.reviewer.toString() === req.user._id.toString()
    );
    if (existingReview) {
      return res.status(400).json({ success: false, error: "You have already reviewed this product" });
    }

    product.reviews.push({
      reviewer: req.user._id,
      rating: numericRating,
      comment,
      verified: true,
      createdAt: new Date(),
    });

    const totalRating = product.reviews.reduce((sum, review) => sum + Number(review.rating), 0);
    product.rating = totalRating / product.reviews.length;
    product.reviewCount = product.reviews.length;
    await product.save();

    return res.status(201).json({ success: true, message: "Review added successfully", product });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error adding review: " + err.message });
  }
});

module.exports = router;
