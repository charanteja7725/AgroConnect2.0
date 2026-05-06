const express = require("express");
const Delivery = require("../models/Delivery");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/delivery
// @desc    Get deliveries
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    let query = {};

    if (req.user.role === "delivery_partner") {
      query.deliveryPartner = req.user._id;
    }

    const deliveries = await Delivery.find(query)
      .populate("deliveryPartner")
      .populate("order")
      .populate("sender")
      .populate("recipient")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: deliveries.length,
      deliveries,
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching deliveries: " + err.message });
  }
});

// @route   GET /api/delivery/:id
// @desc    Get single delivery
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate("deliveryPartner")
      .populate("order")
      .populate("sender")
      .populate("recipient");

    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    res.json({
      success: true,
      delivery,
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching delivery: " + err.message });
  }
});

// @route   POST /api/delivery/create
// @desc    Create new delivery
// @access  Private (Admin/Order System)
router.post("/create", protect, async (req, res) => {
  try {
    const {
      type,
      order,
      sender,
      senderPhone,
      senderLocation,
      recipient,
      recipientName,
      recipientPhone,
      recipientLocation,
      items,
    } = req.body;

    const delivery = new Delivery({
      type,
      order,
      sender,
      senderPhone,
      senderLocation,
      recipient,
      recipientName,
      recipientPhone,
      recipientEmail: req.body.recipientEmail,
      recipientLocation,
      items,
      status: "assigned",
    });

    await delivery.save();

    res.status(201).json({
      success: true,
      delivery,
      message: "Delivery created successfully",
    });
  } catch (err) {
    res.status(500).json({ error: "Error creating delivery: " + err.message });
  }
});

// @route   PUT /api/delivery/:id/assign
// @desc    Assign delivery partner
// @access  Private (Admin)
router.put("/:id/assign", protect, authorize("admin"), async (req, res) => {
  try {
    const { deliveryPartnerId } = req.body;

    const delivery = await Delivery.findByIdAndUpdate(
      req.params.id,
      {
        deliveryPartner: deliveryPartnerId,
        status: "assigned",
      },
      { new: true }
    ).populate("deliveryPartner");

    res.json({
      success: true,
      delivery,
      message: "Delivery partner assigned",
    });
  } catch (err) {
    res.status(500).json({ error: "Error assigning delivery: " + err.message });
  }
});

// @route   PUT /api/delivery/:id/status
// @desc    Update delivery status
// @access  Private (Delivery Partner)
router.put("/:id/status", protect, authorize("delivery_partner"), async (req, res) => {
  try {
    const { status, location, note } = req.body;

    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    if (delivery.deliveryPartner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to update this delivery" });
    }

    delivery.status = status;

    // Add location to route
    if (location) {
      delivery.route.push({
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date(),
      });

      delivery.partnerLocation = {
        type: "Point",
        coordinates: [location.longitude, location.latitude],
      };
    }

    // Add status to history
    delivery.statusHistory.push({
      status,
      timestamp: new Date(),
      location,
      note,
    });

    if (status === "delivered") {
      delivery.actualDeliveryTime = new Date();
    }

    await delivery.save();

    // Emit real-time location update
    const io = req.app.get("io");
    io.emit("delivery_location_update", {
      deliveryId: delivery._id,
      location,
      status,
    });

    res.json({
      success: true,
      delivery,
      message: `Delivery status updated to ${status}`,
    });
  } catch (err) {
    res.status(500).json({ error: "Error updating delivery: " + err.message });
  }
});

// @route   GET /api/delivery/nearby
// @desc    Get nearby deliveries for a partner
// @access  Private (Delivery Partner)
router.get("/nearby", protect, authorize("delivery_partner"), async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 50000 } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({ error: "Location coordinates are required" });
    }

    const deliveries = await Delivery.find({
      status: { $in: ["assigned", "accepted", "picked_up"] },
      recipientLocation: {
        coordinates: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [parseFloat(longitude), parseFloat(latitude)],
            },
            $maxDistance: parseInt(maxDistance),
          },
        },
      },
    }).limit(10);

    res.json({
      success: true,
      count: deliveries.length,
      deliveries,
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching deliveries: " + err.message });
  }
});

module.exports = router;
