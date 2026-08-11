const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const Product = require("../models/Product");
const { Order } = require("../models/Order");

const router = express.Router();

// @route   POST /api/pricing/suggest
// @desc    Get AI-suggested price for a product
// @access  Private (Farmer/Fertilizer Seller)
router.post("/suggest", protect, authorize("farmer", "fertilizer_seller"), async (req, res) => {
  try {
    const { productType, category, quantity, currentPrice } = req.body;

    if (!productType || !category || !quantity || !currentPrice) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Try to find actual transaction history in orders collection
    let suggestedPrice = currentPrice;
    let trend = "stable";
    let confidence = 85;
    let isSimulated = true;
    let prices = [];

    try {
      // Find matching products in this category
      const matchingProducts = await Product.find({ type: productType, category }).select("_id");
      const productIds = matchingProducts.map(p => p._id);

      if (productIds.length > 0) {
        // Find recent orders containing these products that are confirmed or completed
        const recentOrders = await Order.find({
          status: { $in: ["confirmed", "processing", "shipped", "delivered"] },
          "items.product": { $in: productIds }
        }).sort({ createdAt: -1 }).limit(20);

        for (const order of recentOrders) {
          for (const item of order.items) {
            if (item.product && productIds.some(id => id.toString() === item.product.toString())) {
              prices.push(item.price);
            }
          }
        }
      }
    } catch (dbErr) {
      console.error("Database error looking up transaction history:", dbErr);
    }

    const demandFactor = Math.random() * 0.3 + 0.85; // 0.85 to 1.15
    const currentMonth = new Date().getMonth();
    const seasonalFactor = Math.sin((currentMonth / 12) * Math.PI) * 0.1 + 1; // 0.9 to 1.1

    if (prices.length > 0) {
      const sum = prices.reduce((a, b) => a + b, 0);
      const avgPrice = sum / prices.length;
      suggestedPrice = Math.round(avgPrice * 100) / 100;
      isSimulated = false;

      if (suggestedPrice > currentPrice * 1.05) {
        trend = "increasing";
        confidence = Math.min(98, 85 + prices.length);
      } else if (suggestedPrice < currentPrice * 0.95) {
        trend = "decreasing";
        confidence = Math.min(98, 85 + prices.length);
      } else {
        trend = "stable";
        confidence = Math.min(98, 85 + prices.length);
      }
    } else {
      // Fallback to simulated pricing logic
      // Price adjustment based on product type and category
      const priceAdjustments = {
        produce: {
          vegetables: { baseline: 1.0, variance: 0.15 },
          fruits: { baseline: 1.05, variance: 0.2 },
          grains: { baseline: 0.95, variance: 0.1 },
        },
        fertilizer: {
          npk: { baseline: 1.0, variance: 0.12 },
          organic: { baseline: 1.1, variance: 0.18 },
          pesticide: { baseline: 1.02, variance: 0.15 },
        },
      };

      if (
        priceAdjustments[productType] &&
        priceAdjustments[productType][category]
      ) {
        const adjustment = priceAdjustments[productType][category];
        const marketPrice =
          currentPrice * adjustment.baseline * demandFactor * seasonalFactor;

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
    }

    // Calculate recommendation
    let recommendation = isSimulated
      ? "[Simulated estimate] Market is stable. Current price is competitive."
      : `Market average based on ${prices.length} recent sales is ₹${suggestedPrice}.`;

    if (trend === "increasing") {
      recommendation = isSimulated
        ? `[Simulated estimate] Market prices are rising. Consider increasing your price to ₹${suggestedPrice}.`
        : `Market prices are rising. Based on recent transactions, consider increasing your price to ₹${suggestedPrice}.`;
    } else if (trend === "decreasing") {
      recommendation = isSimulated
        ? `[Simulated estimate] Market prices are falling. Consider competitive pricing at ₹${suggestedPrice} to attract more buyers.`
        : `Market prices are falling. Based on recent transactions, consider competitive pricing at ₹${suggestedPrice} to attract more buyers.`;
    }

    res.json({
      success: true,
      suggestedPrice,
      currentPrice,
      priceDifference: suggestedPrice - currentPrice,
      percentageChange: Math.round(((suggestedPrice - currentPrice) / currentPrice) * 100),
      trend,
      confidence,
      recommendation,
      isSimulated,
      factors: {
        demandLevel: Math.round(demandFactor * 100),
        seasonalImpact: Math.round(seasonalFactor * 100),
        marketTrend: trend,
      },
      timestamp: new Date(),
    });
  } catch (err) {
    res.status(500).json({ error: "Error getting price suggestion: " + err.message });
  }
});

// @route   GET /api/pricing/trends/:category
// @desc    Get price trends for a category
// @access  Public
router.get("/trends/:category", async (req, res) => {
  try {
    const { category } = req.params;

    // Simulated trend data (in production, fetch from database)
    const trends = {
      vegetables: {
        category: "Vegetables",
        averagePrice: 35,
        trend: "stable",
        lastWeekChange: "+2%",
        monthlyChange: "-5%",
        demand: "High",
        topProducts: ["Tomatoes", "Potatoes", "Onions", "Carrots"],
      },
      fruits: {
        category: "Fruits",
        averagePrice: 50,
        trend: "increasing",
        lastWeekChange: "+8%",
        monthlyChange: "+12%",
        demand: "Very High",
        topProducts: ["Mangoes", "Bananas", "Apples", "Oranges"],
      },
      grains: {
        category: "Grains",
        averagePrice: 40,
        trend: "decreasing",
        lastWeekChange: "-3%",
        monthlyChange: "-7%",
        demand: "Medium",
        topProducts: ["Wheat", "Rice", "Corn", "Barley"],
      },
      npk: {
        category: "NPK Fertilizer",
        averagePrice: 450,
        trend: "stable",
        lastWeekChange: "+1%",
        monthlyChange: "+3%",
        demand: "High",
        recommendation: "Good time to stock up",
      },
      organic: {
        category: "Organic Fertilizer",
        averagePrice: 350,
        trend: "increasing",
        lastWeekChange: "+5%",
        monthlyChange: "+8%",
        demand: "Very High",
        recommendation: "Demand is increasing, consider raising prices",
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

// @route   GET /api/pricing/market-analysis
// @desc    Get overall market analysis
// @access  Public
router.get("/market-analysis", async (req, res) => {
  try {
    const analysis = {
      overallTrend: "bullish",
      marketHealth: "Good",
      bestPerformingCategories: ["Fruits", "Organic Fertilizers"],
      slowMovingCategories: ["Grains"],
      averagePriceChangeWeekly: "+3.2%",
      averagePriceChangeMonthly: "+5.8%",
      topDemandedProducts: [
        { name: "Tomatoes", demandScore: 95, priceChange: "+2%" },
        { name: "Mangoes", demandScore: 92, priceChange: "+8%" },
        { name: "Organic Compost", demandScore: 88, priceChange: "+5%" },
      ],
      predictions: {
        nextWeek: "Expect slight increase in prices due to upcoming festival season",
        nextMonth: "Market expected to remain stable with seasonal variations",
      },
    };

    res.json({
      success: true,
      analysis,
      timestamp: new Date(),
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching market analysis: " + err.message });
  }
});

module.exports = router;
