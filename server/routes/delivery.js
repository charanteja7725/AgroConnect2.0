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
      $or: [
        { deliveryPartner: req.user._id },
        { deliveryPartner: { $exists: false } },
        { deliveryPartner: null },
      ],
      status: { $in: ["assigned", "accepted", "picked_up"] },
    };

    if (longitude !== undefined || latitude !== undefined) {
      const lng = Number(longitude);
      const lat = Number(latitude);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return res.status(400).json({ error: "Valid longitude and latitude are required" });
      }
      query.recipientLocation = {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: Math.min(200000, Math.max(1, Number(maxDistance) || 50000)),
        },
      };
    }

    const deliveries = await Delivery.find(query).limit(15);
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

    return res.status(201).json({ success: true, delivery, message: "Delivery created successfully" });
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
    if (!partner) return res.status(400).json({ error: "Active delivery partner not found" });

    const delivery = await Delivery.findByIdAndUpdate(
      req.params.id,
      { deliveryPartner: partner._id, status: "assigned" },
      { new: true }
    ).populate("deliveryPartner", USER_CONTACT_FIELDS);

    if (!delivery) return res.status(404).json({ error: "Delivery not found" });
    return res.json({ success: true, delivery, message: "Delivery partner assigned" });
  } catch (err) {
    return res.status(500).json({ error: "Error assigning delivery: " + err.message });
  }
});

router.put("/:id/accept", protect, authorize("delivery_partner"), async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });

    if (delivery.deliveryPartner && delivery.deliveryPartner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "This delivery has already been claimed." });
    }

    delivery.deliveryPartner = req.user._id;
    delivery.partnerName = `${req.user.firstName} ${req.user.lastName}`;
    delivery.partnerPhone = req.user.phone || "";
    delivery.status = "accepted";
    delivery.statusHistory.push({
      status: "accepted",
      timestamp: new Date(),
      note: "Delivery accepted by partner",
    });
    await delivery.save();

    return res.json({ success: true, delivery, message: "Delivery accepted successfully" });
  } catch (err) {
    return res.status(500).json({ error: "Error accepting delivery: " + err.message });
  }
});

router.put("/:id/status", protect, authorize("delivery_partner"), async (req, res) => {
  try {
    const { status, location, note } = req.body;
    const validStatuses = ["assigned", "accepted", "picked_up", "in_transit", "delivered", "failed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid delivery status" });
    }

    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });

    if (!delivery.deliveryPartner || delivery.deliveryPartner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to update this delivery" });
    }

    delivery.status = status;

    if (location) {
      const lat = Number(location.latitude);
      const lng = Number(location.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ error: "Invalid delivery location" });
      }
      delivery.route.push({ latitude: lat, longitude: lng, timestamp: new Date() });
      delivery.partnerLocation = { type: "Point", coordinates: [lng, lat] };
    }

    delivery.statusHistory.push({ status, timestamp: new Date(), location, note });
    if (status === "delivered") delivery.actualDeliveryTime = new Date();
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
        location,
        status,
      });
    }

    return res.json({ success: true, delivery, message: `Delivery status updated to ${status}` });
  } catch (err) {
    return res.status(500).json({ error: "Error updating delivery: " + err.message });
  }
});

module.exports = router;
