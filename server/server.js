const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const socketIO = require("socket.io");
const mongoose = require("mongoose");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// ======================================================
// LOAD ENVIRONMENT VARIABLES
// ======================================================

dotenv.config();

// ======================================================
// IMPORT ROUTES
// ======================================================

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

// ======================================================
// INITIALIZE EXPRESS
// ======================================================

const app = express();
const server = http.createServer(app);

// ======================================================
// ALLOWED FRONTEND ORIGINS
// ======================================================

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.CLIENT_URL,
].filter(Boolean);

// ======================================================
// SOCKET.IO
// ======================================================

const io = socketIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
});

// Make Socket.IO accessible inside routes
app.set("io", io);

// ======================================================
// SECURITY MIDDLEWARE
// ======================================================

app.use(helmet());

// ======================================================
// CORS
// ======================================================

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin
      // Example: Postman, mobile apps, Jest/Supertest
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

// ======================================================
// RATE LIMITER
// ======================================================

const authLimiter = rateLimit({
  windowMs:
    Number(process.env.RATE_LIMIT_WINDOW_MS) ||
    15 * 60 * 1000,

  max:
    Number(process.env.RATE_LIMIT_MAX_REQUESTS) ||
    100,

  standardHeaders: "draft-7",
  legacyHeaders: false,
});

// Apply limiter only to authentication routes
app.use("/api/auth", authLimiter);

// ======================================================
// BODY PARSERS
// ======================================================

// IMPORTANT:
// Payment webhook must receive raw body before express.json()
app.use(
  "/api/payments/webhook",
  express.raw({
    type: "application/json",
    limit: "50mb",
  })
);

app.use(
  express.json({
    limit: "50mb",
  })
);

app.use(
  express.urlencoded({
    limit: "50mb",
    extended: true,
  })
);

// ======================================================
// STATIC FILES
// ======================================================

app.use(express.static("public"));

// ======================================================
// DATABASE CONNECTION
// ======================================================

// Do NOT automatically connect to MongoDB when running Jest.
// Tests normally manage their own test database.
if (process.env.NODE_ENV !== "test") {
  const mongoUri =
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/agroconnect";

  mongoose
    .connect(mongoUri)
    .then(() => {
      console.log("✅ MongoDB Connected");
    })
    .catch((err) => {
      console.error(
        "❌ MongoDB Connection Error:",
        err.message
      );
    });
}

// ======================================================
// API ROUTES
// ======================================================

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

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),

    environment:
      process.env.NODE_ENV || "development",

    mongodb:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
  });
});

// ======================================================
// SOCKET.IO EVENTS
// ======================================================

io.on("connection", (socket) => {
  console.log(
    `👥 User connected: ${socket.id}`
  );

  // ----------------------------------------------------
  // Join user notification room
  // ----------------------------------------------------

  socket.on("join_room", (userId) => {
    if (!userId) {
      return;
    }

    socket.join(`user_${userId}`);

    console.log(
      `✅ User ${userId} joined their room`
    );
  });

  // ----------------------------------------------------
  // Real-time notification
  // ----------------------------------------------------

  socket.on("send_notification", (data) => {
    if (!data || !data.userId) {
      return;
    }

    io.to(`user_${data.userId}`).emit(
      "notification",
      data
    );
  });

  // ----------------------------------------------------
  // Order update
  // ----------------------------------------------------

  socket.on("order_update", (data) => {
    io.emit("order_updated", data);
  });

  // ----------------------------------------------------
  // Delivery tracking
  // ----------------------------------------------------

  socket.on("delivery_location", (data) => {
    if (!data || !data.deliveryId) {
      return;
    }

    io.to(
      `delivery_${data.deliveryId}`
    ).emit(
      "location_update",
      data
    );
  });

  // ----------------------------------------------------
  // Disconnect
  // ----------------------------------------------------

  socket.on("disconnect", () => {
    console.log(
      `👋 User disconnected: ${socket.id}`
    );
  });
});

// ======================================================
// ERROR HANDLER
// ======================================================

app.use((err, req, res, next) => {
  console.error(
    "Server Error:",
    err.stack || err.message
  );

  // CORS error
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      error: "Not allowed by CORS",
    });
  }

  return res
    .status(err.status || 500)
    .json({
      success: false,
      error:
        err.message ||
        "Internal Server Error",
      status: err.status || 500,
    });
});

// ======================================================
// 404 HANDLER
// ======================================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

// ======================================================
// SERVER CONFIGURATION
// ======================================================

const PORT =
  Number(process.env.PORT) || 5001;

// ======================================================
// STARTUP VALIDATION
// ======================================================

function validateStartupConfig() {
  const errors = [];

  // ----------------------------------------------------
  // JWT Secret
  // ----------------------------------------------------

  if (!process.env.JWT_SECRET) {
    errors.push(
      "❌ JWT_SECRET is not configured"
    );
  } else if (
    process.env.JWT_SECRET.length < 64
  ) {
    errors.push(
      `❌ JWT_SECRET is too short (${process.env.JWT_SECRET.length} chars, need 64+ chars)`
    );
  }

  // ----------------------------------------------------
  // Password reset JWT secret
  // ----------------------------------------------------

  if (
    process.env.NODE_ENV === "production" &&
    !process.env.JWT_RESET_SECRET
  ) {
    errors.push(
      "❌ JWT_RESET_SECRET is not configured (required for production)"
    );
  }

  // ----------------------------------------------------
  // MongoDB
  // ----------------------------------------------------

  if (
    process.env.NODE_ENV !== "test" &&
    !process.env.MONGODB_URI
  ) {
    errors.push(
      "❌ MONGODB_URI is not configured"
    );
  }

  // ----------------------------------------------------
  // Stripe
  // ----------------------------------------------------

  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn(
      "⚠️ WARNING: STRIPE_SECRET_KEY is not configured - Stripe payments will not work"
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn(
      "⚠️ WARNING: STRIPE_WEBHOOK_SECRET is not configured - Stripe webhooks will not work"
    );
  }

  // ----------------------------------------------------
  // Razorpay
  // ----------------------------------------------------

  if (
    !process.env.RAZORPAY_KEY_ID ||
    !process.env.RAZORPAY_KEY_SECRET
  ) {
    console.warn(
      "⚠️ WARNING: Razorpay is not configured - Razorpay payments will not work"
    );
  }

  return errors;
}

// ======================================================
// START SERVER
// ======================================================

// VERY IMPORTANT:
// Only perform startup validation and start the server when
// this file is directly executed.
//
// Jest imports server.js, so this prevents Jest from calling
// process.exit() during tests.

if (require.main === module) {
  const startupErrors =
    validateStartupConfig();

  if (startupErrors.length > 0) {
    console.error(
      "\n🚨 STARTUP CONFIGURATION ERRORS:"
    );

    startupErrors.forEach((error) => {
      console.error(error);
    });

    console.error(
      "\nPlease fix these issues and restart the server.\n"
    );

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

// ======================================================
// EXPORT FOR JEST / OTHER MODULES
// ======================================================

module.exports = {
  app,
  server,
  io,
};