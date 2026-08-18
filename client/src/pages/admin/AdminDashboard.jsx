
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppHooks.js";
import { orderAPI, productAPI, userAPI } from "../../services/api.js";
import "./admindashboard.css";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState({});
  const [actionMsg, setActionMsg] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("pending");
  const [reviewNotes, setReviewNotes] = useState({});
  const [stats, setStats] = useState({
    totalUsers: 0, totalOrders: 0, revenue: 0, totalProducts: 0,
    farmers: 0, buyers: 0, fertilizerSellers: 0, deliveryPartners: 0,
  });
  const [recentUsers, setRecentUsers] = useState([]);
  const [pendingFarmers, setPendingFarmers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [allOrders, setAllOrders] = useState([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ordersRes, farmersRes, buyersRes, fertilizerRes, deliveryRes, productsRes] =
        await Promise.all([
          orderAPI.getOrders(),
          userAPI.getUsersByRole("farmer"),
          userAPI.getUsersByRole("buyer"),
          userAPI.getUsersByRole("fertilizer_seller"),
          userAPI.getUsersByRole("delivery_partner"),
          productAPI.getAllProducts({ limit: 5 }),
        ]);

      const allFarmers = farmersRes.users || [];
      const allBuyers = buyersRes.users || [];
      const allFertSellers = fertilizerRes.users || [];
      const allDelivery = deliveryRes.users || [];

      const totalUsers = allFarmers.length + allBuyers.length + allFertSellers.length + allDelivery.length;
      const revenue = (ordersRes.orders || []).reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      setStats({
        totalUsers,
        totalOrders: ordersRes.count || 0,
        revenue,
        totalProducts: productsRes.total || 0,
        farmers: allFarmers.length,
        buyers: allBuyers.length,
        fertilizerSellers: allFertSellers.length,
        deliveryPartners: allDelivery.length,
      });

      const merged = [...allFarmers, ...allBuyers, ...allFertSellers, ...allDelivery]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setRecentUsers(merged.slice(0, 6));
      setAllUsers(merged);
      setAllOrders(ordersRes.orders || []);
      setAllProducts(productsRes.products || []);
    } catch (err) {
      setError(err.message || "Unable to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPendingFarmers = useCallback(async (status) => {
    setLoading(true);
    try {
      const res = await userAPI.getPendingVerifications(status);
      setPendingFarmers(res.farmers || []);
    } catch (err) {
      setError(err.message || "Unable to load verifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => {
    if (activeSection === "verification") {
      loadPendingFarmers(verificationFilter);
    }
  }, [activeSection, verificationFilter, loadPendingFarmers]);

  const handleVerification = async (farmerId, action, notes, rejectionReason) => {
    setActionLoading(prev => ({ ...prev, [farmerId]: true }));
    setActionMsg("");
    try {
      const res = await userAPI.reviewVerification(farmerId, action, notes, rejectionReason);
      setActionMsg({ type: "success", text: res.message || `Action '${action}' applied.` });
      // Refresh pending list
      await loadPendingFarmers(verificationFilter);
    } catch (err) {
      setActionMsg({ type: "error", text: err.message || "Action failed." });
    } finally {
      setActionLoading(prev => ({ ...prev, [farmerId]: false }));
    }
  };

  const handleSuspendUser = async (userId, action) => {
    setActionLoading(prev => ({ ...prev, [userId]: true }));
    try {
      await userAPI.suspendUser(userId, action);
      setActionMsg({ type: "success", text: `User ${action === "suspend" ? "suspended" : "activated"}.` });
      await loadDashboard();
    } catch (err) {
      setActionMsg({ type: "error", text: err.message || "Failed to update user." });
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Are you sure you want to remove this product?")) return;
    try {
      await productAPI.deleteProduct(productId);
      setAllProducts(prev => prev.filter(p => p._id !== productId));
      setActionMsg({ type: "success", text: "Product removed." });
    } catch (err) {
      setActionMsg({ type: "error", text: err.message || "Failed to delete product." });
    }
  };

  const platformStats = [
    { label: "Total Users", value: stats.totalUsers, icon: "👥", color: "blue" },
    { label: "Total Orders", value: stats.totalOrders, icon: "📦", color: "green" },
    { label: "Revenue", value: `₹${stats.revenue.toLocaleString()}`, icon: "💰", color: "purple" },
    { label: "Active Farmers", value: stats.farmers, icon: "🌾", color: "orange" },
    { label: "Buyers", value: stats.buyers, icon: "🛒", color: "teal" },
    { label: "Fertilizer Sellers", value: stats.fertilizerSellers, icon: "🧪", color: "yellow" },
    { label: "Delivery Partners", value: stats.deliveryPartners, icon: "🚚", color: "red" },
    { label: "Total Products", value: stats.totalProducts, icon: "🌱", color: "emerald" },
  ];

  const navItems = [
    { key: "dashboard", icon: "📊", label: "Dashboard" },
    { key: "verification", icon: "✅", label: "Farmer Verification" },
    { key: "users", icon: "👥", label: "User Management" },
    { key: "products", icon: "🌱", label: "Products" },
    { key: "orders", icon: "📦", label: "Orders" },
  ];

  const renderContent = () => {
    if (loading) return <div className="loading-state"><div className="spinner" /><p>Loading...</p></div>;
    if (error) return <div className="error-banner">{error} <button onClick={loadDashboard}>Retry</button></div>;

    switch (activeSection) {
      case "verification":
        return (
          <div className="dashboard-section-card">
            <div className="section-card-header">
              <div>
                <h3>Farmer Verification Management</h3>
                <p className="subtext">Review and approve farmer applications</p>
              </div>
            </div>

            {actionMsg && (
              <div className={`action-feedback ${actionMsg.type}`}>{actionMsg.text}</div>
            )}

            <div className="verification-filter-bar">
              {["pending", "more_information_required", "verified", "rejected", "not_submitted"].map(s => (
                <button
                  key={s}
                  className={`filter-pill ${verificationFilter === s ? "active" : ""}`}
                  onClick={() => setVerificationFilter(s)}
                >
                  {s.replace(/_/g, " ")}
                </button>
              ))}
            </div>

            {pendingFarmers.length === 0 ? (
              <div className="empty-state-box">
                <div className="empty-icon">✅</div>
                <h4>No farmers in this status</h4>
                <p>Switch filters to view different groups.</p>
              </div>
            ) : (
              <div className="verification-list">
                {pendingFarmers.map(farmer => (
                  <div key={farmer._id} className="verification-card">
                    <div className="verification-card-header">
                      <div className="farmer-info">
                        <div className="farmer-avatar">{farmer.firstName?.[0] || "F"}</div>
                        <div>
                          <h4>{farmer.firstName} {farmer.lastName}</h4>
                          <p>{farmer.email} | {farmer.phone}</p>
                          <span className={`status-pill status-${farmer.verificationStatus}`}>
                            {farmer.verificationStatus?.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>
                      <div className="submitted-date">
                        {farmer.verificationDocuments?.submittedAt && (
                          <p>Submitted: {new Date(farmer.verificationDocuments.submittedAt).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>

                    {farmer.verificationDocuments?.additionalNotes && (
                      <div className="farmer-notes">
                        <strong>Farmer's Note:</strong> {farmer.verificationDocuments.additionalNotes}
                      </div>
                    )}

                    {farmer.verificationDocuments?.gpsCoordinates?.latitude && (
                      <div className="farmer-notes">
                        <strong>GPS:</strong> {farmer.verificationDocuments.gpsCoordinates.latitude.toFixed(4)}, {farmer.verificationDocuments.gpsCoordinates.longitude.toFixed(4)}
                      </div>
                    )}

                    <div className="review-note-input">
                      <input
                        type="text"
                        placeholder="Admin notes (optional)"
                        value={reviewNotes[farmer._id] || ""}
                        onChange={e => setReviewNotes(prev => ({ ...prev, [farmer._id]: e.target.value }))}
                      />
                    </div>

                    <div className="verification-actions">
                      <button
                        className="btn-approve"
                        disabled={actionLoading[farmer._id]}
                        onClick={() => handleVerification(farmer._id, "verified", reviewNotes[farmer._id], "")}
                      >
                        ✅ Approve
                      </button>
                      <button
                        className="btn-reject"
                        disabled={actionLoading[farmer._id]}
                        onClick={() => {
                          const reason = reviewNotes[farmer._id] || "Application does not meet requirements.";
                          handleVerification(farmer._id, "rejected", "", reason);
                        }}
                      >
                        ❌ Reject
                      </button>
                      <button
                        className="btn-info"
                        disabled={actionLoading[farmer._id]}
                        onClick={() => handleVerification(farmer._id, "more_information_required", "", "", reviewNotes[farmer._id] || "Please provide additional documents.")}
                      >
                        🔵 Request Info
                      </button>
                      <button
                        className="btn-suspend"
                        disabled={actionLoading[farmer._id]}
                        onClick={() => handleSuspendUser(farmer._id, farmer.isActive ? "suspend" : "activate")}
                      >
                        {farmer.isActive ? "🚫 Suspend" : "▶️ Activate"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "users":
        return (
          <div className="dashboard-section-card">
            <div className="section-card-header">
              <h3>User Management</h3>
              <p className="subtext">All registered platform users</p>
            </div>
            {actionMsg && <div className={`action-feedback ${actionMsg.type}`}>{actionMsg.text}</div>}
            <div className="table-responsive-container">
              <table className="custom-dashboard-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map(u => (
                    <tr key={u._id}>
                      <td>{u.firstName} {u.lastName}</td>
                      <td><span className="role-badge">{u.role}</span></td>
                      <td>{u.email}</td>
                      <td>{u.phone}</td>
                      <td>
                        <span className={`status-pill ${u.isActive ? "status-confirmed" : "status-cancelled"}`}>
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <button
                          className={u.isActive ? "btn-reject" : "btn-approve"}
                          style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                          disabled={actionLoading[u._id]}
                          onClick={() => handleSuspendUser(u._id, u.isActive ? "suspend" : "activate")}
                        >
                          {u.isActive ? "Suspend" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "products":
        return (
          <div className="dashboard-section-card">
            <div className="section-card-header">
              <h3>Product Listings</h3>
              <p className="subtext">All products on the platform</p>
            </div>
            {actionMsg && <div className={`action-feedback ${actionMsg.type}`}>{actionMsg.text}</div>}
            {allProducts.length === 0 ? (
              <div className="empty-state-box"><div className="empty-icon">🌱</div><h4>No products</h4></div>
            ) : (
              <div className="table-responsive-container">
                <table className="custom-dashboard-table">
                  <thead>
                    <tr><th>Product</th><th>Type</th><th>Price</th><th>Stock</th><th>Seller</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {allProducts.map(p => (
                      <tr key={p._id}>
                        <td>{p.name}</td>
                        <td><span className="category-pill">{p.category}</span></td>
                        <td>₹{p.price}</td>
                        <td>{p.quantity} {p.unit}</td>
                        <td>{p.sellerName || p.seller?.firstName}</td>
                        <td>
                          <span className={`status-pill ${p.isActive ? "status-confirmed" : "status-cancelled"}`}>
                            {p.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn-reject"
                            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                            onClick={() => handleDeleteProduct(p._id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      case "orders":
        return (
          <div className="dashboard-section-card">
            <div className="section-card-header">
              <h3>All Orders</h3>
              <p className="subtext">Platform order history</p>
            </div>
            {allOrders.length === 0 ? (
              <div className="empty-state-box"><div className="empty-icon">📦</div><h4>No orders yet</h4></div>
            ) : (
              <div className="table-responsive-container">
                <table className="custom-dashboard-table">
                  <thead>
                    <tr><th>Order #</th><th>Buyer</th><th>Items</th><th>Amount</th><th>Payment</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {allOrders.map(o => (
                      <tr key={o._id}>
                        <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{o.orderNumber || o._id?.substring(0, 10)}</td>
                        <td>{o.buyer?.firstName} {o.buyer?.lastName}</td>
                        <td>{o.items?.length} item(s)</td>
                        <td>₹{o.totalAmount}</td>
                        <td><span className="category-pill">{o.payment?.method}</span></td>
                        <td><span className={`status-pill status-${o.status}`}>{o.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      default: // dashboard
        return (
          <>
            <div className="kpi-grid">
              {platformStats.map((stat, idx) => (
                <div className="kpi-card" key={idx} data-color={stat.color}>
                  <div className="kpi-icon">{stat.icon}</div>
                  <div className="kpi-content">
                    <p className="kpi-label">{stat.label}</p>
                    <h3 className="kpi-value">{stat.value}</h3>
                  </div>
                </div>
              ))}
            </div>

            <div className="dashboard-section-card" style={{ marginTop: "1.5rem" }}>
              <div className="section-card-header">
                <h3>Recent Users</h3>
                <button className="btn-text-link" onClick={() => setActiveSection("users")}>View All →</button>
              </div>
              <div className="table-responsive-container">
                <table className="custom-dashboard-table">
                  <thead>
                    <tr><th>Name</th><th>Role</th><th>Email</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {recentUsers.map(u => (
                      <tr key={u._id}>
                        <td>{u.firstName} {u.lastName}</td>
                        <td><span className="role-badge">{u.role}</span></td>
                        <td>{u.email}</td>
                        <td>
                          <span className={`status-pill ${u.isActive ? "status-confirmed" : "status-cancelled"}`}>
                            {u.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="dashboard-section-card" style={{ marginTop: "1.5rem" }}>
              <h3>Platform Health</h3>
              <div className="health-metrics">
                <div className="health-item"><span className="health-label">Server Status</span><span className="health-value green">● Online</span></div>
                <div className="health-item"><span className="health-label">Database</span><span className="health-value green">● Connected</span></div>
                <div className="health-item"><span className="health-label">API</span><span className="health-value green">● Operational</span></div>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="admin-dashboard-page">
      <div className="admin-topbar">
        <div className="admin-topbar-inner">
          <div className="admin-brand">🌱 AgroConnect</div>
          <div className="admin-title">Admin Control Center</div>
          <div className="admin-topbar-right">
            <button className="logout-btn" onClick={() => { logout(); navigate("/login"); }}>Logout</button>
            <div className="profile-circle">A</div>
          </div>
        </div>
      </div>

      <div className="admin-layout">
        <div className="admin-sidebar">
          <h3 className="sidebar-title">⚙️ Admin Panel</h3>
          {navItems.map(item => (
            <div
              key={item.key}
              className={`sidebar-item ${activeSection === item.key ? "active" : ""}`}
              onClick={() => setActiveSection(item.key)}
            >
              <span>{item.icon}</span> {item.label}
            </div>
          ))}
        </div>

        <div className="admin-main">
          <div className="admin-welcome">
            <h2>Welcome to AgroConnect Admin Panel 🚀</h2>
            <p>Manage users, verify farmers, monitor platform activities</p>
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
