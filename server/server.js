const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const socketIO = require("socket.io");
const mongoose = require("mongoose");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Load environment variables
dotenv.config();

// Import routes
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

// Initialize Express App
const app = express();
const server = http.createServer(app);

// Allowed Frontend Origins
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.CLIENT_URL,
].filter(Boolean);

// Socket.IO
const io = socketIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Security Middleware
app.use(helmet());

// CORS Middleware
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (Postman/mobile apps)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Rate Limiter
const authLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

app.use("/api/auth", authLimiter);

// Body Parsers
app.use(
  "/api/payments/webhook",
  express.raw({ type: "application/json", limit: "50mb" })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Static Files
app.use(express.static("public"));

// MongoDB Connection
if (process.env.NODE_ENV !== "test") {
  mongoose
    .connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/agroconnect"
    )
    .then(() => {
      console.log("✅ MongoDB Connected");
    })
    .catch((err) => {
      console.error("❌ MongoDB Error:", err);
    });
}

// Make io accessible to routes
app.set("io", io);

// Routes
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

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
  });
});

// Socket.IO Events
io.on("connection", (socket) => {
  console.log(`👥 User connected: ${socket.id}`);

  // Join user room
  socket.on("join_room", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`✅ User ${userId} joined their room`);
  });

  // Real-time notifications
  socket.on("send_notification", (data) => {
    io.to(`user_${data.userId}`).emit("notification", data);
  });

  // Order updates
  socket.on("order_update", (data) => {
    io.emit("order_updated", data);
  });

  // Delivery tracking
  socket.on("delivery_location", (data) => {
    io.to(`delivery_${data.deliveryId}`).emit("location_update", data);
  });

  socket.on("disconnect", () => {
    console.log(`👋 User disconnected: ${socket.id}`);
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    status: err.status || 500,
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

// Start Server
const PORT = process.env.PORT || 5001;

// Startup validation
function validateStartupConfig() {
  const errors = [];

  // Check JWT secrets
  if (!process.env.JWT_SECRET) {
    errors.push("❌ JWT_SECRET is not configured");
  } else if (process.env.JWT_SECRET.length < 64) {
    errors.push(`❌ JWT_SECRET is too short (${process.env.JWT_SECRET.length} chars, need 64+ chars)`);
  }

  if (!process.env.JWT_RESET_SECRET && process.env.NODE_ENV === "production") {
    errors.push("❌ JWT_RESET_SECRET is not configured (required for production)");
  }

  // Check Stripe configuration
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn("⚠️  WARNING: STRIPE_SECRET_KEY is not configured - Stripe payments will not work");
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn("⚠️  WARNING: STRIPE_WEBHOOK_SECRET is not configured - Stripe webhooks will not work");
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn("⚠️  WARNING: Razorpay is not configured - Razorpay payments will not work");
  }

  // Check MongoDB
  if (!process.env.MONGODB_URI && process.env.NODE_ENV !== "test") {
    errors.push("❌ MONGODB_URI is not configured");
  }

  return errors;
}

const startupErrors = validateStartupConfig();
if (startupErrors.length > 0) {
  console.error("\n🚨 STARTUP CONFIGURATION ERRORS:");
  startupErrors.forEach(err => console.error(err));
  console.error("\nPlease fix these issues and restart the server.\n");
  process.exit(1);
}

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║   🌱 AgroConnect Server Running 🌱    ║
║   Port: ${PORT}                       
║   Environment: ${process.env.NODE_ENV || "development"}    
╚════════════════════════════════════════╗
    `);
  });
}

module.exports = { app, server, io };