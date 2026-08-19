const express = require("express");
const Delivery = require("../models/Delivery");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");
const { sendDeliveryUpdate } = require("../services/mailService");

const router = express.Router();
const USER_CONTACT_FIELDS = "_id firstName lastName phone email businessName role avatar";

const populateDelivery = (query) =>
  query
    .populate("deliveryPartner", USER_CONTACT_FIELDS)
    .populate("order")
    .populate("sender", USER_CONTACT_FIELDS)
    .populate("recipient", USER_CONTACT_FIELDS);

const canAccessDelivery = (delivery, user) => {
  if (user.role === "admin") return true;
  const userId = user._id.toString();
  return Boolean(
    delivery.deliveryPartner?.toString() === userId ||
      delivery.sender?.toString() === userId ||
      delivery.recipient?.toString() === userId
  );
};

const DELIVERY_TRANSITIONS = {
  assigned: ["picked_up", "cancelled", "failed"],
  accepted: ["picked_up", "cancelled", "failed"],
  picked_up: ["in_transit", "cancelled", "failed"],
  in_transit: ["near_delivery", "delivered", "failed"],
  near_delivery: ["delivered", "failed"],
  delivered: [],
  cancelled: [],
  failed: [],
};

const validPoint = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

router.get("/", protect, async (req, res) => {
  try {
    let query;

    if (req.user.role === "admin") {
      query = {};
    } else if (req.user.role === "delivery_partner") {
      query = { deliveryPartner: req.user._id };
    } else if (["farmer", "fertilizer_seller"].includes(req.user.role)) {
      query = { sender: req.user._id };
    } else if (req.user.role === "buyer") {
      query = { recipient: req.user._id };
    } else {
      return res.status(403).json({ error: "Not authorized to view deliveries" });
    }

    const deliveries = await populateDelivery(
      Delivery.find(query).sort({ createdAt: -1 })
    );
    return res.json({ success: true, count: deliveries.length, deliveries });
  } catch (err) {
    return res.status(500).json({ error: "Error fetching deliveries: " + err.message });
  }
});

router.get("/nearby", protect, authorize("delivery_partner"), async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 50000 } = req.query;
    const query = {
      $or: [{ deliveryPartner: { $exists: false } }, { deliveryPartner: null }],
      status: "assigned",
    };

    const suppliedCoordinates = longitude !== undefined || latitude !== undefined;
    if (suppliedCoordinates) {
      if (!validPoint(latitude, longitude)) {
        return res.status(400).json({ error: "Valid longitude and latitude are required" });
      }

      query.recipientLocation = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [Number(longitude), Number(latitude)],
          },
          $maxDistance: Math.min(200000, Math.max(1, Number(maxDistance) || 50000)),
        },
      };
    }

    const deliveries = await Delivery.find(query)
      .sort(suppliedCoordinates ? undefined : { createdAt: -1 })
      .limit(15);

    return res.json({ success: true, count: deliveries.length, deliveries });
  } catch (err) {
    return res.status(500).json({ error: "Error fetching deliveries: " + err.message });
  }
});

router.get("/:id", protect, async (req, res) => {
  try {
    const rawDelivery = await Delivery.findById(req.params.id);
    if (!rawDelivery) return res.status(404).json({ error: "Delivery not found" });

    if (!canAccessDelivery(rawDelivery, req.user)) {
      return res.status(403).json({ error: "Not authorized to view this delivery" });
    }

    const delivery = await populateDelivery(Delivery.findById(req.params.id));
    return res.json({ success: true, delivery });
  } catch (err) {
    return res.status(500).json({ error: "Error fetching delivery: " + err.message });
  }
});

router.post("/create", protect, authorize("admin"), async (req, res) => {
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

    const delivery = await Delivery.create({
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

    return res.status(201).json({
      success: true,
      delivery,
      message: "Delivery created successfully",
    });
  } catch (err) {
    return res.status(500).json({ error: "Error creating delivery: " + err.message });
  }
});

router.put("/:id/assign", protect, authorize("admin"), async (req, res) => {
  try {
    const partner = await User.findOne({
      _id: req.body.deliveryPartnerId,
      role: "delivery_partner",
      isActive: true,
    });
    if (!partner) {
      return res.status(400).json({ error: "Active delivery partner not found" });
    }

    const delivery = await Delivery.findByIdAndUpdate(
      req.params.id,
      {
        deliveryPartner: partner._id,
        partnerName: `${partner.firstName} ${partner.lastName}`,
        partnerPhone: partner.phone || "",
        status: "assigned",
        $push: {
          statusHistory: {
            status: "assigned",
            timestamp: new Date(),
            note: "Assigned by administrator",
          },
        },
      },
      { new: true, runValidators: true }
    ).populate("deliveryPartner", USER_CONTACT_FIELDS);

    if (!delivery) return res.status(404).json({ error: "Delivery not found" });
    return res.json({ success: true, delivery, message: "Delivery partner assigned" });
  } catch (err) {
    return res.status(500).json({ error: "Error assigning delivery: " + err.message });
  }
});

router.put("/:id/accept", protect, authorize("delivery_partner"), async (req, res) => {
  try {
    // Claim atomically so two partners cannot accept the same unassigned job.
    const delivery = await Delivery.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "assigned",
        $or: [{ deliveryPartner: { $exists: false } }, { deliveryPartner: null }],
      },
      {
        $set: {
          deliveryPartner: req.user._id,
          partnerName: `${req.user.firstName} ${req.user.lastName}`,
          partnerPhone: req.user.phone || "",
          status: "accepted",
        },
        $push: {
          statusHistory: {
            status: "accepted",
            timestamp: new Date(),
            note: "Delivery accepted by partner",
          },
        },
      },
      { new: true, runValidators: true }
    );

    if (!delivery) {
      const existing = await Delivery.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: "Delivery not found" });
      return res.status(409).json({ error: "This delivery is no longer available to claim" });
    }

    return res.json({ success: true, delivery, message: "Delivery accepted successfully" });
  } catch (err) {
    return res.status(500).json({ error: "Error accepting delivery: " + err.message });
  }
});

router.put("/:id/status", protect, authorize("delivery_partner"), async (req, res) => {
  try {
    const { status, location, note } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });

    if (!delivery.deliveryPartner || delivery.deliveryPartner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to update this delivery" });
    }

    const allowedNext = DELIVERY_TRANSITIONS[delivery.status] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        error: `Delivery cannot move from ${delivery.status} to ${status}`,
      });
    }

    let normalizedLocation;
    if (location) {
      if (!validPoint(location.latitude, location.longitude)) {
        return res.status(400).json({ error: "Invalid delivery location" });
      }

      normalizedLocation = {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
      };
      delivery.route.push({ ...normalizedLocation, timestamp: new Date() });
      delivery.partnerLocation = {
        type: "Point",
        coordinates: [normalizedLocation.longitude, normalizedLocation.latitude],
      };
    }

    delivery.status = status;
    delivery.statusHistory.push({
      status,
      timestamp: new Date(),
      location: normalizedLocation,
      note,
    });

    if (status === "picked_up" && !delivery.pickupTime) {
      delivery.pickupTime = new Date();
    }
    if (status === "delivered") {
      delivery.actualDeliveryTime = new Date();
    }

    await delivery.save();

    try {
      const recipient = await User.findById(delivery.recipient);
      if (recipient) await sendDeliveryUpdate(delivery, recipient);
    } catch (emailError) {
      console.error("Delivery update email failed:", emailError);
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("delivery_location_update", {
        deliveryId: delivery._id,
        location: normalizedLocation,
        status,
      });
    }

    return res.json({
      success: true,
      delivery,
      message: `Delivery status updated to ${status}`,
    });
  } catch (err) {
    return res.status(500).json({ error: "Error updating delivery: " + err.message });
  }
});

module.exports = router;
