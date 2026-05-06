const express = require("express");
const { protect } = require("../middleware/auth");

const notificationRouter = express.Router();
const pricingRouter = express.Router();

// Notifications Routes
// @route   POST /api/notifications/send
// @desc    Send notification to user
// @access  Private
notificationRouter.post("/send", protect, (req, res) => {
  try {
    const { userId, title, message, type } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const io = req.app.get("io");

    // Send real-time notification
    io.to(`user_${userId}`).emit("notification", {
      title,
      message,
      type: type || "info",
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: "Notification sent successfully",
    });
  } catch (err) {
    res.status(500).json({ error: "Error sending notification: " + err.message });
  }
});

// AI Pricing Routes
// @route   POST /api/pricing/suggest
// @desc    Get AI-suggested price for a product
// @access  Private (Farmer/Fertilizer Seller)
pricingRouter.post("/suggest", protect, async (req, res) => {
  try {
    const { productType, category, weight, currentPrice } = req.body;

    if (!productType || !category || !weight || !currentPrice) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Simulated AI pricing logic
    // In production, integrate with real AI/ML API
    let suggestedPrice = currentPrice;
    let trend = "stable";
    let confidence = 85;

    // Price adjustment logic based on product type and category
    const priceAdjustments = {
      produce: {
        vegetables: { low: 0.9, high: 1.15 },
        fruits: { low: 0.85, high: 1.2 },
        grains: { low: 0.95, high: 1.1 },
      },
      fertilizer: {
        npk: { low: 0.92, high: 1.12 },
        organic: { low: 0.88, high: 1.18 },
        pesticide: { low: 0.95, high: 1.15 },
      },
    };

    // Simulate market demand
    const demand = Math.random() * 0.3 + 0.85; // 0.85 to 1.15

    if (priceAdjustments[productType] && priceAdjustments[productType][category]) {
      const adjustment = priceAdjustments[productType][category];
      const marketPrice = currentPrice * demand;

      suggestedPrice = Math.round(marketPrice * 100) / 100;

      if (suggestedPrice > currentPrice * 1.1) {
        trend = "increasing";
        confidence = 90;
      } else if (suggestedPrice < currentPrice * 0.9) {
        trend = "decreasing";
        confidence = 88;
      } else {
        trend = "stable";
        confidence = 92;
      }
    }

    res.json({
      success: true,
      suggestedPrice,
      currentPrice,
      trend,
      confidence,
      recommendation:
        trend === "increasing"
          ? "Market prices are rising. Consider increasing your price."
          : trend === "decreasing"
          ? "Market prices are falling. Consider competitive pricing."
          : "Market is stable. Current price is competitive.",
      timestamp: new Date(),
    });
  } catch (err) {
    res.status(500).json({ error: "Error getting price suggestion: " + err.message });
  }
});

// @route   GET /api/pricing/trends/:category
// @desc    Get price trends for a category
// @access  Public
pricingRouter.get("/trends/:category", async (req, res) => {
  try {
    const { category } = req.params;

    // Simulated trend data
    const trends = {
      vegetables: {
        category: "Vegetables",
        averagePrice: 35,
        trend: "stable",
        lastWeekChange: "+2%",
        monthlyChange: "-5%",
      },
      fruits: {
        category: "Fruits",
        averagePrice: 50,
        trend: "increasing",
        lastWeekChange: "+8%",
        monthlyChange: "+12%",
      },
      grains: {
        category: "Grains",
        averagePrice: 40,
        trend: "decreasing",
        lastWeekChange: "-3%",
        monthlyChange: "-7%",
      },
      fertilizer: {
        category: "Fertilizer",
        averagePrice: 450,
        trend: "stable",
        lastWeekChange: "+1%",
        monthlyChange: "+3%",
      },
    };

    const categoryTrend = trends[category] || {
      category,
      message: "No trend data available",
    };

    res.json({
      success: true,
      trend: categoryTrend,
      timestamp: new Date(),
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching trends: " + err.message });
  }
});

module.exports = {
  notificationRouter,
  pricingRouter,
};
