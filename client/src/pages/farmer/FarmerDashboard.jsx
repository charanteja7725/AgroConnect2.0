import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./farmerdashboard.css";
import { useAuth, useNotification } from "../../context/AppHooks.js";
import { productAPI, orderAPI, pricingAPI } from "../../services/api.js";

const formatAddress = (address) => {
  if (!address) return "Address not available";
  if (typeof address === "string" || typeof address === "number") return String(address);
  if (Array.isArray(address)) {
    return (
      address
        .filter((value) => typeof value === "string" || typeof value === "number")
        .join(", ") || "Address not available"
    );
  }
  if (typeof address !== "object") return "Address not available";

  const parts = [
    address.fullName,
    address.phone,
    address.street,
    address.city,
    address.state,
    address.zipCode,
    address.country,
  ]
    .filter((value) => typeof value === "string" || typeof value === "number")
    .map(String)
    .filter(Boolean);

  const landmark =
    typeof address.landmark === "string" && address.landmark.trim()
      ? ` (Landmark: ${address.landmark.trim()})`
      : "";

  return parts.length ? `${parts.join(", ")}${landmark}` : "Address not available";
};

const verificationLabel = (status) => {
  switch (status) {
    case "verified":
      return "✅ Verified Farmer";
    case "pending":
      return "⏳ Verification Pending";
    case "more_information_required":
      return "🔵 More Information Required";
    case "rejected":
      return "❌ Verification Rejected";
    case "suspended":
      return "🚫 Verification Suspended";
    default:
      return "📋 Verification Required";
  }
};

const FarmerDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { addNotification } = useNotification();

  const [activeSection, setActiveSection] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [priceEstimates, setPriceEstimates] = useState({});
  const [loadingAi, setLoadingAi] = useState({});
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalEarnings: 0,
    pendingOrders: 0,
  });

  const userId = user?._id;
  const isVerified = user?.verificationStatus === "verified";

  const goToVerification = useCallback(() => {
    navigate("/verification");
  }, [navigate]);

  const goToAddProduct = useCallback(() => {
    if (!isVerified) {
      addNotification?.("Complete farmer verification before adding products", "info");
      goToVerification();
      return;
    }
    navigate("/farmer/add-product");
  }, [addNotification, goToVerification, isVerified, navigate]);

  const fetchFarmerProducts = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError("");
      const response = await productAPI.getSellerProducts(userId);
      const sellerProducts = response.products || [];
      setProducts(sellerProducts);
      setStats((prev) => ({ ...prev, totalProducts: sellerProducts.length }));
    } catch (err) {
      console.error("Error fetching products:", err);
      setError("Failed to load products. " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchFarmerOrders = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError("");
      const response = await orderAPI.getOrders();
      const allOrders = response.orders || [];
      const farmerOrders = allOrders.filter((order) =>
        order.items?.some((item) => {
          const sellerId = item.seller?._id || item.seller;
          return sellerId?.toString() === userId.toString();
        })
      );

      let earnings = 0;
      let pendingCount = 0;

      farmerOrders.forEach((order) => {
        if (order.status === "pending") pendingCount += 1;
        if (["confirmed", "delivered"].includes(order.status)) {
          const sellerItemTotal = order.items
            ?.filter((item) => {
              const sellerId = item.seller?._id || item.seller;
              return sellerId?.toString() === userId.toString();
            })
            .reduce(
              (sum, item) => sum + (item.totalPrice || item.price * item.quantity || 0),
              0
            );
          earnings += sellerItemTotal || 0;
        }
      });

      setOrders(farmerOrders);
      setStats((prev) => ({
        ...prev,
        totalOrders: farmerOrders.length,
        pendingOrders: pendingCount,
        totalEarnings: earnings,
      }));
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError("Failed to load orders. " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (["my-products", "dashboard"].includes(activeSection)) fetchFarmerProducts();
  }, [activeSection, fetchFarmerProducts]);

  useEffect(() => {
    if (["orders", "dashboard"].includes(activeSection)) fetchFarmerOrders();
  }, [activeSection, fetchFarmerOrders]);

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product listing?")) return;
    try {
      await productAPI.deleteProduct(productId);
      const updatedProducts = products.filter((product) => product._id !== productId);
      setProducts(updatedProducts);
      setStats((prev) => ({ ...prev, totalProducts: updatedProducts.length }));
      addNotification?.("Product deleted successfully", "success");
    } catch (err) {
      setError("Failed to delete product: " + (err.message || ""));
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await orderAPI.updateOrderStatus(orderId, newStatus, "");
      const updatedOrders = orders.map((order) =>
        order._id === orderId ? { ...order, status: newStatus } : order
      );
      setOrders(updatedOrders);
      setStats((prev) => ({
        ...prev,
        pendingOrders: updatedOrders.filter((order) => order.status === "pending").length,
      }));
      addNotification?.(`Order status updated to ${newStatus}`, "success");
    } catch (err) {
      setError("Failed to update order status: " + (err.message || ""));
    }
  };

  const handleGetPriceSuggestion = async (product) => {
    setLoadingAi((prev) => ({ ...prev, [product._id]: true }));
    try {
      const response = await pricingAPI.suggestPrice(
        product.type || "produce",
        product.category || "vegetables",
        product.quantity || 1,
        product.price || 0
      );
      setPriceEstimates((prev) => ({
        ...prev,
        [product._id]: response.suggestedPrice || product.price,
      }));
    } catch (err) {
      console.error("Error getting price suggestion:", err);
      addNotification?.("Unable to get AI price suggestion", "error");
    } finally {
      setLoadingAi((prev) => ({ ...prev, [product._id]: false }));
    }
  };

  const filteredOrders = useMemo(() => {
    if (orderFilter === "all") return orders;
    return orders.filter((order) => order.status === orderFilter);
  }, [orderFilter, orders]);

  const sectionTitle = {
    dashboard: `Welcome back, ${user?.firstName || "Farmer"} 👋`,
    "my-products": "My Product Listings",
    orders: "Incoming Orders",
    profile: "Farmer Profile",
  };

  const sectionDescription = {
    dashboard: "Track farm inventory, manage buyer orders, and monitor your earnings in real-time.",
    "my-products": "Review your active crops, update stock quantities, and use AI pricing tools.",
    orders: "Manage direct orders from buyers and update order delivery progress.",
    profile: "View your account details and farmer verification status.",
  };

  const renderProducts = () => (
    <div className="dashboard-section-card">
      <div className="section-card-header">
        <div>
          <h3>My Listed Products</h3>
          <p className="subtext">Manage active crop inventory and pricing</p>
        </div>
        <button className="btn-primary-action" onClick={goToAddProduct}>
          + Add New Product
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your farm products...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state-box">
          <div className="empty-icon">🌾</div>
          <h4>No Products Listed Yet</h4>
          <p>
            {isVerified
              ? "Start listing your fresh farm produce to connect with buyers directly."
              : "Complete farmer verification before creating your first product listing."}
          </p>
          <button className="btn-primary-action" onClick={goToAddProduct}>
            {isVerified ? "+ Add Your First Product" : "Complete Verification"}
          </button>
        </div>
      ) : (
        <div className="products-grid">
          {products.map((product) => (
            <div key={product._id} className="farmer-product-card">
              <div className="product-card-thumb">
                {product.images?.[0]?.url || product.mainImage ? (
                  <img src={product.images?.[0]?.url || product.mainImage} alt={product.name} />
                ) : (
                  <div className="no-image-fallback"><span>🌱</span></div>
                )}
                <span className={`stock-badge ${product.quantity > 0 ? "in-stock" : "out-stock"}`}>
                  {product.quantity > 0
                    ? `${product.quantity} ${product.unit || "kg"} in stock`
                    : "Sold Out"}
                </span>
              </div>
              <div className="product-card-content">
                <div className="product-category-tag">{product.category || "Produce"}</div>
                <h4 className="product-title">{product.name}</h4>
                <p className="product-price-tag">
                  ₹{product.price} <span className="unit-text">/ {product.unit || "kg"}</span>
                </p>
                <div className="product-ai-suggest-bar">
                  <button
                    className="btn-ai-price"
                    onClick={() => handleGetPriceSuggestion(product)}
                    disabled={loadingAi[product._id]}
                  >
                    {loadingAi[product._id] ? "Analyzing..." : "💡 AI Price Check"}
                  </button>
                  {priceEstimates[product._id] && (
                    <div className="price-estimate-badge">
                      Suggested: ₹{priceEstimates[product._id]}
                    </div>
                  )}
                </div>
                <div className="product-card-actions">
                  <button
                    className="btn-action-edit"
                    onClick={() => navigate(`/farmer/edit-product/${product._id}`)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="btn-action-delete"
                    onClick={() => handleDeleteProduct(product._id)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderOrders = () => (
    <div className="dashboard-section-card">
      <div className="section-card-header">
        <div>
          <h3>Incoming Buyer Orders</h3>
          <p className="subtext">Review order requests and confirm fulfillment</p>
        </div>
        <div className="order-filter-pills">
          {["all", "pending", "confirmed", "delivered", "cancelled"].map((filterKey) => (
            <button
              key={filterKey}
              className={`filter-pill ${orderFilter === filterKey ? "active" : ""}`}
              onClick={() => setOrderFilter(filterKey)}
            >
              {filterKey.charAt(0).toUpperCase() + filterKey.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading incoming orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="empty-state-box">
          <div className="empty-icon">📦</div>
          <h4>No Orders Found</h4>
          <p>No orders match the selected status filter.</p>
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map((order) => (
            <div key={order._id} className="farmer-order-card">
              <div className="order-card-header">
                <div>
                  <span className="order-id">Order #{order._id?.substring(0, 8)}</span>
                  <span className="order-date">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "Recent"}
                  </span>
                </div>
                <span className={`status-pill status-${order.status || "pending"}`}>
                  {order.status || "pending"}
                </span>
              </div>

              <div className="order-card-body">
                <div className="order-info-column">
                  <p className="info-item">
                    <strong>Buyer:</strong> {order.buyer?.firstName || "Buyer"} {order.buyer?.lastName || ""}
                    {order.buyer?.phone ? ` (${order.buyer.phone})` : ""}
                  </p>
                  <p className="info-item">
                    <strong>Delivery Address:</strong> {formatAddress(order.deliveryAddress)}
                  </p>
                  <p className="info-item">
                    <strong>Total Order Value:</strong>{" "}
                    <span className="highlight-price">₹{order.totalAmount || 0}</span>
                  </p>
                </div>

                <div className="order-items-column">
                  <strong>Items Ordered:</strong>
                  <ul className="items-summary-list">
                    {order.items?.map((item, index) => (
                      <li key={item._id || index}>
                        <span>{item.productName || "Product"}</span>
                        <span className="qty-tag">x{item.quantity}</span>
                        <span className="price-tag">
                          ₹{item.totalPrice || item.price * item.quantity || 0}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {order.status === "pending" && (
                <div className="order-card-actions">
                  <button
                    className="btn-confirm-order"
                    onClick={() => handleUpdateOrderStatus(order._id, "confirmed")}
                  >
                    ✅ Confirm Order
                  </button>
                  <button
                    className="btn-reject-order"
                    onClick={() => handleUpdateOrderStatus(order._id, "cancelled")}
                  >
                    ❌ Reject Order
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderProfile = () => (
    <div className="dashboard-section-card">
      <div className="section-card-header">
        <div>
          <h3>Farmer Profile</h3>
          <p className="subtext">Your AgroConnect account information</p>
        </div>
        {!isVerified && (
          <button className="btn-primary-action" onClick={goToVerification}>
            Open Verification
          </button>
        )}
      </div>

      {user ? (
        <div className="profile-details-grid">
          <div className="profile-avatar-banner">
            <div className="large-avatar-circle">{user.firstName?.[0] || "F"}</div>
            <h4>{user.firstName} {user.lastName}</h4>
            <span className="role-badge">{verificationLabel(user.verificationStatus)}</span>
          </div>

          <div className="profile-fields-card">
            <div className="field-row">
              <span className="field-label">Email Address</span>
              <span className="field-value">{user.email || "Not provided"}</span>
            </div>
            <div className="field-row">
              <span className="field-label">Phone Number</span>
              <span className="field-value">{user.phone || "Not provided"}</span>
            </div>
            <div className="field-row">
              <span className="field-label">Account Role</span>
              <span className="field-value text-capitalize">{user.role}</span>
            </div>
            <div className="field-row">
              <span className="field-label">Verification Status</span>
              <span className="field-value">{verificationLabel(user.verificationStatus)}</span>
            </div>
            <div className="field-row">
              <span className="field-label">Total Products Listed</span>
              <span className="field-value">{stats.totalProducts}</span>
            </div>
            <div className="field-row">
              <span className="field-label">Total Earnings</span>
              <span className="field-value highlight-price">₹{stats.totalEarnings}</span>
            </div>
          </div>
        </div>
      ) : (
        <p>Loading profile...</p>
      )}
    </div>
  );

  const renderDashboard = () => (
    <>
      {!isVerified && (
        <div className="dashboard-section-card">
          <div className="section-card-header">
            <div>
              <h3>Farmer Verification Required</h3>
              <p className="subtext">
                Complete identity and farm verification before publishing products.
              </p>
            </div>
            <button className="btn-primary-action" onClick={goToVerification}>
              Start Verification
            </button>
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-widget green">
          <div className="stat-icon-bg">🌾</div>
          <div className="stat-info">
            <span className="stat-label">Total Products Listed</span>
            <h3 className="stat-value">{stats.totalProducts}</h3>
            <span className="stat-subtext">Active crop listings</span>
          </div>
        </div>
        <div className="stat-widget blue">
          <div className="stat-icon-bg">📦</div>
          <div className="stat-info">
            <span className="stat-label">Orders Received</span>
            <h3 className="stat-value">{stats.totalOrders}</h3>
            <span className="stat-subtext">Total buyer orders</span>
          </div>
        </div>
        <div className="stat-widget emerald">
          <div className="stat-icon-bg">💰</div>
          <div className="stat-info">
            <span className="stat-label">Total Earnings</span>
            <h3 className="stat-value">₹{stats.totalEarnings}</h3>
            <span className="stat-subtext">Confirmed sales revenue</span>
          </div>
        </div>
        <div className="stat-widget amber">
          <div className="stat-icon-bg">⏳</div>
          <div className="stat-info">
            <span className="stat-label">Pending Orders</span>
            <h3 className="stat-value">{stats.pendingOrders}</h3>
            <span className="stat-subtext">Requires action</span>
          </div>
        </div>
      </div>

      <div className="dashboard-section-card">
        <div className="section-card-header">
          <div>
            <h3>Quick Actions</h3>
            <p className="subtext">Common tasks to manage your farm business</p>
          </div>
        </div>
        <div className="quick-actions-grid">
          <div className="action-tile green-accent">
            <div className="tile-header"><span className="tile-icon">➕</span><h4>Add New Produce</h4></div>
            <p>{isVerified ? "List fresh crops with AI market price guidance and location tag." : "Complete farmer verification before publishing produce."}</p>
            <button className="btn-tile-action" onClick={goToAddProduct}>
              {isVerified ? "Add Product →" : "Verify First →"}
            </button>
          </div>
          <div className="action-tile blue-accent">
            <div className="tile-header"><span className="tile-icon">📦</span><h4>Manage Orders</h4></div>
            <p>Track incoming buyer requests, confirm availability, and dispatch orders.</p>
            <button className="btn-tile-action" onClick={() => setActiveSection("orders")}>
              Check Orders →
            </button>
          </div>
          <div className="action-tile emerald-accent">
            <div className="tile-header"><span className="tile-icon">🧪</span><h4>Buy Fertilizers</h4></div>
            <p>Browse seeds, fertilizers, and related products from fertilizer sellers.</p>
            <button className="btn-tile-action" onClick={() => navigate("/fertilizer-store")}>
              Open Market →
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-section-card">
        <div className="section-card-header">
          <div>
            <h3>Recent Listed Products</h3>
            <p className="subtext">Your latest crop listings</p>
          </div>
          {products.length > 0 && (
            <button className="btn-text-link" onClick={() => setActiveSection("my-products")}>
              View All Products →
            </button>
          )}
        </div>

        {products.length === 0 ? (
          <p className="placeholder-text-muted">
            {isVerified
              ? "No products listed yet. Add your first produce listing."
              : "No products can be published until your farmer verification is approved."}
          </p>
        ) : (
          <div className="table-responsive-container">
            <table className="custom-dashboard-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Available Quantity</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 5).map((product) => (
                  <tr key={product._id}>
                    <td className="table-product-cell">
                      {product.images?.[0]?.url || product.mainImage ? (
                        <img
                          src={product.images?.[0]?.url || product.mainImage}
                          alt={product.name}
                          className="table-thumb"
                        />
                      ) : (
                        <span className="table-thumb">🌱</span>
                      )}
                      <span className="table-product-name">{product.name}</span>
                    </td>
                    <td><span className="category-pill">{product.category || "Produce"}</span></td>
                    <td>{product.quantity} {product.unit || "kg"}</td>
                    <td className="highlight-price">₹{product.price} / {product.unit || "kg"}</td>
                    <td>
                      <span className={`status-pill ${product.isActive ? "status-confirmed" : "status-cancelled"}`}>
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-table-edit"
                        onClick={() => navigate(`/farmer/edit-product/${product._id}`)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case "my-products":
        return renderProducts();
      case "orders":
        return renderOrders();
      case "profile":
        return renderProfile();
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="farmer-portal-container">
      <header className="farmer-navbar">
        <div className="navbar-left">
          <div className="brand-logo" onClick={() => setActiveSection("dashboard")}>
            <span className="brand-leaf">🌱</span>
            <span className="brand-title">AgroConnect</span>
            <span className="portal-badge">Farmer Portal</span>
          </div>
        </div>

        <div className="navbar-right">
          <button className="navbar-btn-market" onClick={() => navigate("/fertilizer-store")}>
            🧪 Buy Fertilizers
          </button>
          <button className="navbar-btn-add" onClick={goToAddProduct}>
            + Add Product
          </button>
          <div className="user-profile-menu">
            <div className="avatar-circle">{user?.firstName?.[0] || "F"}</div>
            <span className="user-name-display">{user?.firstName || "Farmer"}</span>
            <button
              className="btn-logout"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              title="Logout"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      <div className="farmer-body-layout">
        <aside className="farmer-sidebar">
          <div className="sidebar-nav-list">
            <div
              className={`sidebar-nav-item ${activeSection === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveSection("dashboard")}
            >
              <span className="nav-icon">📊</span><span className="nav-label">Dashboard</span>
            </div>

            <div
              className={`sidebar-nav-item ${activeSection === "my-products" ? "active" : ""}`}
              onClick={() => setActiveSection("my-products")}
            >
              <span className="nav-icon">🌾</span><span className="nav-label">My Products</span>
              {stats.totalProducts > 0 && <span className="nav-count-badge">{stats.totalProducts}</span>}
            </div>

            <div
              className={`sidebar-nav-item ${activeSection === "orders" ? "active" : ""}`}
              onClick={() => setActiveSection("orders")}
            >
              <span className="nav-icon">📦</span><span className="nav-label">Orders</span>
              {stats.pendingOrders > 0 && <span className="nav-count-badge warning">{stats.pendingOrders}</span>}
            </div>

            <div className="sidebar-nav-item" onClick={() => navigate("/fertilizer-store")}>
              <span className="nav-icon">🧪</span><span className="nav-label">Buy Fertilizers</span>
            </div>

            <div className="sidebar-nav-item" onClick={goToVerification}>
              <span className="nav-icon">
                {isVerified ? "✅" : user?.verificationStatus === "pending" ? "⏳" : user?.verificationStatus === "rejected" ? "❌" : "📋"}
              </span>
              <span className="nav-label">Verification</span>
              {!isVerified && user?.verificationStatus !== "pending" && (
                <span className="nav-count-badge warning">!</span>
              )}
            </div>

            <div
              className={`sidebar-nav-item ${activeSection === "profile" ? "active" : ""}`}
              onClick={() => setActiveSection("profile")}
            >
              <span className="nav-icon">👤</span><span className="nav-label">Profile</span>
            </div>
          </div>
        </aside>

        <main className="farmer-main-content">
          {error && <div className="error-banner">{error}</div>}

          <div className="welcome-banner-card">
            <div className="banner-text">
              <h2>{sectionTitle[activeSection] || sectionTitle.dashboard}</h2>
              <p>{sectionDescription[activeSection] || sectionDescription.dashboard}</p>
            </div>
            {activeSection === "dashboard" && (
              <div className="banner-action-side">
                <button className="banner-primary-btn" onClick={goToAddProduct}>
                  {isVerified ? "+ Add New Produce" : "Complete Verification"}
                </button>
              </div>
            )}
          </div>

          {renderSectionContent()}
        </main>
      </div>
    </div>
  );
};

export default FarmerDashboard;
