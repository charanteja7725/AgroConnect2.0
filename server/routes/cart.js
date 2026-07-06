const express = require("express");
const { Cart } = require("../models/Order");
const Product = require("../models/Product");
const { protect } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/cart
// @desc    Get user's cart
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate("items.product");

    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
      await cart.save();
    }

    res.json({
      success: true,
      cart,
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching cart: " + err.message });
  }
});

// @route   POST /api/cart/add
// @desc    Add product to cart
// @access  Private
router.post("/add", protect, async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ error: "Product ID and valid quantity are required" });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.quantity === 0) {
      return res.status(400).json({ error: "Product is out of stock" });
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // Check if product already in cart
    const existingItem = cart.items.find((item) => item.product.toString() === productId);

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.totalPrice = existingItem.quantity * existingItem.price;
    } else {
      cart.items.push({
        product: productId,
        seller: product.seller,
        quantity,
        price: product.price,
        totalPrice: product.price * quantity,
      });
    }

    // Recalculate totals
    cart.totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    cart.lastUpdated = new Date();

    await cart.save();

    res.status(201).json({
      success: true,
      cart,
      message: "Product added to cart",
    });
  } catch (err) {
    res.status(500).json({ error: "Error adding to cart: " + err.message });
  }
});

// @route   PUT /api/cart/update/:itemId
// @desc    Update cart item quantity
// @access  Private
router.put("/update/:itemId", protect, async (req, res) => {
  try {
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: "Valid quantity is required" });
    }

    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    const item = cart.items.find((i) => i._id.toString() === req.params.itemId);

    if (!item) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    const product = await Product.findById(item.product);

    if (product.quantity < quantity) {
      return res.status(400).json({ error: "Insufficient product quantity available" });
    }

    item.quantity = quantity;
    item.totalPrice = item.price * quantity;

    // Recalculate totals
    cart.totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    cart.lastUpdated = new Date();

    await cart.save();

    res.json({
      success: true,
      cart,
      message: "Cart item updated",
    });
  } catch (err) {
    res.status(500).json({ error: "Error updating cart: " + err.message });
  }
});

// @route   DELETE /api/cart/remove/:itemId
// @desc    Remove product from cart
// @access  Private
router.delete("/remove/:itemId", protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    cart.items = cart.items.filter((item) => item._id.toString() !== req.params.itemId);

    // Recalculate totals
    cart.totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    cart.lastUpdated = new Date();

    await cart.save();

    res.json({
      success: true,
      cart,
      message: "Item removed from cart",
    });
  } catch (err) {
    res.status(500).json({ error: "Error removing item: " + err.message });
  }
});

// @route   DELETE /api/cart/clear
// @desc    Clear entire cart
// @access  Private
router.delete("/clear", protect, async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { items: [], totalQuantity: 0, totalPrice: 0 }
    );

    res.json({
      success: true,
      message: "Cart cleared successfully",
    });
  } catch (err) {
    res.status(500).json({ error: "Error clearing cart: " + err.message });
  }
});

module.exports = router;
