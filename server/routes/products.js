const express = require("express");
const Product = require("../models/Product");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// ======================================================
// GET /api/products
// Get all products with filtering and pagination
// Public
// ======================================================

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
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(limit) || 20)
    );

    const skip = (pageNum - 1) * pageSize;

    let query = {
      isActive: true,
      inStock: true,
    };

    // Product type filter
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

      if (minPrice) {
        query.price.$gte = parseFloat(minPrice);
      }

      if (maxPrice) {
        query.price.$lte = parseFloat(maxPrice);
      }
    }

    // Search
    if (search) {
      query.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          description: {
            $regex: search,
            $options: "i",
          },
        },
        {
          category: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    // ==================================================
    // GEOLOCATION SEARCH
    // ==================================================

    if (latitude && longitude) {
      const parsedLatitude = parseFloat(latitude);
      const parsedLongitude = parseFloat(longitude);

      if (
        !Number.isFinite(parsedLatitude) ||
        !Number.isFinite(parsedLongitude)
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid latitude or longitude",
        });
      }

      const matchStage = {
        isActive: true,
        inStock: true,

        ...(req.query.type
          ? {
              type: req.query.type,
            }
          : {}),

        ...(category
          ? {
              category,
            }
          : {}),

        ...(minPrice || maxPrice
          ? {
              price: {
                ...(minPrice
                  ? {
                      $gte: parseFloat(minPrice),
                    }
                  : {}),

                ...(maxPrice
                  ? {
                      $lte: parseFloat(maxPrice),
                    }
                  : {}),
              },
            }
          : {}),

        ...(search
          ? {
              $or: [
                {
                  name: {
                    $regex: search,
                    $options: "i",
                  },
                },
                {
                  description: {
                    $regex: search,
                    $options: "i",
                  },
                },
                {
                  category: {
                    $regex: search,
                    $options: "i",
                  },
                },
              ],
            }
          : {}),
      };

      const parsedMaxDistance =
        parseInt(maxDistance) || 50000;

      const geoPipeline = [
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [
                parsedLongitude,
                parsedLatitude,
              ],
            },

            distanceField: "distance",

            maxDistance: parsedMaxDistance,

            spherical: true,

            query: matchStage,
          },
        },

        {
          $skip: skip,
        },

        {
          $limit: pageSize,
        },

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

      const products =
        await Product.aggregate(geoPipeline);

      const countPipeline = [
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [
                parsedLongitude,
                parsedLatitude,
              ],
            },

            distanceField: "distance",

            maxDistance: parsedMaxDistance,

            spherical: true,

            query: matchStage,
          },
        },

        {
          $count: "count",
        },
      ];

      const countResult =
        await Product.aggregate(countPipeline);

      const total =
        countResult[0]?.count || 0;

      return res.status(200).json({
        success: true,
        count: products.length,
        total,
        page: pageNum,
        pages: Math.ceil(total / pageSize),
        products,
      });
    }

    // ==================================================
    // NORMAL PRODUCT QUERY
    // ==================================================

    let sortOptions = {
      createdAt: -1,
    };

    if (sortBy === "price_low") {
      sortOptions = {
        price: 1,
      };
    }

    if (sortBy === "price_high") {
      sortOptions = {
        price: -1,
      };
    }

    if (sortBy === "rating") {
      sortOptions = {
        rating: -1,
      };
    }

    if (sortBy === "newest") {
      sortOptions = {
        createdAt: -1,
      };
    }

    const total =
      await Product.countDocuments(query);

    const products = await Product.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(pageSize)
      .populate("seller");

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / pageSize),
      products,
    });
  } catch (err) {
    console.error(
      "Error fetching products:",
      err
    );

    return res.status(500).json({
      success: false,
      error:
        "Error fetching products: " +
        err.message,
    });
  }
});

// ======================================================
// GET /api/products/seller/:sellerId
// Get products belonging to seller
// Public
// ======================================================

router.get(
  "/seller/:sellerId",
  async (req, res) => {
    try {
      const products =
        await Product.find({
          seller: req.params.sellerId,
          isActive: true,
        }).sort({
          createdAt: -1,
        });

      return res.status(200).json({
        success: true,
        count: products.length,
        products,
      });
    } catch (err) {
      console.error(
        "Error fetching seller products:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          "Error fetching products: " +
          err.message,
      });
    }
  }
);

// ======================================================
// GET /api/products/:id
// Get single product
// Public
// ======================================================

router.get("/:id", async (req, res) => {
  try {
    const product =
      await Product.findByIdAndUpdate(
        req.params.id,
        {
          $inc: {
            totalViews: 1,
          },
        },
        {
          new: true,
        }
      ).populate("seller");

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (err) {
    console.error(
      "Error fetching product:",
      err
    );

    return res.status(500).json({
      success: false,
      error:
        "Error fetching product: " +
        err.message,
    });
  }
});

// ======================================================
// POST /api/products
// Create new product
// Farmer / Fertilizer Seller
// ======================================================

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

      // ==================================================
      // VALIDATE REQUIRED FIELDS
      // ==================================================

      if (
        !name ||
        !description ||
        !type ||
        !category ||
        price === undefined ||
        quantity === undefined
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Please provide all required fields",
        });
      }

      // ==================================================
      // GET CURRENT SELLER
      // ==================================================

      const seller = await User.findById(
        req.user._id
      );

      if (!seller) {
        return res.status(404).json({
          success: false,
          error: "Seller account not found",
        });
      }

      // ==================================================
      // FARMER VERIFICATION GATE
      // ==================================================

      // Farmers MUST be verified before creating products.
      // Fertilizer sellers are handled separately.

      if (
        req.user.role === "farmer" &&
        seller.verificationStatus !== "verified"
      ) {
        return res.status(403).json({
          success: false,
          error:
            "Your farmer account must be verified and approved before you can create products.",
        });
      }

      // ==================================================
      // LOCATION
      // ==================================================

      let geoCoords = [0, 0];
      let locationProvided = false;

      if (
        location &&
        Array.isArray(
          location.coordinates
        ) &&
        location.coordinates.length === 2 &&
        location.coordinates.every(
          (coordinate) =>
            typeof coordinate === "number" &&
            Number.isFinite(coordinate)
        )
      ) {
        geoCoords = [
          Number(location.coordinates[0]),
          Number(location.coordinates[1]),
        ];

        locationProvided = true;
      }

      const geoLocation = {
        type: "Point",
        coordinates: geoCoords,

        address:
          location?.address ||
          address ||
          "",
      };

      // ==================================================
      // CREATE PRODUCT
      // ==================================================

      const product = new Product({
        name,
        description,
        type,
        category,
        price,
        quantity,

        unit: unit || "kg",

        images: images || [],

        address:
          location?.address ||
          address ||
          "",

        location: geoLocation,

        seller: req.user._id,

        sellerName: [
          req.user.firstName,
          req.user.lastName,
        ]
          .filter(Boolean)
          .join(" "),

        mainImage:
          images &&
          images.length > 0 &&
          images[0]?.url
            ? images[0].url
            : null,

        // Verified seller can publish if location exists.
        // Otherwise save as draft until location is supplied.
        isActive: locationProvided,

        inStock: true,

        ...(composition
          ? {
              composition,
            }
          : {}),
      });

      await product.save();

      // ==================================================
      // UPDATE SELLER PRODUCT COUNT
      // ==================================================

      await User.findByIdAndUpdate(
        req.user._id,
        {
          $inc: {
            totalProducts: 1,
          },
        }
      );

      let message =
        "Product created successfully";

      if (!locationProvided) {
        message =
          "Product saved as draft. Add your GPS location to publish it.";
      }

      return res.status(201).json({
        success: true,
        product,
        message,
        isPublished: product.isActive,
      });
    } catch (err) {
      console.error(
        "Error creating product:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          "Error creating product: " +
          err.message,
      });
    }
  }
);

// ======================================================
// PUT /api/products/:id
// Update product
// Product owner / Admin
// ======================================================

router.put(
  "/:id",
  protect,
  async (req, res) => {
    try {
      let product =
        await Product.findById(
          req.params.id
        );

      if (!product) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      // Check ownership
      if (
        product.seller.toString() !==
          req.user._id.toString() &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error:
            "Not authorized to update this product",
        });
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

      Object.keys(req.body).forEach(
        (key) => {
          if (
            allowedFields.includes(key)
          ) {
            updates[key] =
              req.body[key];
          }
        }
      );

      // ==================================================
      // PREVENT UNVERIFIED FARMER FROM PUBLISHING
      // ==================================================

      if (
        req.user.role === "farmer" &&
        updates.isActive === true
      ) {
        const seller =
          await User.findById(
            req.user._id
          );

        if (
          !seller ||
          seller.verificationStatus !==
            "verified"
        ) {
          return res.status(403).json({
            success: false,
            error:
              "Your farmer account must be verified and approved before publishing products.",
          });
        }
      }

      product =
        await Product.findByIdAndUpdate(
          req.params.id,
          updates,
          {
            new: true,
            runValidators: true,
          }
        );

      return res.status(200).json({
        success: true,
        product,
        message:
          "Product updated successfully",
      });
    } catch (err) {
      console.error(
        "Error updating product:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          "Error updating product: " +
          err.message,
      });
    }
  }
);

// ======================================================
// DELETE /api/products/:id
// Delete product
// Product owner / Admin
// ======================================================

router.delete(
  "/:id",
  protect,
  async (req, res) => {
    try {
      const product =
        await Product.findById(
          req.params.id
        );

      if (!product) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      if (
        product.seller.toString() !==
          req.user._id.toString() &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          error:
            "Not authorized to delete this product",
        });
      }

      await Product.findByIdAndDelete(
        req.params.id
      );

      // Only update product count for actual owner
      if (
        product.seller.toString() ===
        req.user._id.toString()
      ) {
        await User.findByIdAndUpdate(
          req.user._id,
          {
            $inc: {
              totalProducts: -1,
            },
          }
        );
      }

      return res.status(200).json({
        success: true,
        message:
          "Product deleted successfully",
      });
    } catch (err) {
      console.error(
        "Error deleting product:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          "Error deleting product: " +
          err.message,
      });
    }
  }
);

// ======================================================
// POST /api/products/:id/review
// Add product review
// Private
// ======================================================

router.post(
  "/:id/review",
  protect,
  async (req, res) => {
    try {
      const {
        rating,
        comment,
      } = req.body;

      const numericRating =
        Number(rating);

      if (
        !numericRating ||
        numericRating < 1 ||
        numericRating > 5
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Rating must be between 1 and 5",
        });
      }

      const product =
        await Product.findById(
          req.params.id
        );

      if (!product) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      // Prevent seller reviewing own product
      if (
        product.seller.toString() ===
        req.user._id.toString()
      ) {
        return res.status(400).json({
          success: false,
          error:
            "You cannot review your own product",
        });
      }

      // Prevent duplicate reviews
      const existingReview =
        product.reviews.find(
          (review) =>
            review.reviewer.toString() ===
            req.user._id.toString()
        );

      if (existingReview) {
        return res.status(400).json({
          success: false,
          error:
            "You have already reviewed this product",
        });
      }

      product.reviews.push({
        reviewer: req.user._id,
        rating: numericRating,
        comment,
        verified: true,
        createdAt: new Date(),
      });

      // Calculate rating average
      const totalRating =
        product.reviews.reduce(
          (sum, review) =>
            sum +
            Number(review.rating),
          0
        );

      product.rating =
        totalRating /
        product.reviews.length;

      product.reviewCount =
        product.reviews.length;

      await product.save();

      return res.status(201).json({
        success: true,
        message:
          "Review added successfully",
        product,
      });
    } catch (err) {
      console.error(
        "Error adding review:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          "Error adding review: " +
          err.message,
      });
    }
  }
);

// ======================================================
// EXPORT ROUTER
// ======================================================

module.exports = router;