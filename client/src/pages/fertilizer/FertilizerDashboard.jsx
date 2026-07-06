import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppHooks.js";
import { orderAPI, pricingAPI, productAPI } from "../../services/api.js";
import "./fertilizerdashboard.css";

const FertilizerDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeOrders: 0,
    revenue: 0,
    rating: 0,
  });
  const [priceEstimates, setPriceEstimates] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderUpdating, setOrderUpdating] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const loadData = async () => {
      try {
        const [productRes, orderRes] = await Promise.all([
          productAPI.getSellerProducts(user._id),
          orderAPI.getOrders(),
        ]);

        const sellerOrders = (orderRes.orders || []).filter((order) =>
          order.items?.some((item) =>
            item.seller?._id?.toString() === user._id || item.seller?.toString() === user._id
          )
        );

        const revenue = sellerOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

        setProducts(productRes.products || []);
        setOrders(sellerOrders);
        setStats({
          totalProducts: productRes.count || 0,
          activeOrders: sellerOrders.filter((order) => order.status !== "delivered" && order.status !== "cancelled").length,
          revenue,
          rating: user?.rating || 0,
        });
      } catch (err) {
        console.error("Error loading fertilizer dashboard", err);
        setError(err.message || "Unable to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleGetPriceSuggestion = async (product) => {
    try {
      const response = await pricingAPI.suggestPrice(
        product.type || product.category || "fertilizer",
        product.category || "general",
        product.quantity || 1,
        product.price || 0
      );
      setPriceEstimates((prev) => ({
        ...prev,
        [product._id]: response.suggestedPrice || response.price || product.price,
      }));
    } catch (err) {
      console.error("Error fetching price recommendation", err);
    }
  };

  const handleOrderStatusUpdate = async (orderId, nextStatus) => {
    setOrderUpdating(true);
    try {
      await orderAPI.updateOrderStatus(orderId, nextStatus, `Updated by seller to ${nextStatus}`);
      const orderRes = await orderAPI.getOrders();
      const sellerOrders = (orderRes.orders || []).filter((order) =>
        order.items?.some((item) =>
          item.seller?._id?.toString() === user._id || item.seller?.toString() === user._id
        )
      );
      setOrders(sellerOrders);
      setStats((prev) => ({
        ...prev,
        activeOrders: sellerOrders.filter((order) =>
          order.status !== "delivered" && order.status !== "cancelled"
        ).length,
      }));
    } catch (err) {
      console.error("Error updating order status", err);
      setError(err.message || "Unable to update order status");
    } finally {
      setOrderUpdating(false);
    }
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case "my-products":
        return (
          <div className="dashboard-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3>My Products</h3>
              <button
                className="section-action"
                onClick={() => navigate("/fertilizer/add-product")}
              >
                + Add New Product
              </button>
            </div>
            <div className="product-grid-fer">
              {loading ? (
                <p>Loading products...</p>
              ) : products.length === 0 ? (
                <p className="placeholder-text">You haven't listed any fertilizers yet.</p>
              ) : (
                products.map((product) => (
                  <div className="fertilizer-product-card" key={product._id}>
                    <div className="product-icon">🧪</div>
                    <h4>{product.name}</h4>
                    <p className="product-category">{product.category || product.type}</p>
                    <div className="product-details">
                      <div>
                        <span className="label">Price:</span>
                        <span className="value">₹{product.price}</span>
                      </div>
                      <div>
                        <span className="label">Stock:</span>
                        <span className="value">{product.quantity || 0} {product.unit || "units"}</span>
                      </div>
                    </div>
                    <div className="demand-badge" data-demand={product.quantity > 50 ? "High" : "Medium"}>
                      {product.quantity > 50 ? "High" : "Medium"} Stock
                    </div>
                    <button className="btn-small" onClick={() => handleGetPriceSuggestion(product)}>
                      Get Price Tip
                    </button>
                    {priceEstimates[product._id] && (
                      <p className="price-estimate">Suggested: ₹{priceEstimates[product._id]}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case "orders":
        return (
          <div className="dashboard-section">
            <h3>Recent Orders from Farmers</h3>
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Farmer</th>
                    <th>Products</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="placeholder-text">No orders found</td>
                    </tr>
                  ) : (
                    orders.slice(0, 6).map((order) => (
                      <tr key={order._id}>
                        <td className="order-id">#{order.orderNumber?.slice(-6) || order._id.slice(-6)}</td>
                        <td>{order.buyer?.firstName} {order.buyer?.lastName}</td>
                        <td>{order.items?.map((item) => item.productName).join(", ")}</td>
                        <td className="amount">₹{order.totalAmount}</td>
                        <td>
                          <span className={`status-badge ${order.status || "pending"}`}>
                            {order.status}
                          </span>
                        </td>
                        <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                        <td>
                          {order.status === "pending" && (
                            <button className="status-action-btn" disabled={orderUpdating} onClick={() => handleOrderStatusUpdate(order._id, "confirmed")}>Confirm</button>
                          )}
                          {order.status === "confirmed" && (
                            <button className="status-action-btn" disabled={orderUpdating} onClick={() => handleOrderStatusUpdate(order._id, "processing")}>Process</button>
                          )}
                          {order.status === "processing" && (
                            <button className="status-action-btn" disabled={orderUpdating} onClick={() => handleOrderStatusUpdate(order._id, "shipped")}>Ship</button>
                          )}
                          {order.status === "shipped" && (
                            <button className="status-action-btn" disabled={orderUpdating} onClick={() => handleOrderStatusUpdate(order._id, "delivered")}>Deliver</button>
                          )}
                          {['delivered', 'cancelled'].includes(order.status) && <span>Done</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "profile":
        return (
          <div className="dashboard-section">
            <h3>Your Profile</h3>
            {user && (
              <div className="profile-card">
                <p><strong>Name:</strong> {user.firstName} {user.lastName}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Phone:</strong> {user.phone}</p>
                <p><strong>Role:</strong> {user.role}</p>
                <p><strong>Total Earnings:</strong> ₹{user.totalEarnings || 0}</p>
                <p><strong>Total Orders:</strong> {user.totalOrders || 0}</p>
                <button
                  className="section-action"
                  onClick={() => navigate("/profile")}
                >
                  Edit Profile
                </button>
              </div>
            )}
          </div>
        );

      default:
        return (
          <>
            <div className="welcome-card fertilizer-welcome">
              <h2>Welcome, Fertilizer Seller 👋</h2>
              <p>Manage your fertilizer products and reach farmers directly</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📦</div>
                <div className="stat-content">
                  <h4>Total Products</h4>
                  <p className="stat-number">{stats.totalProducts}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📋</div>
                <div className="stat-content">
                  <h4>Active Orders</h4>
                  <p className="stat-number">{stats.activeOrders}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-content">
                  <h4>This Month Revenue</h4>
                  <p className="stat-number">₹{stats.revenue.toLocaleString()}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⭐</div>
                <div className="stat-content">
                  <h4>Rating</h4>
                  <p className="stat-number">{stats.rating.toFixed(1) || "0.0"}/5</p>
                </div>
              </div>
            </div>

            {error && <div className="error-state">{error}</div>}

            <div className="dashboard-section">
              <h3>Quick Actions</h3>
              <div className="action-buttons">
                <button className="action-btn primary" onClick={() => navigate("/fertilizer/add-product")}>➕ Add New Product</button>
                <button className="action-btn">📊 View Analytics</button>
                <button className="action-btn">🚚 Track Deliveries</button>
                <button className="action-btn">💬 Messages</button>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="fertilizer-dashboard-page">
      <div className="fertilizer-topbar">
        <div className="fertilizer-topbar-inner">
          <div className="fertilizer-brand">🌱 AgroConnect</div>
          <div className="fertilizer-topbar-center">Fertilizer Seller Dashboard</div>
          <div className="fertilizer-topbar-right">
            <button className="lang-btn">English ▼</button>
            <button className="voice-assist-btn">🎤</button>
            <button className="logout-btn" onClick={() => { logout(); navigate("/login"); }}>
              Logout
            </button>
            <div className="profile-circle">S</div>
          </div>
        </div>
      </div>

      <div className="fertilizer-layout">
        <div className="fertilizer-sidebar">
          <h3 className="sidebar-title">📋 Fertilizer Seller</h3>
          <div className={`sidebar-item ${activeSection === "dashboard" ? "active" : ""}`} onClick={() => setActiveSection("dashboard")}>Dashboard</div>
          <div className={`sidebar-item ${activeSection === "my-products" ? "active" : ""}`} onClick={() => setActiveSection("my-products")}>My Products</div>
          <div className={`sidebar-item ${activeSection === "orders" ? "active" : ""}`} onClick={() => setActiveSection("orders")}>Orders</div>
          <div className={`sidebar-item ${activeSection === "profile" ? "active" : ""}`} onClick={() => setActiveSection("profile")}>Profile</div>
          <div className="sidebar-item" onClick={() => navigate("/fertilizer/add-product")}>Add Product</div>
          <div className="sidebar-item">Inventory</div>
          <div className="sidebar-item">AI Price Tips</div>
          <div className="sidebar-item">Payments</div>
          <div className="sidebar-item">Logout</div>
        </div>

        <div className="fertilizer-main">
          {renderSectionContent()}
        </div>
      </div>
    </div>
  );
};

export default FertilizerDashboard;
