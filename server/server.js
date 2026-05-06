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

// Initialize Express App
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(helmet());

const clientOrigin = process.env.CLIENT_URL || "http://localhost:5173";
app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
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

// Static files
app.use(express.static("public"));

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/agroconnect")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

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
app.use("/api/notifications", notificationRoutes);
app.use("/api/pricing", priceRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    status: err.status || 500,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🌱 AgroConnect Server Running 🌱    ║
║   Port: ${PORT}                             ║
║   Environment: ${process.env.NODE_ENV || "development"}           ║
╚════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };
