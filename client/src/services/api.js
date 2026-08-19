const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem("token");
  const { timeoutMs = 20000, ...requestOptions } = options;
  const isFormData = requestOptions.body instanceof FormData;

  const headers = {
    ...(requestOptions.headers || {}),
  };

  if (!isFormData && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...requestOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorBody = null;
      try {
        errorBody = await response.json();
      } catch (parseError) {
        console.error("Failed to parse error response:", parseError);
      }

      const errorMessage =
        errorBody?.error ||
        errorBody?.message ||
        (Array.isArray(errorBody?.errors)
          ? errorBody.errors.map((err) => err.msg).join(", ")
          : null) ||
        response.statusText ||
        "API request failed";

      throw new Error(errorMessage);
    }

    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }

    return await response.text();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }

    if (error.name === "TypeError" && error.message.includes("Failed to fetch")) {
      throw new Error(
        "Unable to connect to the backend server. Please check your backend."
      );
    }

    console.error("API Error:", error);
    throw error;
  }
};

export const authAPI = {
  register: (userData) => apiRequest("/auth/register", { method: "POST", body: JSON.stringify(userData) }),
  login: (email, password) => apiRequest("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  getMe: () => apiRequest("/auth/me"),
  logout: () => apiRequest("/auth/logout", { method: "POST" }),
  forgotPassword: (email) => apiRequest("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token, password) => apiRequest(`/auth/reset-password/${token}`, { method: "POST", body: JSON.stringify({ password }) }),
};

export const userAPI = {
  getUser: (id) => apiRequest(`/users/${id}`),
  updateProfile: (id, userData) => apiRequest(`/users/${id}`, { method: "PUT", body: JSON.stringify(userData) }),
  getNearby: (longitude, latitude, maxDistance = 10, role = "farmer") => apiRequest(`/users/search/nearby?longitude=${encodeURIComponent(longitude)}&latitude=${encodeURIComponent(latitude)}&maxDistance=${encodeURIComponent(maxDistance)}&role=${encodeURIComponent(role)}`),
  addReview: (userId, rating, comment) => apiRequest(`/users/${userId}/review`, { method: "POST", body: JSON.stringify({ rating, comment }) }),
  getUsersByRole: (role) => apiRequest(`/users/role/${encodeURIComponent(role)}`),
  submitVerification: (data = {}) => {
    const hasManualEvidence = Boolean(data.aadhaarFront || data.aadhaarBack || data.farmPhoto || data.farmingVideo || data.farmLocation);
    if (!hasManualEvidence && typeof window !== "undefined") {
      window.location.assign("/verification");
      return Promise.resolve({ success: true, verificationStatus: "not_submitted", message: "Opening the complete manual farmer verification form..." });
    }
    return apiRequest("/users/verify/submit", { method: "POST", body: JSON.stringify(data) });
  },
  getPendingVerifications: (status = "pending") => apiRequest(`/users/verify/pending?status=${encodeURIComponent(status)}`),
  reviewVerification: (farmerId, action, notes = "", rejectionReason = "", moreInfoRequest = "") => apiRequest(`/users/verify/${farmerId}`, { method: "PUT", body: JSON.stringify({ action, notes, rejectionReason, moreInfoRequest }) }),
  suspendUser: (userId, action) => apiRequest(`/users/${userId}/suspend`, { method: "PUT", body: JSON.stringify({ action }) }),
};

export const productAPI = {
  getAllProducts: (filters = {}) => { const params = new URLSearchParams(filters); const queryString = params.toString(); return apiRequest(queryString ? `/products?${queryString}` : "/products"); },
  getProduct: (id) => apiRequest(`/products/${id}`),
  createProduct: (productData) => apiRequest("/products", { method: "POST", body: JSON.stringify(productData) }),
  updateProduct: (id, productData) => apiRequest(`/products/${id}`, { method: "PUT", body: JSON.stringify(productData) }),
  deleteProduct: (id) => apiRequest(`/products/${id}`, { method: "DELETE" }),
  getSellerProducts: (sellerId) => apiRequest(`/products/seller/${sellerId}`),
  addReview: (productId, rating, comment) => apiRequest(`/products/${productId}/review`, { method: "POST", body: JSON.stringify({ rating, comment }) }),
};

export const cartAPI = {
  getCart: () => apiRequest("/cart"),
  addToCart: (productId, quantity) => apiRequest("/cart/add", { method: "POST", body: JSON.stringify({ productId, quantity }) }),
  updateCartItem: (itemId, quantity) => apiRequest(`/cart/update/${itemId}`, { method: "PUT", body: JSON.stringify({ quantity }) }),
  removeFromCart: (itemId) => apiRequest(`/cart/remove/${itemId}`, { method: "DELETE" }),
  clearCart: () => apiRequest("/cart/clear", { method: "DELETE" }),
};

export const orderAPI = {
  getOrders: () => apiRequest("/orders"),
  getOrder: (id) => apiRequest(`/orders/${id}`),
  createOrder: (orderData) => apiRequest("/orders/create", { method: "POST", body: JSON.stringify(orderData) }),
  updateOrderStatus: (id, status, note) => apiRequest(`/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status, note }) }),
  cancelOrder: (id, cancelReason) => apiRequest(`/orders/${id}/cancel`, { method: "POST", body: JSON.stringify({ cancelReason }) }),
};

export const paymentAPI = {
  createPaymentIntent: (orderId, amount) => apiRequest("/payments/create-intent", { method: "POST", body: JSON.stringify({ orderId, amount }) }),
  confirmPayment: (paymentId, orderId, paymentData = {}) => apiRequest("/payments/confirm", { method: "POST", body: JSON.stringify({ paymentId, orderId, ...paymentData }) }),
  getPayment: (orderId) => apiRequest(`/payments/${orderId}`),
};

export const deliveryAPI = {
  getDeliveries: () => apiRequest("/delivery"),
  getDelivery: (id) => apiRequest(`/delivery/${id}`),
  updateDeliveryStatus: (id, status, location, note) => apiRequest(`/delivery/${id}/status`, { method: "PUT", body: JSON.stringify({ status, location, note }) }),
  acceptDelivery: (id) => apiRequest(`/delivery/${id}/accept`, { method: "PUT" }),
  getNearbyDeliveries: (longitude, latitude, maxDistance = 10) => apiRequest(`/delivery/nearby?longitude=${encodeURIComponent(longitude)}&latitude=${encodeURIComponent(latitude)}&maxDistance=${encodeURIComponent(maxDistance)}`),
};

export const pricingAPI = {
  suggestPrice: (productType, category, quantity, currentPrice) => apiRequest("/pricing/suggest", { method: "POST", body: JSON.stringify({ productType, category, quantity, currentPrice }) }),
  getTrends: (category) => apiRequest(`/pricing/trends/${encodeURIComponent(category)}`),
  getMarketAnalysis: () => apiRequest("/pricing/market-analysis"),
};

const uploadVerificationFile = async (field, file) => {
  if (!file) throw new Error("Select a verification file before uploading.");
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error("The selected verification file is empty. Please choose the file again.");
  }

  const signatureData = await apiRequest("/upload/verification/signature", {
    method: "POST",
    body: JSON.stringify({ field }),
    timeoutMs: 20000,
  });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signatureData.apiKey);
  formData.append("timestamp", String(signatureData.timestamp));
  formData.append("signature", signatureData.signature);
  formData.append("folder", signatureData.folder);

  const deliveryType = signatureData.type || "authenticated";
  const controller = new AbortController();
  const directTimeoutMs = file.type?.startsWith("video/") ? 300000 : 120000;
  const timeoutId = setTimeout(() => controller.abort(), directTimeoutMs);

  let cloudinaryResult;
  try {
    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(signatureData.cloudName)}/${encodeURIComponent(signatureData.resourceType)}/${encodeURIComponent(deliveryType)}`,
      {
        method: "POST",
        body: formData,
        signal: controller.signal,
      }
    );

    cloudinaryResult = await cloudinaryResponse.json();

    if (!cloudinaryResponse.ok) {
      throw new Error(cloudinaryResult?.error?.message || "Cloudinary verification upload failed");
    }
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Verification media upload timed out. Please use a shorter/smaller file and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  return apiRequest("/upload/verification/complete", {
    method: "POST",
    body: JSON.stringify({ field, publicId: cloudinaryResult.public_id }),
    timeoutMs: 30000,
  });
};

export const uploadAPI = {
  uploadImage: (formData) => apiRequest("/upload/image", { method: "POST", body: formData, timeoutMs: 120000 }),
  uploadAadhaarFront: (file) => uploadVerificationFile("aadhaarFront", file),
  uploadAadhaarBack: (file) => uploadVerificationFile("aadhaarBack", file),
  uploadFarmPhoto: (file) => uploadVerificationFile("farmPhoto", file),
  uploadFarmingVideo: (file) => uploadVerificationFile("farmingVideo", file),
};

export const notificationAPI = {
  getNotifications: () => apiRequest("/notifications"),
  markAsRead: (notificationId) => apiRequest(`/notifications/${notificationId}/read`, { method: "PUT" }),
  sendNotification: (userId, title, message, type) => apiRequest("/notifications/send", { method: "POST", body: JSON.stringify({ userId, title, message, type }) }),
};

export const adminAPI = {
  getStats: () => apiRequest("/admin/stats"),
  getUsers: (params = {}) => { const query = new URLSearchParams(params).toString(); return apiRequest(query ? `/admin/users?${query}` : "/admin/users"); },
  getOrders: (params = {}) => { const query = new URLSearchParams(params).toString(); return apiRequest(query ? `/admin/orders?${query}` : "/admin/orders"); },
  getProducts: (params = {}) => { const query = new URLSearchParams(params).toString(); return apiRequest(query ? `/admin/products?${query}` : "/admin/products"); },
  getDeliveries: (params = {}) => { const query = new URLSearchParams(params).toString(); return apiRequest(query ? `/admin/deliveries?${query}` : "/admin/deliveries"); },
  updateUserStatus: (userId, isActive) => apiRequest(`/admin/users/${userId}/status`, { method: "PUT", body: JSON.stringify({ isActive }) }),
  updateOrderStatus: (orderId, status, note) => apiRequest(`/admin/orders/${orderId}/status`, { method: "PUT", body: JSON.stringify({ status, note }) }),
  deleteProduct: (productId) => apiRequest(`/admin/products/${productId}`, { method: "DELETE" }),
  getVerifications: () => apiRequest("/admin/verifications"),
  reviewVerification: (userId, status, reviewNotes) => apiRequest(`/admin/verifications/${userId}`, { method: "PUT", body: JSON.stringify({ status, reviewNotes }) }),
  sendNotification: (userIds, title, message, type) => apiRequest("/admin/notifications/send", { method: "POST", body: JSON.stringify({ userIds, title, message, type }) }),
};

export default { authAPI, userAPI, productAPI, cartAPI, orderAPI, paymentAPI, deliveryAPI, pricingAPI, uploadAPI, notificationAPI, adminAPI };
