const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const socketIO = require("socket.io");
const mongoose = require("mongoose");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

dotenv.config();

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const cartRoutes = require("./routes/cart");
const paymentRoutes = require("./routes/payments");
const deliveryRoutes = require("./routes/delivery");
const notificationRoutes = require("./routes/notifications");
const priceRoutes = require("./routes/aiPricing");
const uploadRoutes = require("./routes/upload");
const adminRoutes = require("./routes/admin");

const app = express();
const server = http.createServer(app);

// Render and most production reverse proxies forward the real client address.
// This keeps express-rate-limit proxy handling correct without trusting an
// arbitrary chain of proxies.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.CLIENT_URL,
]
  .filter(Boolean)
  .map((origin) => String(origin).replace(/\/$/, ""));

const io = socketIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
});

app.set("io", io);
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalizedOrigin = String(origin).replace(/\/$/, "");
      if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const authLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

app.use("/api/auth", authLimiter);

app.use(
  "/api/payments/webhook",
  express.raw({ type: "application/json", limit: "50mb" })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static("public"));

if (process.env.NODE_ENV !== "test") {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/agroconnect";
  mongoose
    .connect(mongoUri)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => console.error("❌ MongoDB Connection Error:", err.message));
}

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/pricing", priceRoutes);
app.use("/api/admin", adminRoutes);

const cloudinaryConfigured = () =>
  Boolean(
    (process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME) &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    services: {
      cloudinary: cloudinaryConfigured() ? "Configured" : "Not configured",
    },
  });
});

io.on("connection", (socket) => {
  console.log(`👥 User connected: ${socket.id}`);

  socket.on("join_room", (userId) => {
    if (!userId) return;
    socket.join(`user_${userId}`);
  });

  socket.on("send_notification", (data) => {
    if (!data?.userId) return;
    io.to(`user_${data.userId}`).emit("notification", data);
  });

  socket.on("order_update", (data) => {
    io.emit("order_updated", data);
  });

  socket.on("delivery_location", (data) => {
    if (!data?.deliveryId) return;
    io.to(`delivery_${data.deliveryId}`).emit("location_update", data);
  });

  socket.on("disconnect", () => {
    console.log(`👋 User disconnected: ${socket.id}`);
  });
});

app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack || err.message);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ success: false, error: "Not allowed by CORS" });
  }

  return res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
    status: err.status || 500,
  });
});

app.use((req, res) => {
  return res.status(404).json({ success: false, error: "Route not found" });
});

const PORT = Number(process.env.PORT) || 5001;

function validateStartupConfig() {
  const errors = [];

  if (!process.env.JWT_SECRET) {
    errors.push("❌ JWT_SECRET is not configured");
  } else if (process.env.JWT_SECRET.length < 64) {
    errors.push(
      `❌ JWT_SECRET is too short (${process.env.JWT_SECRET.length} chars, need 64+ chars)`
    );
  }

  if (process.env.NODE_ENV === "production" && !process.env.JWT_RESET_SECRET) {
    errors.push("❌ JWT_RESET_SECRET is not configured (required for production)");
  }

  if (process.env.NODE_ENV !== "test" && !process.env.MONGODB_URI) {
    errors.push("❌ MONGODB_URI is not configured");
  }

  if (process.env.NODE_ENV === "production" && !process.env.CLIENT_URL) {
    errors.push("❌ CLIENT_URL is not configured (required for production CORS)");
  }

  // Farmer verification cannot function without private evidence storage, so
  // production must not start in a falsely healthy state without Cloudinary.
  if (process.env.NODE_ENV === "production" && !cloudinaryConfigured()) {
    errors.push(
      "❌ Cloudinary verification storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
    );
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn("⚠️ WARNING: STRIPE_SECRET_KEY is not configured - Stripe payments will not work");
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn("⚠️ WARNING: STRIPE_WEBHOOK_SECRET is not configured - Stripe webhooks will not work");
  }
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn("⚠️ WARNING: Razorpay is not configured - Razorpay payments will not work");
  }

  return errors;
}

if (require.main === module) {
  const startupErrors = validateStartupConfig();

  if (startupErrors.length > 0) {
    console.error("\n🚨 STARTUP CONFIGURATION ERRORS:");
    startupErrors.forEach((error) => console.error(error));
    console.error("\nPlease fix these issues and restart the server.\n");
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║      🌱 AgroConnect Server Running     ║
╠════════════════════════════════════════╣
║ Port: ${PORT}
║ Environment: ${process.env.NODE_ENV || "development"}
╚════════════════════════════════════════╝
    `);
  });
}

module.exports = { app, server, io, validateStartupConfig };
