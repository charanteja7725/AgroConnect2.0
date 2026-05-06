const express = require("express");
const jwt = require("jsonwebtoken");
const { validationResult, body } = require("express-validator");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  "/register",
  [
    body("firstName").notEmpty().withMessage("First name is required"),
    body("lastName").notEmpty().withMessage("Last name is required"),
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("phone").notEmpty().withMessage("Phone is required"),
    body("role")
      .isIn(["farmer", "buyer", "fertilizer_seller", "delivery_partner"])
      .withMessage("Invalid role selected"),
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { firstName, lastName, email, password, phone, role, address, businessName } = req.body;

      // Check if user already exists by email or phone
      const existingUser = await User.findOne({
        $or: [{ email }, { phone }],
      });

      if (existingUser) {
        if (existingUser.email === email) {
          return res.status(400).json({ error: "User already exists with this email" });
        }
        return res.status(400).json({ error: "User already exists with this phone number" });
      }

      // Create new user
      const user = new User({
        firstName,
        lastName,
        email,
        password,
        phone,
        role,
        address,
        businessName,
        isVerified: false,
      });

      await user.save();

      // Generate token
      const token = generateToken(user._id);

      res.status(201).json({
        success: true,
        token,
        user: user.getProfile(),
        message: "User registered successfully",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error registering user: " + err.message });
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password } = req.body;

      // Validate email & password
      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check if password matches
      const isMatch = await user.comparePassword(password);

      if (!isMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({ error: "User account is deactivated" });
      }

      // Generate token
      const token = generateToken(user._id);

      res.json({
        success: true,
        token,
        user: user.getProfile(),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error logging in: " + err.message });
    }
  }
);

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      success: true,
      user: user.getProfile(),
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching user: " + err.message });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post("/logout", protect, (req, res) => {
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

// @route   POST /api/auth/forgot-password
// @desc    Forgot password
// @access  Public
router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("Please provide a valid email")],
  async (req, res) => {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Generate reset token
      const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpire = Date.now() + 1 * 60 * 60 * 1000; // 1 hour
      await user.save();

      // In production, send email with reset link
      // For now, return the token
      res.json({
        success: true,
        message: "Password reset email sent",
        resetToken: resetToken, // Remove in production
      });
    } catch (err) {
      res.status(500).json({ error: "Error processing password reset: " + err.message });
    }
  }
);

// @route   POST /api/auth/reset-password/:resetToken
// @desc    Reset password
// @access  Public
router.post("/reset-password/:resetToken", async (req, res) => {
  try {
    const { resetToken } = req.params;
    const { password } = req.body;

    // Verify token
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user || user.resetPasswordExpire < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate new token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Password reset successful",
      token,
      user: user.getProfile(),
    });
  } catch (err) {
    res.status(500).json({ error: "Error resetting password: " + err.message });
  }
});

module.exports = router;
