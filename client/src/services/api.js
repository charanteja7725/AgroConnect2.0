const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

// Helper function to make API requests
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem("token");
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(options.headers || {}),
  };

  const isFormData = options.body instanceof FormData;
  if (!isFormData && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch (parseError) {
        console.error("Failed to parse error response", parseError);
      }

      const errorMessage =
        (errorBody && errorBody.error) ||
        (errorBody && Array.isArray(errorBody.errors) && errorBody.errors.map((err) => err.msg).join(", ")) ||
        response.statusText ||
        "API request failed";

      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    if (error.name === "TypeError" && error.message.includes("Failed to fetch")) {
      throw new Error("Backend server is not running. Please start the server.");
    }
    console.error("API Error:", error);
    throw error;
  }
};

// Auth APIs
export const authAPI = {
  register: (userData) =>
    apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  login: (email, password) =>
    apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => apiRequest("/auth/me"),

  logout: () => apiRequest("/auth/logout", { method: "POST" }),

  forgotPassword: (email) =>
    apiRequest("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token, password) =>
    apiRequest(`/auth/reset-password/${token}`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
};

// User APIs
export const userAPI = {
  getUser: (id) => apiRequest(`/users/${id}`),

  submitVerification: (verificationData) =>
    apiRequest(`/users/verification`, {
      method: "POST",
      body: verificationData,
    }),

  updateProfile: (id, userData) =>
    apiRequest(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    }),

  getNearby: (longitude, latitude, maxDistance = 10, role = "farmer") =>
    apiRequest(`/users/search/nearby?longitude=${longitude}&latitude=${latitude}&maxDistance=${maxDistance}&role=${role}`),

  addReview: (userId, rating, comment) =>
    apiRequest(`/users/${userId}/review`, {
      method: "POST",
      body: JSON.stringify({ rating, comment }),
    }),

  // Farmer Verification
  submitVerification: (data) =>
    apiRequest("/users/verify/submit", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getPendingVerifications: (status = "pending") =>
    apiRequest(`/users/verify/pending?status=${status}`),

  reviewVerification: (farmerId, action, notes, rejectionReason, moreInfoRequest) =>
    apiRequest(`/users/verify/${farmerId}`, {
      method: "PUT",
      body: JSON.stringify({ action, notes, rejectionReason, moreInfoRequest }),
    }),

  suspendUser: (userId, action) =>
    apiRequest(`/users/${userId}/suspend`, {
      method: "PUT",
      body: JSON.stringify({ action }),
    }),
};


// Product APIs
export const productAPI = {
  getAllProducts: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return apiRequest(`/products?${params.toString()}`);
  },

  getProduct: (id) => apiRequest(`/products/${id}`),

  createProduct: (productData) =>
    apiRequest("/products", {
      method: "POST",
      body: JSON.stringify(productData),
    }),

  updateProduct: (id, productData) =>
    apiRequest(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(productData),
    }),

  deleteProduct: (id) =>
    apiRequest(`/products/${id}`, {
      method: "DELETE",
    }),

  getSellerProducts: (sellerId) =>
    apiRequest(`/products/seller/${sellerId}`),

  addReview: (productId, rating, comment) =>
    apiRequest(`/products/${productId}/review`, {
      method: "POST",
      body: JSON.stringify({ rating, comment }),
    }),
};

// Cart APIs
export const cartAPI = {
  getCart: () => apiRequest("/cart"),

  addToCart: (productId, quantity) =>
    apiRequest("/cart/add", {
      method: "POST",
      body: JSON.stringify({ productId, quantity }),
    }),

  updateCartItem: (itemId, quantity) =>
    apiRequest(`/cart/update/${itemId}`, {
      method: "PUT",
      body: JSON.stringify({ quantity }),
    }),

  removeFromCart: (itemId) =>
    apiRequest(`/cart/remove/${itemId}`, {
      method: "DELETE",
    }),

  clearCart: () =>
    apiRequest("/cart/clear", {
      method: "DELETE",
    }),
};

// Order APIs
export const orderAPI = {
  getOrders: () => apiRequest("/orders"),

  getOrder: (id) => apiRequest(`/orders/${id}`),

  createOrder: (orderData) =>
    apiRequest("/orders/create", {
      method: "POST",
      body: JSON.stringify(orderData),
    }),

  updateOrderStatus: (id, status, note) =>
    apiRequest(`/orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, note }),
    }),

  cancelOrder: (id, cancelReason) =>
    apiRequest(`/orders/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ cancelReason }),
    }),
};

// Payment APIs
export const paymentAPI = {
  createPaymentIntent: (orderId, amount) =>
    apiRequest("/payments/create-intent", {
      method: "POST",
      body: JSON.stringify({ orderId, amount }),
    }),

  confirmPayment: (paymentId, orderId, paymentData) =>
    apiRequest("/payments/confirm", {
      method: "POST",
      body: JSON.stringify({ paymentId, orderId, ...paymentData }),
    }),

  getPayment: (orderId) => apiRequest(`/payments/${orderId}`),
};

// Delivery APIs
export const deliveryAPI = {
  getDeliveries: () => apiRequest("/delivery"),

  getDelivery: (id) => apiRequest(`/delivery/${id}`),

  updateDeliveryStatus: (id, status, location, note) =>
    apiRequest(`/delivery/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, location, note }),
    }),

  acceptDelivery: (id) =>
    apiRequest(`/delivery/${id}/accept`, {
      method: "PUT",
    }),

  getNearbyDeliveries: (longitude, latitude, maxDistance) =>
    apiRequest(`/delivery/nearby?longitude=${longitude}&latitude=${latitude}&maxDistance=${maxDistance}`),
};

// Pricing APIs
export const pricingAPI = {
  suggestPrice: (productType, category, quantity, currentPrice) =>
    apiRequest("/pricing/suggest", {
      method: "POST",
      body: JSON.stringify({ productType, category, quantity, currentPrice }),
    }),

  getTrends: (category) => apiRequest(`/pricing/trends/${category}`),

  getMarketAnalysis: () => apiRequest("/pricing/market-analysis"),
};

// Upload APIs
export const uploadAPI = {
  uploadImage: (formData) =>
    apiRequest("/upload/image", {
      method: "POST",
      body: formData,
    }),
};

// Notification APIs
export const notificationAPI = {
  getNotifications: () => apiRequest("/notifications"),

  markAsRead: (notificationId) =>
    apiRequest(`/notifications/${notificationId}/read`, {
      method: "PUT",
    }),

  sendNotification: (userId, title, message, type) =>
    apiRequest("/notifications/send", {
      method: "POST",
      body: JSON.stringify({ userId, title, message, type }),
    }),
};

// Admin APIs
export const adminAPI = {
  getStats: () => apiRequest("/admin/stats"),

  getUsers: (params = {}) => {
    const query = new URLSearchParams(params);
    return apiRequest(`/admin/users?${query.toString()}`);
  },

  getOrders: (params = {}) => {
    const query = new URLSearchParams(params);
    return apiRequest(`/admin/orders?${query.toString()}`);
  },

  getProducts: (params = {}) => {
    const query = new URLSearchParams(params);
    return apiRequest(`/admin/products?${query.toString()}`);
  },

  getDeliveries: (params = {}) => {
    const query = new URLSearchParams(params);
    return apiRequest(`/admin/deliveries?${query.toString()}`);
  },

  updateUserStatus: (userId, isActive) =>
    apiRequest(`/admin/users/${userId}/status`, {
      method: "PUT",
      body: JSON.stringify({ isActive }),
    }),

  updateOrderStatus: (orderId, status, note) =>
    apiRequest(`/admin/orders/${orderId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, note }),
    }),

  deleteProduct: (productId) =>
    apiRequest(`/admin/products/${productId}`, {
      method: "DELETE",
    }),

  getVerifications: () => apiRequest("/admin/verifications"),

  reviewVerification: (userId, status, reviewNotes) =>
    apiRequest(`/admin/verifications/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ status, reviewNotes }),
    }),

  sendNotification: (userIds, title, message, type) =>
    apiRequest("/admin/notifications/send", {
      method: "POST",
      body: JSON.stringify({ userIds, title, message, type }),
    }),
};

export default {
  authAPI,
  userAPI,
  productAPI,
  cartAPI,
  orderAPI,
  paymentAPI,
  deliveryAPI,
  pricingAPI,
  notificationAPI,
};
