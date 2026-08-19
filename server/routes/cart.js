const express = require("express");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();
const shopperOnly = [protect, authorize("buyer", "farmer")];

const populateCart = (query) =>
  query
    .populate("items.product")
    .populate("items.seller", "_id firstName lastName businessName role");

const recalculateCart = (cart) => {
  cart.totalQuantity = cart.items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );
  cart.totalPrice = cart.items.reduce(
    (sum, item) => sum + (Number(item.totalPrice) || 0),
    0
  );
  cart.lastUpdated = new Date();
};

const validateShopperProduct = (user, product) => {
  if (!product) return "Product not found";
  if (!product.isActive || !product.inStock || Number(product.quantity) <= 0) {
    return "Product is not currently available";
  }
  if (product.seller?.toString() === user._id.toString()) {
    return "You cannot add your own product to your cart";
  }
  if (user.role === "farmer" && product.type !== "fertilizer") {
    return "Farmer accounts can purchase fertilizer-store products only";
  }
  return "";
};

router.get("/", ...shopperOnly, async (req, res) => {
  try {
    let cart = await populateCart(Cart.findOne({ user: req.user._id }));

    if (!cart) {
      await Cart.create({ user: req.user._id, items: [] });
      cart = await populateCart(Cart.findOne({ user: req.user._id }));
    }

    return res.json({ success: true, cart });
  } catch (err) {
    return res.status(500).json({ error: "Error fetching cart: " + err.message });
  }
});

router.post("/add", ...shopperOnly, async (req, res) => {
  try {
    const { productId } = req.body;
    const quantity = Number(req.body.quantity);

    if (!productId || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        error: "Product ID and a positive whole-number quantity are required",
      });
    }

    const product = await Product.findById(productId);
    const productError = validateShopperProduct(req.user, product);
    if (productError) {
      const status = product ? (req.user.role === "farmer" && product.type !== "fertilizer" ? 403 : 400) : 404;
      return res.status(status).json({ error: productError });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = new Cart({ user: req.user._id, items: [] });

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId.toString()
    );
    const nextQuantity = (existingItem?.quantity || 0) + quantity;

    if (nextQuantity > Number(product.quantity)) {
      return res.status(400).json({
        error: `Only ${product.quantity} ${product.unit || "units"} available`,
      });
    }

    if (existingItem) {
      existingItem.quantity = nextQuantity;
      existingItem.price = product.price;
      existingItem.totalPrice = nextQuantity * Number(product.price);
      existingItem.seller = product.seller;
    } else {
      cart.items.push({
        product: product._id,
        seller: product.seller,
        quantity,
        price: product.price,
        totalPrice: Number(product.price) * quantity,
      });
    }

    recalculateCart(cart);
    await cart.save();

    const populated = await populateCart(Cart.findById(cart._id));
    return res.status(201).json({
      success: true,
      cart: populated,
      message: "Product added to cart",
    });
  } catch (err) {
    return res.status(500).json({ error: "Error adding to cart: " + err.message });
  }
});

router.put("/update/:itemId", ...shopperOnly, async (req, res) => {
  try {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: "A positive whole-number quantity is required" });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    const item = cart.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: "Item not found in cart" });

    const product = await Product.findById(item.product);
    const productError = validateShopperProduct(req.user, product);
    if (productError) {
      const status = product ? (req.user.role === "farmer" && product.type !== "fertilizer" ? 403 : 400) : 404;
      return res.status(status).json({ error: productError });
    }

    if (quantity > Number(product.quantity)) {
      return res.status(400).json({
        error: `Only ${product.quantity} ${product.unit || "units"} available`,
      });
    }

    item.quantity = quantity;
    item.price = product.price;
    item.totalPrice = Number(product.price) * quantity;
    item.seller = product.seller;
    recalculateCart(cart);
    await cart.save();

    const populated = await populateCart(Cart.findById(cart._id));
    return res.json({ success: true, cart: populated, message: "Cart item updated" });
  } catch (err) {
    return res.status(500).json({ error: "Error updating cart: " + err.message });
  }
});

router.delete("/remove/:itemId", ...shopperOnly, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    const before = cart.items.length;
    cart.items = cart.items.filter((item) => item._id.toString() !== req.params.itemId);
    if (cart.items.length === before) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    recalculateCart(cart);
    await cart.save();

    const populated = await populateCart(Cart.findById(cart._id));
    return res.json({ success: true, cart: populated, message: "Item removed from cart" });
  } catch (err) {
    return res.status(500).json({ error: "Error removing item: " + err.message });
  }
});

router.delete("/clear", ...shopperOnly, async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { items: [], totalQuantity: 0, totalPrice: 0, lastUpdated: new Date() }
    );
    return res.json({ success: true, message: "Cart cleared successfully" });
  } catch (err) {
    return res.status(500).json({ error: "Error clearing cart: " + err.message });
  }
});

module.exports = router;
