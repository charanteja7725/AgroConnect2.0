process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "t".repeat(80);
process.env.JWT_RESET_SECRET = process.env.JWT_RESET_SECRET || "r".repeat(80);

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app } = require("../server");
const User = require("../models/User");
const Product = require("../models/Product");

let mongoServer;
let farmer;
let buyer;
let admin;
let employee;
let outsideEmployee;
let farmerToken;
let buyerToken;
let adminToken;
let employeeToken;
let outsideEmployeeToken;

const media = (publicId, resourceType = "image") => ({
  url: `https://example.invalid/${publicId}`,
  publicId,
  resourceType,
  deliveryType: "authenticated",
  uploadedAt: new Date(),
});

const farmLocation = {
  latitude: 17.385,
  longitude: 78.4867,
  address: "Survey 10, Green Farm Road",
  village: "Test Village",
  district: "Hyderabad",
  state: "Telangana",
  pincode: "500001",
};

const otherFarmLocation = {
  ...farmLocation,
  latitude: 16.5062,
  longitude: 80.648,
  district: "Krishna",
  state: "Andhra Pradesh",
};

const login = async (email, password = "test12345") => {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return response.body.token;
};

const persistEvidence = async (userId, location = farmLocation) =>
  User.findByIdAndUpdate(
    userId,
    {
      $set: {
        "verificationDocuments.aadhaarFront": media("aadhaar-front"),
        "verificationDocuments.aadhaarBack": media("aadhaar-back"),
        "verificationDocuments.farmPhoto": media("farm-photo"),
        "verificationDocuments.farmingVideo": media("farm-video", "video"),
        "verificationDocuments.farmLocation": location,
      },
    },
    { new: true }
  );

const createActiveFarmerProduct = async () =>
  Product.create({
    name: "Tomatoes",
    description: "Fresh red tomatoes",
    type: "produce",
    category: "vegetables",
    price: 50,
    quantity: 25,
    unit: "kg",
    seller: farmer._id,
    sellerName: "Test Farmer",
    location: { type: "Point", coordinates: [78.4867, 17.385] },
    isActive: true,
    inStock: true,
  });

beforeAll(async () => {
  jest.setTimeout(60000);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Product.deleteMany({})]);

  farmer = await User.create({
    firstName: "Test",
    lastName: "Farmer",
    email: "farmer-verification@test.com",
    password: "test12345",
    phone: "1111111111",
    role: "farmer",
    address: { street: "Private Street", city: "Hyderabad", state: "Telangana" },
    bankAccount: {
      accountHolderName: "Test Farmer",
      accountNumber: "1234567890",
      ifscCode: "TEST0001",
      bankName: "Private Bank",
    },
  });

  buyer = await User.create({
    firstName: "Test",
    lastName: "Buyer",
    email: "buyer-verification@test.com",
    password: "test12345",
    phone: "2222222222",
    role: "buyer",
  });

  admin = await User.create({
    firstName: "Admin",
    lastName: "Reviewer",
    email: "admin-verification@test.com",
    password: "test12345",
    phone: "3333333333",
    role: "admin",
  });

  employee = await User.create({
    firstName: "Local",
    lastName: "Reviewer",
    email: "employee-verification@test.com",
    password: "test12345",
    phone: "4444444444",
    role: "verification_employee",
    verificationArea: {
      state: "Telangana",
      districts: ["Hyderabad"],
    },
  });

  outsideEmployee = await User.create({
    firstName: "Outside",
    lastName: "Reviewer",
    email: "outside-verification@test.com",
    password: "test12345",
    phone: "5555555555",
    role: "verification_employee",
    verificationArea: {
      state: "Andhra Pradesh",
      districts: ["Krishna"],
    },
  });

  farmerToken = await login(farmer.email);
  buyerToken = await login(buyer.email);
  adminToken = await login(admin.email);
  employeeToken = await login(employee.email);
  outsideEmployeeToken = await login(outsideEmployee.email);
});

describe("Farmer verification and security", () => {
  test("blocks product creation for an unverified farmer", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({
        name: "Tomatoes",
        description: "Fresh tomatoes",
        type: "produce",
        category: "vegetables",
        price: 30,
        quantity: 10,
        unit: "kg",
        location: { type: "Point", coordinates: [78.4867, 17.385] },
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/approve|verified/i);
  });

  test("rejects forged verification media that was not persisted by upload routes", async () => {
    const res = await request(app)
      .post("/api/users/verify/submit")
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({
        aadhaarFront: media("fake-front"),
        aadhaarBack: media("fake-back"),
        farmPhoto: media("fake-farm"),
        farmingVideo: media("fake-video", "video"),
        farmLocation,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/aadhaar front/i);
  });

  test("rejects placeholder zero-zero GPS even when all media exists", async () => {
    await persistEvidence(farmer._id, {
      ...farmLocation,
      latitude: 0,
      longitude: 0,
    });

    const res = await request(app)
      .post("/api/users/verify/submit")
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({
        farmLocation: { ...farmLocation, latitude: 0, longitude: 0 },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/gps|non-zero/i);
  });

  test("submits complete persisted evidence for manual review", async () => {
    await persistEvidence(farmer._id);

    const res = await request(app)
      .post("/api/users/verify/submit")
      .set("Authorization", `Bearer ${farmerToken}`)
      .send({ farmLocation, additionalNotes: "Vegetable farmer" });

    expect(res.status).toBe(200);
    expect(res.body.verificationStatus).toBe("pending");

    const saved = await User.findById(farmer._id);
    expect(saved.verificationStatus).toBe("pending");
    expect(saved.isVerified).toBe(false);
    expect(saved.location.coordinates).toEqual([farmLocation.longitude, farmLocation.latitude]);
  });

  test("area employee sees only farmers in the assigned area", async () => {
    await persistEvidence(farmer._id);
    await User.findByIdAndUpdate(farmer._id, { verificationStatus: "pending" });

    const outsideFarmer = await User.create({
      firstName: "Outside",
      lastName: "Farmer",
      email: "outside-farmer@test.com",
      password: "test12345",
      phone: "6666666666",
      role: "farmer",
      verificationStatus: "pending",
    });
    await persistEvidence(outsideFarmer._id, otherFarmLocation);

    const res = await request(app)
      .get("/api/users/verify/pending?status=pending")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.farmers).toHaveLength(1);
    expect(res.body.farmers[0]._id.toString()).toBe(farmer._id.toString());
  });

  test("employee cannot review a farmer outside the assigned area", async () => {
    await persistEvidence(farmer._id);
    await User.findByIdAndUpdate(farmer._id, { verificationStatus: "pending" });

    const res = await request(app)
      .put(`/api/users/verify/${farmer._id}`)
      .set("Authorization", `Bearer ${outsideEmployeeToken}`)
      .send({ action: "verified", notes: "Approved" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/outside.*assigned|assigned verification area/i);
  });

  test("assigned employee can manually approve complete farmer evidence", async () => {
    await persistEvidence(farmer._id);
    await User.findByIdAndUpdate(farmer._id, { verificationStatus: "pending" });

    const res = await request(app)
      .put(`/api/users/verify/${farmer._id}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ action: "verified", notes: "Evidence and farm location checked." });

    expect(res.status).toBe(200);

    const saved = await User.findById(farmer._id);
    expect(saved.verificationStatus).toBe("verified");
    expect(saved.isVerified).toBe(true);
    expect(saved.farmerVerification.verifiedBy.toString()).toBe(employee._id.toString());
  });

  test("rejected farmer immediately loses public active product listings", async () => {
    await persistEvidence(farmer._id);
    await User.findByIdAndUpdate(farmer._id, {
      verificationStatus: "pending",
      isVerified: false,
    });
    const product = await createActiveFarmerProduct();

    const review = await request(app)
      .put(`/api/users/verify/${farmer._id}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ action: "rejected", rejectionReason: "Farm evidence did not match." });

    expect(review.status).toBe(200);
    const savedProduct = await Product.findById(product._id);
    expect(savedProduct.isActive).toBe(false);
  });

  test("admin suspension hides seller listings and invalidates an already issued farmer JWT", async () => {
    await persistEvidence(farmer._id);
    await User.findByIdAndUpdate(farmer._id, {
      verificationStatus: "verified",
      isVerified: true,
    });
    const product = await createActiveFarmerProduct();

    const suspend = await request(app)
      .put(`/api/users/${farmer._id}/suspend`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "suspend" });

    expect(suspend.status).toBe(200);
    expect((await Product.findById(product._id)).isActive).toBe(false);

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${farmerToken}`);
    expect(me.status).toBe(403);
  });

  test("suspended user is blocked even when holding an unexpired JWT", async () => {
    await User.findByIdAndUpdate(buyer._id, { isActive: false });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/suspended|deactivated/i);
  });

  test("another user cannot fetch farmer bank or verification evidence", async () => {
    await persistEvidence(farmer._id);

    const res = await request(app)
      .get(`/api/users/${farmer._id}`)
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.bankAccount).toBeUndefined();
    expect(res.body.user.verificationDocuments).toBeUndefined();
    expect(res.body.user.adminReview).toBeUndefined();
    expect(res.body.user.email).toBeUndefined();
    expect(res.body.user.phone).toBeUndefined();
  });

  test("public product responses do not expose seller private fields", async () => {
    await User.findByIdAndUpdate(farmer._id, {
      verificationStatus: "verified",
      isVerified: true,
    });
    await createActiveFarmerProduct();

    const res = await request(app).get("/api/products");

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    const seller = res.body.products[0].seller;
    expect(seller.firstName).toBe("Test");
    expect(seller.bankAccount).toBeUndefined();
    expect(seller.verificationDocuments).toBeUndefined();
    expect(seller.email).toBeUndefined();
    expect(seller.phone).toBeUndefined();
  });

  test("admin API is mounted and can create an area verification employee", async () => {
    const stats = await request(app)
      .get("/api/admin/stats")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(stats.status).toBe(200);
    expect(stats.body.success).toBe(true);

    const create = await request(app)
      .post("/api/admin/verification-employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        firstName: "New",
        lastName: "Employee",
        email: "new.employee@test.com",
        password: "temporary123",
        phone: "7777777777",
        state: "Tamil Nadu",
        districts: ["Chennai"],
      });

    expect(create.status).toBe(201);
    expect(create.body.employee.role).toBe("verification_employee");
    expect(create.body.employee.verificationArea.state).toBe("Tamil Nadu");
  });
});
