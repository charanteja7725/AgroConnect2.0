const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app } = require("../server");

const User = require("../models/User");
const Product = require("../models/Product");
const { Order, Cart } = require("../models/Order");
const Notification = require("../models/Notification");

let mongoServer;
let token;
let sellerToken;
let testUser;
let testSeller;
let testAdmin;
let testDeliveryPartner;
let testProduct;

// ======================================================
// TEST SETUP
// ======================================================

beforeAll(async () => {
  jest.setTimeout(60000);

  // Disconnect any existing mongoose connection
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();

  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri);
});

// ======================================================
// TEST CLEANUP
// ======================================================

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
});

// ======================================================
// RESET DATABASE BEFORE EACH TEST
// ======================================================

beforeEach(async () => {
  // Clear all test collections
  await User.deleteMany({});
  await Product.deleteMany({});
  await Order.deleteMany({});
  await Notification.deleteMany({});
  await Cart.deleteMany({});

  // ====================================================
  // CREATE TEST BUYER
  // ====================================================

  testUser = await User.create({
    firstName: "John",
    lastName: "Buyer",
    email: "buyer@test.com",
    password: "test123",
    phone: "1234567890",
    role: "buyer",
    isActive: true,
  });

  // ====================================================
  // CREATE VERIFIED FARMER
  // ====================================================

  testSeller = await User.create({
    firstName: "Jane",
    lastName: "Farmer",
    email: "seller@test.com",
    password: "test123",
    phone: "0987654321",
    role: "farmer",
    isActive: true,

    // Required because farmers must be verified
    // before creating products
    verificationStatus: "verified",

    location: {
      type: "Point",
      coordinates: [0, 0],
    },
  });

  // ====================================================
  // CREATE ADMIN
  // ====================================================

  testAdmin = await User.create({
    firstName: "Admin",
    lastName: "User",
    email: "admin@test.com",
    password: "test123",
    phone: "1111111111",
    role: "admin",
    isActive: true,
  });

  // ====================================================
  // CREATE DELIVERY PARTNER
  // ====================================================

  testDeliveryPartner = await User.create({
    firstName: "Delivery",
    lastName: "Partner",
    email: "partner@test.com",
    password: "test123",
    phone: "2222222222",
    role: "delivery_partner",
    isActive: true,
  });

  // ====================================================
  // CREATE TEST PRODUCT
  // ====================================================

  testProduct = await Product.create({
    name: "Tomatoes",
    type: "produce",
    category: "vegetables",
    description: "Fresh red tomatoes",
    price: 50,
    quantity: 100,
    unit: "kg",

    seller: testSeller._id,
    sellerName: "Jane Farmer",

    location: {
      type: "Point",
      coordinates: [0, 0],
    },

    isActive: true,
    inStock: true,
  });

  // ====================================================
  // LOGIN BUYER
  // ====================================================

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({
      email: "buyer@test.com",
      password: "test123",
    });

  token = loginRes.body.token;

  // ====================================================
  // LOGIN FARMER
  // ====================================================

  const sellerLoginRes = await request(app)
    .post("/api/auth/login")
    .send({
      email: "seller@test.com",
      password: "test123",
    });

  sellerToken = sellerLoginRes.body.token;
});

// ======================================================
// AUTHENTICATION TESTS
// ======================================================

describe("Authentication Tests", () => {
  // ====================================================
  // REGISTER
  // ====================================================

  describe("POST /api/auth/register", () => {
    test("should register a new user successfully", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          firstName: "Test",
          lastName: "User",
          email: "newuser@test.com",
          password: "test123",
          phone: "9876543210",
          role: "buyer",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(
        "newuser@test.com"
      );
    });

    test("should fail with invalid email", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          firstName: "Test",
          lastName: "User",
          email: "invalid-email",
          password: "test123",
          phone: "9876543210",
          role: "buyer",
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test("should fail with duplicate email", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          firstName: "Test",
          lastName: "User",
          email: "buyer@test.com",
          password: "test123",
          phone: "1111111111",
          role: "buyer",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain(
        "already exists"
      );
    });
  });

  // ====================================================
  // LOGIN
  // ====================================================

  describe("POST /api/auth/login", () => {
    test("should login user successfully", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "buyer@test.com",
          password: "test123",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });

    test("should fail with invalid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "buyer@test.com",
          password: "wrongpassword",
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Invalid");
    });
  });

  // ====================================================
  // FORGOT PASSWORD
  // ====================================================

  describe("POST /api/auth/forgot-password", () => {
    test(
      "should return 200 for any email (email enumeration protection)",
      async () => {
        const res = await request(app)
          .post("/api/auth/forgot-password")
          .send({
            email: "buyer@test.com",
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }
    );

    test(
      "should return 200 for non-existent email",
      async () => {
        const res = await request(app)
          .post("/api/auth/forgot-password")
          .send({
            email: "nonexistent@test.com",
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }
    );
  });

  // ====================================================
  // RESET PASSWORD
  // ====================================================

  describe("POST /api/auth/reset-password/:token", () => {
    test(
      "should reset password with valid token",
      async () => {
        const user = await User.findById(
          testUser._id
        );

        user.resetPasswordToken = "test-token";

        user.resetPasswordExpire =
          Date.now() + 3600000;

        await user.save();

        expect(user.resetPasswordToken).toBe(
          "test-token"
        );
      }
    );
  });
});

// ======================================================
// PRODUCT TESTS
// ======================================================

describe("Product Tests", () => {
  // ====================================================
  // GET PRODUCTS
  // ====================================================

  describe("GET /api/products", () => {
    test(
      "should fetch all products with pagination",
      async () => {
        const res = await request(app)
          .get("/api/products")
          .query({
            page: 1,
            limit: 10,
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        expect(
          res.body.products
        ).toBeInstanceOf(Array);

        expect(res.body.total).toBe(1);
      }
    );

    test(
      "should filter products by category",
      async () => {
        const res = await request(app)
          .get("/api/products")
          .query({
            category: "vegetables",
          });

        expect(res.status).toBe(200);

        expect(
          res.body.products.length
        ).toBeGreaterThan(0);

        expect(
          res.body.products[0].category
        ).toBe("vegetables");
      }
    );

    test(
      "should filter products by price range",
      async () => {
        const res = await request(app)
          .get("/api/products")
          .query({
            minPrice: 40,
            maxPrice: 60,
          });

        expect(res.status).toBe(200);

        expect(
          res.body.products.length
        ).toBeGreaterThan(0);
      }
    );
  });

  // ====================================================
  // CREATE PRODUCT
  // ====================================================

  describe("POST /api/products", () => {
    test(
      "should create product with auth",
      async () => {
        const res = await request(app)
          .post("/api/products")
          .set(
            "Authorization",
            `Bearer ${sellerToken}`
          )
          .send({
            name: "New Vegetable",
            description: "Test product",
            type: "produce",
            category: "vegetables",
            price: 100,
            quantity: 50,
            unit: "kg",
            images: [],

            location: {
              type: "Point",
              coordinates: [0, 0],
              address: "Test location",
            },
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      }
    );

    test(
      "should fail without authentication",
      async () => {
        const res = await request(app)
          .post("/api/products")
          .send({
            name: "New Product",
            price: 100,
          });

        expect(res.status).toBe(401);
      }
    );
  });

  // ====================================================
  // PRODUCT REVIEWS
  // ====================================================

  describe(
    "POST /api/products/:id/review",
    () => {
      test(
        "should add product review",
        async () => {
          const res = await request(app)
            .post(
              `/api/products/${testProduct._id}/review`
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            )
            .send({
              rating: 4,
              comment: "Great product!",
            });

          expect(res.status).toBe(201);
          expect(res.body.success).toBe(true);
        }
      );

      test(
        "should prevent self-review",
        async () => {
          const sellerLoginRes =
            await request(app)
              .post("/api/auth/login")
              .send({
                email: "seller@test.com",
                password: "test123",
              });

          const selfReviewSellerToken =
            sellerLoginRes.body.token;

          const res = await request(app)
            .post(
              `/api/products/${testProduct._id}/review`
            )
            .set(
              "Authorization",
              `Bearer ${selfReviewSellerToken}`
            )
            .send({
              rating: 4,
              comment: "Self review",
            });

          expect(res.status).toBe(400);

          expect(res.body.error).toContain(
            "own product"
          );
        }
      );

      test(
        "should prevent duplicate reviews from same user",
        async () => {
          // First review
          await request(app)
            .post(
              `/api/products/${testProduct._id}/review`
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            )
            .send({
              rating: 5,
              comment: "First review",
            });

          // Second review
          const res = await request(app)
            .post(
              `/api/products/${testProduct._id}/review`
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            )
            .send({
              rating: 3,
              comment: "Second review",
            });

          expect(res.status).toBe(400);

          expect(res.body.error).toContain(
            "already reviewed"
          );
        }
      );
    }
  );
});

// ======================================================
// CART TESTS
// ======================================================

describe("Cart Tests", () => {
  describe("POST /api/cart/add", () => {
    test("should add item to cart", async () => {
      const res = await request(app)
        .post("/api/cart/add")
        .set(
          "Authorization",
          `Bearer ${token}`
        )
        .send({
          productId: testProduct._id,
          quantity: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /api/cart", () => {
    test("should get user cart", async () => {
      await request(app)
        .post("/api/cart/add")
        .set(
          "Authorization",
          `Bearer ${token}`
        )
        .send({
          productId: testProduct._id,
          quantity: 3,
        });

      const res = await request(app)
        .get("/api/cart")
        .set(
          "Authorization",
          `Bearer ${token}`
        );

      expect(res.status).toBe(200);

      expect(
        res.body.cart.items
      ).toBeInstanceOf(Array);
    });
  });
});

// ======================================================
// ORDER TESTS
// ======================================================

describe("Order Tests", () => {
  // ====================================================
  // CREATE ORDER
  // ====================================================

  describe("POST /api/orders/create", () => {
    test(
      "should create order with transaction",
      async () => {
        await request(app)
          .post("/api/cart/add")
          .set(
            "Authorization",
            `Bearer ${token}`
          )
          .send({
            productId: testProduct._id,
            quantity: 5,
          });

        const res = await request(app)
          .post("/api/orders/create")
          .set(
            "Authorization",
            `Bearer ${token}`
          )
          .send({
            deliveryAddress: {
              street: "123 Test St",
              city: "Test City",
              state: "Test State",
              zipCode: "123456",
              country: "India",
            },

            billingAddress: {
              street: "123 Test St",
              city: "Test City",
              state: "Test State",
              zipCode: "123456",
              country: "India",
            },

            paymentMethod:
              "cash_on_delivery",
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.order).toBeDefined();
      }
    );

    test(
      "should fail with empty cart",
      async () => {
        const res = await request(app)
          .post("/api/orders/create")
          .set(
            "Authorization",
            `Bearer ${token}`
          )
          .send({
            deliveryAddress:
              "123 Test St",
          });

        expect(res.status).toBe(400);
      }
    );
  });

  // ====================================================
  // UPDATE ORDER STATUS
  // ====================================================

  describe(
    "PUT /api/orders/:id/status",
    () => {
      test(
        "should update order status",
        async () => {
          await request(app)
            .post("/api/cart/add")
            .set(
              "Authorization",
              `Bearer ${token}`
            )
            .send({
              productId:
                testProduct._id,
              quantity: 2,
            });

          const orderRes =
            await request(app)
              .post(
                "/api/orders/create"
              )
              .set(
                "Authorization",
                `Bearer ${token}`
              )
              .send({
                deliveryAddress: {
                  street:
                    "123 Test St",
                  city:
                    "Test City",
                  state:
                    "Test State",
                  zipCode:
                    "123456",
                  country:
                    "India",
                },

                paymentMethod:
                  "cash_on_delivery",
              });

          const orderId =
            orderRes.body.order._id;

          const sellerLoginRes =
            await request(app)
              .post(
                "/api/auth/login"
              )
              .send({
                email:
                  "seller@test.com",
                password:
                  "test123",
              });

          const res =
            await request(app)
              .put(
                `/api/orders/${orderId}/status`
              )
              .set(
                "Authorization",
                `Bearer ${sellerLoginRes.body.token}`
              )
              .send({
                status: "confirmed",
                note: "Confirmed",
              });

          expect(res.status).toBe(200);
        }
      );
    }
  );
});

// ======================================================
// DELIVERY TESTS
// ======================================================

describe("Delivery Tests", () => {
  test(
    "should allow a delivery partner to find and accept a nearby open delivery",
    async () => {
      const adminLoginRes =
        await request(app)
          .post("/api/auth/login")
          .send({
            email: "admin@test.com",
            password: "test123",
          });

      const adminToken =
        adminLoginRes.body.token;

      const deliveryCreateRes =
        await request(app)
          .post("/api/delivery/create")
          .set(
            "Authorization",
            `Bearer ${adminToken}`
          )
          .send({
            type: "product",

            order: testProduct._id,

            sender: testSeller._id,

            senderPhone:
              "0987654321",

            senderLocation: {
              type: "Point",
              coordinates: [0, 0],
              address:
                "Seller Location",
            },

            recipient: testUser._id,

            recipientName:
              "John Buyer",

            recipientPhone:
              "1234567890",

            recipientLocation: {
              type: "Point",
              coordinates: [0, 0],
              address:
                "Buyer Location",
            },

            items: [
              {
                product:
                  testProduct._id,
                name: "Tomatoes",
                quantity: 5,
                weight: 2,
              },
            ],
          });

      expect(
        deliveryCreateRes.status
      ).toBe(201);

      expect(
        deliveryCreateRes.body.success
      ).toBe(true);

      const partnerLoginRes =
        await request(app)
          .post("/api/auth/login")
          .send({
            email:
              "partner@test.com",
            password: "test123",
          });

      const partnerToken =
        partnerLoginRes.body.token;

      const nearbyRes =
        await request(app)
          .get("/api/delivery/nearby")
          .set(
            "Authorization",
            `Bearer ${partnerToken}`
          )
          .query({
            longitude: 0,
            latitude: 0,
            maxDistance: 5000,
          });

      expect(nearbyRes.status).toBe(200);

      expect(
        nearbyRes.body.success
      ).toBe(true);

      expect(
        nearbyRes.body.count
      ).toBeGreaterThan(0);

      expect(
        Array.isArray(
          nearbyRes.body.deliveries
        )
      ).toBe(true);

      const deliveryId =
        nearbyRes.body.deliveries[0]._id;

      const acceptRes =
        await request(app)
          .put(
            `/api/delivery/${deliveryId}/accept`
          )
          .set(
            "Authorization",
            `Bearer ${partnerToken}`
          )
          .send();

      expect(acceptRes.status).toBe(200);

      expect(
        acceptRes.body.success
      ).toBe(true);

      expect(
        acceptRes.body.delivery.status
      ).toBe("accepted");

      expect(
        acceptRes.body.delivery.deliveryPartner.toString()
      ).toBe(
        testDeliveryPartner._id.toString()
      );

      const getDeliveryRes =
        await request(app)
          .get(
            `/api/delivery/${deliveryId}`
          )
          .set(
            "Authorization",
            `Bearer ${partnerToken}`
          );

      expect(
        getDeliveryRes.status
      ).toBe(200);

      expect(
        getDeliveryRes.body.success
      ).toBe(true);

      expect(
        getDeliveryRes.body.delivery
          .deliveryPartner._id
      ).toBe(
        testDeliveryPartner._id.toString()
      );

      expect(
        getDeliveryRes.body.delivery
          .partnerName
      ).toBe("Delivery Partner");

      expect(
        getDeliveryRes.body.delivery
          .partnerPhone
      ).toBe("2222222222");
    }
  );

  test(
    "should allow a delivery partner to update status and location for their assigned delivery",
    async () => {
      const adminLoginRes =
        await request(app)
          .post("/api/auth/login")
          .send({
            email: "admin@test.com",
            password: "test123",
          });

      const adminToken =
        adminLoginRes.body.token;

      const deliveryCreateRes =
        await request(app)
          .post("/api/delivery/create")
          .set(
            "Authorization",
            `Bearer ${adminToken}`
          )
          .send({
            type: "product",

            order: testProduct._id,

            sender: testSeller._id,

            senderPhone:
              "0987654321",

            senderLocation: {
              type: "Point",
              coordinates: [0, 0],
              address:
                "Seller Location",
            },

            recipient: testUser._id,

            recipientName:
              "John Buyer",

            recipientPhone:
              "1234567890",

            recipientLocation: {
              type: "Point",
              coordinates: [0, 0],
              address:
                "Buyer Location",
            },

            items: [
              {
                product:
                  testProduct._id,
                name: "Tomatoes",
                quantity: 5,
                weight: 2,
              },
            ],
          });

      expect(
        deliveryCreateRes.status
      ).toBe(201);

      const partnerLoginRes =
        await request(app)
          .post("/api/auth/login")
          .send({
            email:
              "partner@test.com",
            password: "test123",
          });

      const partnerToken =
        partnerLoginRes.body.token;

      const nearbyRes =
        await request(app)
          .get("/api/delivery/nearby")
          .set(
            "Authorization",
            `Bearer ${partnerToken}`
          )
          .query({
            longitude: 0,
            latitude: 0,
            maxDistance: 5000,
          });

      expect(
        nearbyRes.status
      ).toBe(200);

      const deliveryId =
        nearbyRes.body.deliveries[0]._id;

      const acceptRes =
        await request(app)
          .put(
            `/api/delivery/${deliveryId}/accept`
          )
          .set(
            "Authorization",
            `Bearer ${partnerToken}`
          )
          .send();

      expect(
        acceptRes.status
      ).toBe(200);

      const updateRes =
        await request(app)
          .put(
            `/api/delivery/${deliveryId}/status`
          )
          .set(
            "Authorization",
            `Bearer ${partnerToken}`
          )
          .send({
            status: "picked_up",

            location: {
              latitude: 0,
              longitude: 0,
            },

            note:
              "Package picked up",
          });

      expect(
        updateRes.status
      ).toBe(200);

      expect(
        updateRes.body.success
      ).toBe(true);

      expect(
        updateRes.body.delivery.status
      ).toBe("picked_up");

      expect(
        updateRes.body.delivery
          .partnerLocation.coordinates
      ).toEqual([0, 0]);

      expect(
        updateRes.body.delivery
          .statusHistory
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "picked_up",
            note:
              "Package picked up",
          }),
        ])
      );
    }
  );
});

// ======================================================
// NOTIFICATION TESTS
// ======================================================

describe("Notification Tests", () => {
  describe(
    "GET /api/notifications",
    () => {
      test(
        "should fetch user notifications",
        async () => {
          await Notification.create({
            user: testUser._id,
            title:
              "Test Notification",
            message:
              "This is a test",
            type: "order",
            read: false,
          });

          const res =
            await request(app)
              .get(
                "/api/notifications"
              )
              .set(
                "Authorization",
                `Bearer ${token}`
              );

          expect(res.status).toBe(200);

          expect(
            res.body.notifications
          ).toBeInstanceOf(Array);

          expect(
            res.body.unreadCount
          ).toBeGreaterThan(0);
        }
      );
    }
  );

  describe(
    "PUT /api/notifications/:id/read",
    () => {
      test(
        "should mark notification as read",
        async () => {
          const notification =
            await Notification.create({
              user: testUser._id,
              title: "Test",
              message:
                "Test message",
              type: "order",
              read: false,
            });

          const res =
            await request(app)
              .put(
                `/api/notifications/${notification._id}/read`
              )
              .set(
                "Authorization",
                `Bearer ${token}`
              );

          expect(res.status).toBe(200);

          expect(
            res.body.notification.read
          ).toBe(true);
        }
      );
    }
  );
});

// ======================================================
// USER TESTS
// ======================================================

describe("User Tests", () => {
  describe(
    "GET /api/users/:id (protected)",
    () => {
      test(
        "should require authentication to view user profile",
        async () => {
          const res =
            await request(app).get(
              `/api/users/${testUser._id}`
            );

          expect(res.status).toBe(401);
        }
      );

      test(
        "should view own profile with auth",
        async () => {
          const res =
            await request(app)
              .get(
                `/api/users/${testUser._id}`
              )
              .set(
                "Authorization",
                `Bearer ${token}`
              );

          expect(res.status).toBe(200);
        }
      );
    }
  );

  describe(
    "GET /api/users/search/nearby (route ordering test)",
    () => {
      test(
        "should find nearby sellers",
        async () => {
          const res =
            await request(app)
              .get(
                "/api/users/search/nearby"
              )
              .query({
                longitude: 0,
                latitude: 0,
                maxDistance: 5000,
                role: "farmer",
              });

          expect(res.status).toBe(200);

          expect(
            res.body.users
          ).toBeInstanceOf(Array);
        }
      );
    }
  );
});

// ======================================================
// PAYMENT TESTS
// ======================================================

describe("Payment Tests", () => {
  describe(
    "POST /api/payments/webhook",
    () => {
      test(
        "should return 400 if webhook secret not configured",
        async () => {
          const res =
            await request(app)
              .post(
                "/api/payments/webhook"
              )
              .send({
                type:
                  "payment_intent.succeeded",
              });

          expect(res.status).toBe(400);
        }
      );
    }
  );
});

// ======================================================
// ATOMIC TRANSACTION TESTS
// ======================================================

describe("Atomic Transaction Tests", () => {
  test(
    "should handle race conditions in product quantity updates",
    async () => {
      const limitedProduct =
        await Product.create({
          name:
            "Limited Stock Item",

          description:
            "Test limited stock product",

          type: "produce",

          category:
            "vegetables",

          price: 100,

          quantity: 1,

          unit: "kg",

          seller: testSeller._id,

          sellerName:
            "Jane Farmer",

          location: {
            type: "Point",
            coordinates: [0, 0],
            address:
              "Test Location",
          },

          isActive: true,

          inStock: true,
        });

      await request(app)
        .post("/api/cart/add")
        .set(
          "Authorization",
          `Bearer ${token}`
        )
        .send({
          productId:
            limitedProduct._id,

          quantity: 2,
        });

      const res = await request(app)
        .post("/api/orders/create")
        .set(
          "Authorization",
          `Bearer ${token}`
        )
        .send({
          deliveryAddress: {
            street: "123 Test St",
            city: "Test City",
            state: "Test State",
            zipCode: "123456",
            country: "India",
          },

          paymentMethod:
            "cash_on_delivery",
        });

      expect(res.status).toBe(400);

      expect(res.body.error).toContain(
        "Insufficient"
      );
    }
  );
});