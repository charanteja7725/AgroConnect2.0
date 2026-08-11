import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppContext.jsx";
import { orderAPI, productAPI } from "../../services/api.js";
import "./fertilizerdashboard.css";

const FertilizerDashboard = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const loadDashboardData = async () => {
    setLoading(true);
    setError("");

    try {
      const [productResponse, orderResponse] = await Promise.all([
        productAPI.getSellerProducts(user?._id),
        orderAPI.getOrders(),
      ]);

      setProducts(productResponse.products || []);
      setOrders(orderResponse.orders || []);
    } catch (err) {
      setError("Failed to load dashboard data. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus = selectedStatus ? order.status === selectedStatus : true;
      const matchesSearch = searchTerm
        ? order.items?.some((item) =>
            item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.buyer?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.buyer?.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : true;
      return matchesStatus && matchesSearch;
    });
  }, [orders, searchTerm, selectedStatus]);

  const totalProducts = products.length;
  const activeOrders = orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
  const revenue = orders.reduce(
    (sum, order) => sum + (order.totalAmount || order.totalPrice || 0),
    0
  );
  const rating = user?.rating || 0;
  const verificationStatus = user?.sellerVerification?.status || "not_submitted";

  const stats = [
    { label: "Total Products", value: totalProducts.toString(), icon: "📦" },
    { label: "Active Orders", value: activeOrders.length.toString(), icon: "📋" },
    { label: "This Month Revenue", value: `₹${revenue.toLocaleString()}`, icon: "💰" },
    { label: "Rating", value: `${rating.toFixed(1)}/5`, icon: "⭐" },
  ];

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
            <div className="profile-circle">{user?.firstName?.[0] || "S"}</div>
          </div>
        </div>
      </div>

      <div className="fertilizer-layout">
        <div className="fertilizer-sidebar">
          <h3 className="sidebar-title">📋 Fertilizer Seller</h3>

          <div className="sidebar-item active">Dashboard</div>
          <div className="sidebar-item" onClick={() => navigate("/fertilizer/add-product")}>Add Product</div>
            <div className="sidebar-item" onClick={() => navigate("/fertilizer/add-product")}>My Products</div>
            <div className="sidebar-item" onClick={() => navigate("/fertilizer")}>Orders</div>
            <div className="sidebar-item" onClick={() => navigate("/fertilizer")}>Inventory</div>
            <div className="sidebar-item" onClick={() => navigate("/fertilizer")}>AI Price Tips</div>
            <div className="sidebar-item" onClick={() => navigate("/fertilizer")}>Payments</div>
            <div className="sidebar-item" onClick={() => navigate("/fertilizer")}>Profile</div>
          {loading ? (
            <div className="loading">Loading dashboard...</div>
          ) : (
            <>
              {/* Welcome Card */}
              <div className="welcome-card fertilizer-welcome">
                <h2>Welcome, {user?.firstName || "Seller"} 👋</h2>
                <p>Manage your fertilizer products, review orders, and boost sales from one dashboard.</p>
              </div>

              {error && <div className="error-message">{error}</div>}

              {/* Summary Stats */}
              <div className="stats-grid">
                {stats.map((stat, idx) => (
                  <div className="stat-card" key={idx}>
                    <div className="stat-icon">{stat.icon}</div>
                    <div className="stat-content">
                      <h4>{stat.label}</h4>
                      <p className="stat-number">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="dashboard-section">
                <h3>Quick Actions</h3>
                <div className="action-buttons">
                  <button className="action-btn primary" onClick={() => navigate("/fertilizer/add-product")}>➕ Add New Product</button>
                  <button className="action-btn" onClick={() => loadDashboardData()}>🔄 Refresh Data</button>
                </div>
              </div>

              <div className="dashboard-section">
                <h3>Verification Status</h3>
                <p>Current status: <strong>{verificationStatus.replace(/_/g, " ")}</strong></p>
                {verificationStatus !== "verified" && (
                  <button className="action-btn primary" onClick={() => navigate("/verification")}>Complete Verification</button>
                )}
              </div>

              {/* Products Overview */}
              <div className="dashboard-section">
                <div className="section-header">
                  <h3>Your Fertilizer Products</h3>
                  <button className="view-all-btn" onClick={() => navigate("/fertilizer/add-product")}>Add Product →</button>
                </div>

                <div className="product-grid-fer">
                  {products.length ? (
                    products.map((product) => (
                      <div className="fertilizer-product-card" key={product._id || product.id}>
                        <div className="product-icon">🧪</div>
                        <h4>{product.name}</h4>
                        <p className="product-category">{product.category || product.productType || "Fertilizer"}</p>
                        <div className="product-details">
                          <div>
                            <span className="label">Price:</span>
                            <span className="value">₹{product.price || product.currentPrice || 0}</span>
                          </div>
                          <div>
                            <span className="label">Stock:</span>
                            <span className="value">{product.quantity ?? product.stock ?? 0} bags</span>
                          </div>
                        </div>
                        <div className="demand-badge" data-demand={product.demand || "High"}>
                          {product.demand || "High"} Demand
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="product-grid-fer">
                      <p>No fertilizer products listed yet.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Orders */}
              <div className="dashboard-section">
                <div className="section-header">
                  <h3>Recent Orders from Farmers</h3>
                  <div>
                    <input
                      type="text"
                      placeholder="Search orders..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #ddd", marginRight: "12px" }}
                    />
                    <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #ddd" }}>
                      <option value="">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Farmer</th>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.length ? (
                        filteredOrders.map((order) => {
                          const item = order.items?.[0] || {};
                          return (
                            <tr key={order._id || order.id}>
                              <td className="order-id">#{order._id?.slice(-6) || order.id}</td>
                              <td>{order.buyer?.firstName} {order.buyer?.lastName}</td>
                              <td>{item.productName || item.name || "Fertilizer"}</td>
                              <td>{item.quantity || 0} bags</td>
                              <td className="amount">₹{order.totalAmount || order.totalPrice || 0}</td>
                              <td>
                                <span className={`status-badge ${order.status?.toLowerCase()}`}>
                                  {order.status}
                                </span>
                              </td>
                              <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="7" style={{ padding: "20px", textAlign: "center" }}>
                            No matching orders found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AI Price Recommendations */}
              <div className="dashboard-section">
                <h3>🤖 AI Price Recommendations</h3>
                {products.length ? (
                  <div className="recommendations-box">
                    {products.slice(0, 2).map((product) => (
                      <div className="recommendation" key={product._id || product.id}>
                        <p>
                          <strong>{product.name}:</strong> Current price ₹{product.price}. Consider monitoring stock and demand before changing your price.
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>Add fertilizer products to get pricing recommendations here.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FertilizerDashboard;
