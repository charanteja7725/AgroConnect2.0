import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useNotification } from "../../context/AppHooks.js";
import { orderAPI, pricingAPI, productAPI } from "../../services/api.js";
import "./fertilizerdashboard.css";

const FertilizerDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { addNotification } = useNotification();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderFilter, setOrderFilter] = useState("all");
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalEarnings: 0,
    pendingOrders: 0,
  });
  const [priceEstimates, setPriceEstimates] = useState({});
  const [loadingAi, setLoadingAi] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const userId = user?._id;

  const fetchSellerData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const [productRes, orderRes] = await Promise.all([
        productAPI.getSellerProducts(userId),
        orderAPI.getOrders(),
      ]);

      const sellerProducts = productRes.products || [];
      const allOrders = orderRes.orders || [];

      const sellerOrders = allOrders.filter((order) =>
        order.items?.some((item) => {
          const sellerId = item.seller?._id || item.seller;
          return sellerId?.toString() === userId.toString();
        })
      );

      let earnings = 0;
      let pendingCount = 0;

      sellerOrders.forEach((order) => {
        if (order.status === "pending") {
          pendingCount += 1;
        }
        if (order.status === "confirmed" || order.status === "delivered") {
          const sellerItemTotal = order.items
            ?.filter((item) => {
              const sId = item.seller?._id || item.seller;
              return sId?.toString() === userId.toString();
            })
            .reduce((sum, item) => sum + (item.totalPrice || (item.price * item.quantity) || 0), 0);
          earnings += (sellerItemTotal || order.totalAmount || 0);
        }
      });

      setProducts(sellerProducts);
      setOrders(sellerOrders);
      setStats({
        totalProducts: sellerProducts.length,
        totalOrders: sellerOrders.length,
        pendingOrders: pendingCount,
        totalEarnings: earnings,
      });
    } catch (err) {
      console.error("Error loading fertilizer dashboard data", err);
      setError(err.message || "Unable to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSellerData();
  }, [fetchSellerData]);

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this fertilizer product listing?")) return;

    try {
      await productAPI.deleteProduct(productId);
      const updated = products.filter((p) => p._id !== productId);
      setProducts(updated);
      setStats((prev) => ({ ...prev, totalProducts: updated.length }));
      if (addNotification) addNotification("Fertilizer deleted successfully", "success");
    } catch (err) {
      console.error("Error deleting product:", err);
      setError("Failed to delete product: " + (err.message || ""));
    }
  };

  const handleGetPriceSuggestion = async (product) => {
    setLoadingAi((prev) => ({ ...prev, [product._id]: true }));
    try {
      const response = await pricingAPI.suggestPrice(
        product.type || "fertilizer",
        product.category || "organic",
        product.quantity || 1,
        product.price || 0
      );
      setPriceEstimates((prev) => ({
        ...prev,
        [product._id]: response.suggestedPrice || product.price,
      }));
    } catch (err) {
      console.error("Error fetching price suggestion", err);
    } finally {
      setLoadingAi((prev) => ({ ...prev, [product._id]: false }));
    }
  };

  const handleOrderStatusUpdate = async (orderId, nextStatus) => {
    try {
      await orderAPI.updateOrderStatus(orderId, nextStatus, `Updated to ${nextStatus}`);
      const updatedOrders = orders.map((o) =>
        o._id === orderId ? { ...o, status: nextStatus } : o
      );
      setOrders(updatedOrders);
      setStats((prev) => ({
        ...prev,
        pendingOrders: updatedOrders.filter((o) => o.status === "pending").length,
      }));
      if (addNotification) addNotification(`Order status updated to ${nextStatus}`, "success");
    } catch (err) {
      console.error("Error updating order status", err);
      setError(err.message || "Unable to update order status");
    }
  };

  const sectionTitle = {
    dashboard: `Welcome back, ${user?.firstName || "Seller"} 👋`,
    "my-products": "My Fertilizer Products",
    orders: "Farmer Orders Received",
    profile: "Fertilizer Seller Profile",
  };

  const sectionDescription = {
    dashboard: "Manage your fertilizer inventory, review farmer orders, and track your revenue.",
    "my-products": "Update product details, edit stock levels, and check market pricing recommendations.",
    orders: "Track orders placed by farmers and process deliveries.",
    profile: "View and update your verified seller business profile.",
  };

  const filteredOrders = orders.filter((o) => {
    if (orderFilter === "all") return true;
    return o.status === orderFilter;
  });

  const renderSectionContent = () => {
    switch (activeSection) {
      case "my-products":
        return (
          <div className="dashboard-section-card">
            <div className="section-card-header">
              <div>
                <h3>Listed Fertilizer Products</h3>
                <p className="subtext">Manage active fertilizer, seed, and chemical listings</p>
              </div>
              <button
                className="btn-primary-action"
                onClick={() => navigate("/fertilizer/add-product")}
              >
                + Add Fertilizer Product
              </button>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading fertilizer products...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="empty-state-box">
                <div className="empty-icon">🧪</div>
                <h4>No Fertilizers Listed Yet</h4>
                <p>Start listing fertilizers, seeds, and organic nutrients for local farmers.</p>
                <button
                  className="btn-primary-action"
                  onClick={() => navigate("/fertilizer/add-product")}
                >
                  + Add Your First Product
                </button>
              </div>
            ) : (
              <div className="products-grid">
                {products.map((product) => (
                  <div key={product._id} className="farmer-product-card">
                    <div className="product-card-thumb">
                      {product.images?.[0]?.url || product.mainImage ? (
                        <img
                          src={product.images?.[0]?.url || product.mainImage}
                          alt={product.name}
                        />
                      ) : (
                        <div className="no-image-fallback">
                          <span>🧪</span>
                        </div>
                      )}
                      <span className={`stock-badge ${product.quantity > 0 ? "in-stock" : "out-stock"}`}>
                        {product.quantity > 0 ? `${product.quantity} ${product.unit || "kg"} in stock` : "Sold Out"}
                      </span>
                    </div>
                    <div className="product-card-content">
                      <div className="product-category-tag">{product.category || "Fertilizer"}</div>
                      <h4 className="product-title">{product.name}</h4>
                      <p className="product-price-tag">₹{product.price} <span className="unit-text">/ {product.unit || "kg"}</span></p>

                      <div className="product-ai-suggest-bar">
                        <button
                          className="btn-ai-price"
                          onClick={() => handleGetPriceSuggestion(product)}
                          disabled={loadingAi[product._id]}
                        >
                          {loadingAi[product._id] ? "Analyzing..." : "💡 AI Price Tip"}
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

      case "orders":
        return (
          <div className="dashboard-section-card">
            <div className="section-card-header">
              <div>
                <h3>Farmer Orders Received</h3>
                <p className="subtext">Review incoming fertilizer orders from local farmers</p>
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
                <p>Loading orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="empty-state-box">
                <div className="empty-icon">📦</div>
                <h4>No Orders Found</h4>
                <p>No orders match the selected filter criteria.</p>
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
                          <strong>Farmer Buyer:</strong> {order.buyer?.firstName} {order.buyer?.lastName} ({order.buyer?.phone || "N/A"})
                        </p>
                        <p className="info-item">
                          <strong>Delivery Address:</strong> {order.deliveryAddress || "Standard Address"}
                        </p>
                        <p className="info-item">
                          <strong>Order Value:</strong> <span className="highlight-price">₹{order.totalAmount}</span>
                        </p>
                      </div>

                      <div className="order-items-column">
                        <strong>Fertilizers Ordered:</strong>
                        <ul className="items-summary-list">
                          {order.items?.map((item, idx) => (
                            <li key={idx}>
                              <span>{item.productName || "Fertilizer"}</span>
                              <span className="qty-tag">x{item.quantity}</span>
                              <span className="price-tag">₹{item.totalPrice || (item.price * item.quantity)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {order.status === "pending" && (
                      <div className="order-card-actions">
                        <button
                          className="btn-confirm-order"
                          onClick={() => handleOrderStatusUpdate(order._id, "confirmed")}
                        >
                          ✅ Confirm Order
                        </button>
                        <button
                          className="btn-reject-order"
                          onClick={() => handleOrderStatusUpdate(order._id, "cancelled")}
                        >
                          ❌ Cancel Order
                        </button>
                      </div>
                    )}
                    {order.status === "confirmed" && (
                      <div className="order-card-actions">
                        <button
                          className="btn-confirm-order"
                          onClick={() => handleOrderStatusUpdate(order._id, "delivered")}
                        >
                          🚚 Mark Delivered
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "profile":
        return (
          <div className="dashboard-section-card">
            <div className="section-card-header">
              <h3>Seller Profile</h3>
              <p className="subtext">Your verified AgroConnect Fertilizer Seller details</p>
            </div>
            {user ? (
              <div className="profile-details-grid">
                <div className="profile-avatar-banner">
                  <div className="large-avatar-circle">
                    {user.firstName?.[0] || "S"}
                  </div>
                  <h4>{user.firstName} {user.lastName}</h4>
                  <span className="role-badge">🧪 Fertilizer Seller</span>
                </div>

                <div className="profile-fields-card">
                  <div className="field-row">
                    <span className="field-label">Email Address</span>
                    <span className="field-value">{user.email}</span>
                  </div>
                  <div className="field-row">
                    <span className="field-label">Phone Number</span>
                    <span className="field-value">{user.phone || "Not provided"}</span>
                  </div>
                  <div className="field-row">
                    <span className="field-label">Account Role</span>
                    <span className="field-value text-capitalize">Fertilizer Seller</span>
                  </div>
                  <div className="field-row">
                    <span className="field-label">Products Listed</span>
                    <span className="field-value">{stats.totalProducts}</span>
                  </div>
                  <div className="field-row">
                    <span className="field-label">Total Revenue</span>
                    <span className="field-value highlight-price">₹{stats.totalEarnings}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p>Loading profile...</p>
            )}
          </div>
        );

      default:
        return (
          <>
            {/* Stat Widgets */}
            <div className="stats-grid">
              <div className="stat-widget green">
                <div className="stat-icon-bg">🧪</div>
                <div className="stat-info">
                  <span className="stat-label">Total Products</span>
                  <h3 className="stat-value">{stats.totalProducts}</h3>
                  <span className="stat-subtext">Fertilizers & seeds</span>
                </div>
              </div>

              <div className="stat-widget blue">
                <div className="stat-icon-bg">📋</div>
                <div className="stat-info">
                  <span className="stat-label">Orders Received</span>
                  <h3 className="stat-value">{stats.totalOrders}</h3>
                  <span className="stat-subtext">Farmer purchases</span>
                </div>
              </div>

              <div className="stat-widget emerald">
                <div className="stat-icon-bg">💰</div>
                <div className="stat-info">
                  <span className="stat-label">Total Revenue</span>
                  <h3 className="stat-value">₹{stats.totalEarnings}</h3>
                  <span className="stat-subtext">Sales earnings</span>
                </div>
              </div>

              <div className="stat-widget amber">
                <div className="stat-icon-bg">⏳</div>
                <div className="stat-info">
                  <span className="stat-label">Pending Orders</span>
                  <h3 className="stat-value">{stats.pendingOrders}</h3>
                  <span className="stat-subtext">Action required</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="dashboard-section-card">
              <div className="section-card-header">
                <h3>Quick Actions</h3>
                <p className="subtext">Core tasks to run your fertilizer store</p>
              </div>

              <div className="quick-actions-grid">
                <div className="action-tile green-accent">
                  <div className="tile-header">
                    <span className="tile-icon">➕</span>
                    <h4>Add New Fertilizer</h4>
                  </div>
                  <p>List NPK, organic fertilizers, or seeds with GPS location.</p>
                  <button
                    className="btn-tile-action"
                    onClick={() => navigate("/fertilizer/add-product")}
                  >
                    Add Product →
                  </button>
                </div>

                <div className="action-tile blue-accent">
                  <div className="tile-header">
                    <span className="tile-icon">📦</span>
                    <h4>Manage Orders</h4>
                  </div>
                  <p>Review orders from farmers, confirm stock, and dispatch items.</p>
                  <button
                    className="btn-tile-action"
                    onClick={() => setActiveSection("orders")}
                  >
                    Check Orders →
                  </button>
                </div>

                <div className="action-tile emerald-accent">
                  <div className="tile-header">
                    <span className="tile-icon">👤</span>
                    <h4>Store Profile</h4>
                  </div>
                  <p>View seller credentials and contact details.</p>
                  <button
                    className="btn-tile-action"
                    onClick={() => setActiveSection("profile")}
                  >
                    View Profile →
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Listed Products Table */}
            <div className="dashboard-section-card">
              <div className="section-card-header">
                <div>
                  <h3>Recent Listed Products</h3>
                  <p className="subtext">Your active store inventory</p>
                </div>
                {products.length > 0 && (
                  <button
                    className="btn-text-link"
                    onClick={() => setActiveSection("my-products")}
                  >
                    View All Products →
                  </button>
                )}
              </div>

              {products.length === 0 ? (
                <p className="placeholder-text-muted">No fertilizers listed yet. Click "+ Add Fertilizer Product" to create your first listing!</p>
              ) : (
                <div className="table-responsive-container">
                  <table className="custom-dashboard-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Available Stock</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.slice(0, 5).map((product) => (
                        <tr key={product._id}>
                          <td className="table-product-cell">
                            <img
                              src={product.images?.[0]?.url || product.mainImage || "https://via.placeholder.com/60"}
                              alt={product.name}
                              className="table-thumb"
                            />
                            <span className="table-product-name">{product.name}</span>
                          </td>
                          <td><span className="category-pill">{product.category || "Fertilizer"}</span></td>
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
    }
  };

  return (
    <div className="farmer-portal-container">
      {/* Top Navbar */}
      <header className="farmer-navbar">
        <div className="navbar-left">
          <div className="brand-logo" onClick={() => setActiveSection("dashboard")}>
            <span className="brand-leaf">🌱</span>
            <span className="brand-title">AgroConnect</span>
            <span className="portal-badge">Fertilizer Seller Portal</span>
          </div>
        </div>

        <div className="navbar-right">
          <button
            className="navbar-btn-add"
            onClick={() => navigate("/fertilizer/add-product")}
          >
            + Add Product
          </button>
          
          <div className="user-profile-menu">
            <div className="avatar-circle">
              {user?.firstName?.[0] || "S"}
            </div>
            <span className="user-name-display">{user?.firstName || "Seller"}</span>
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

      {/* Main Workspace Layout */}
      <div className="farmer-body-layout">
        {/* Sidebar */}
        <aside className="farmer-sidebar">
          <div className="sidebar-nav-list">
            <div
              className={`sidebar-nav-item ${activeSection === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveSection("dashboard")}
            >
              <span className="nav-icon">📊</span>
              <span className="nav-label">Dashboard</span>
            </div>

            <div
              className={`sidebar-nav-item ${activeSection === "my-products" ? "active" : ""}`}
              onClick={() => setActiveSection("my-products")}
            >
              <span className="nav-icon">🧪</span>
              <span className="nav-label">My Products</span>
              {stats.totalProducts > 0 && (
                <span className="nav-count-badge">{stats.totalProducts}</span>
              )}
            </div>

            <div
              className={`sidebar-nav-item ${activeSection === "orders" ? "active" : ""}`}
              onClick={() => setActiveSection("orders")}
            >
              <span className="nav-icon">📦</span>
              <span className="nav-label">Orders</span>
              {stats.pendingOrders > 0 && (
                <span className="nav-count-badge warning">{stats.pendingOrders}</span>
              )}
            </div>

            <div
              className={`sidebar-nav-item ${activeSection === "profile" ? "active" : ""}`}
              onClick={() => setActiveSection("profile")}
            >
              <span className="nav-icon">👤</span>
              <span className="nav-label">Profile</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="farmer-main-content">
          {error && <div className="error-banner">{error}</div>}

          {/* Welcome Card Banner */}
          <div className="welcome-banner-card">
            <div className="banner-text">
              <h2>{sectionTitle[activeSection]}</h2>
              <p>{sectionDescription[activeSection]}</p>
            </div>
            {activeSection === "dashboard" && (
              <div className="banner-action-side">
                <button
                  className="banner-primary-btn"
                  onClick={() => navigate("/fertilizer/add-product")}
                >
                  + Add New Fertilizer
                </button>
              </div>
            )}
          </div>

          {/* Dynamic Content */}
          {renderSectionContent()}
        </main>
      </div>
    </div>
  );
};

export default FertilizerDashboard;

