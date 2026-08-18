
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { adminAPI } from "../../services/api.js";
import HeaderControls from "../../components/HeaderControls.jsx";
import "./admindashboard.css";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOrders: 0,
    revenue: 0,
    activeFarmers: 0
  });
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (activeTab === "users") loadUsers();
    else if (activeTab === "orders") loadOrders();
    else if (activeTab === "products") loadProducts();
    else if (activeTab === "deliveries") loadDeliveries();
    else if (activeTab === "verifications") loadVerifications();
  }, [activeTab, currentPage, searchTerm, selectedRole]);

  const loadStats = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminAPI.getStats();
      setStats(response.stats);
    } catch (err) {
      setError("Failed to load statistics");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page: currentPage, limit: 20 };
      if (searchTerm) params.search = searchTerm;
      if (selectedRole) params.role = selectedRole;
      const response = await adminAPI.getUsers(params);
      setUsers(response.users || []);
    } catch (err) {
      setError("Failed to load users");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page: currentPage, limit: 20 };
      if (searchTerm) params.search = searchTerm;
      const response = await adminAPI.getOrders(params);
      setOrders(response.orders || []);
    } catch (err) {
      setError("Failed to load orders");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page: currentPage, limit: 20 };
      if (searchTerm) params.search = searchTerm;
      const response = await adminAPI.getProducts(params);
      setProducts(response.products || []);
    } catch (err) {
      setError("Failed to load products");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDeliveries = async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page: currentPage, limit: 20 };
      if (searchTerm) params.search = searchTerm;
      const response = await adminAPI.getDeliveries(params);
      setDeliveries(response.deliveries || []);
    } catch (err) {
      setError("Failed to load deliveries");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadVerifications = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminAPI.getVerifications();
      setVerifications(response.verifications || []);
    } catch (err) {
      setError("Failed to load verifications");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUserStatusToggle = async (userId, currentStatus) => {
    try {
      await adminAPI.updateUserStatus(userId, !currentStatus);
      loadUsers(); // Reload users
    } catch (err) {
      setError("Failed to update user status");
      console.error(err);
    }
  };

  const handleOrderStatusUpdate = async (orderId, newStatus) => {
    try {
      await adminAPI.updateOrderStatus(orderId, newStatus);
      loadOrders(); // Reload orders
    } catch (err) {
      setError("Failed to update order status");
      console.error(err);
    }
  };

  const handleProductDelete = async (productId) => {
    if (!confirm(t("deleteProductConfirm"))) return;
    try {
      await adminAPI.deleteProduct(productId);
      loadProducts(); // Reload products
    } catch (err) {
      setError("Failed to delete product");
      console.error(err);
    }
  };

  const handleVerificationReview = async (userId, status) => {
    try {
      await adminAPI.reviewVerification(userId, status, "Reviewed from admin dashboard");
      loadVerifications();
    } catch (err) {
      setError("Failed to update verification status");
      console.error(err);
    }
  };

  const platformStats = [
    { label: "Total Users", value: stats.totalUsers.toLocaleString(), icon: "👥", color: "blue" },
    { label: "Total Orders", value: stats.totalOrders.toLocaleString(), icon: "📦", color: "green" },
    { label: "Revenue", value: `₹${stats.revenue.toLocaleString()}`, icon: "💰", color: "purple" },
    { label: "Active Farmers", value: stats.activeFarmers.toLocaleString(), icon: "🌾", color: "orange" },
  ];

  return (
    <div className="admin-dashboard-page">
      <div className="admin-topbar">
        <div className="admin-topbar-inner">
          <div className="admin-brand">🌱 AgroConnect</div>
          <div className="admin-title">{t("adminControlCenter")}</div>
          <div className="admin-topbar-right">
            <HeaderControls />
            <button className="logout-btn" onClick={() => { logout(); navigate("/login"); }}>
              {t("logout")}
            </button>
            <div className="profile-circle">A</div>
          </div>
        </div>
      </div>

      <div className="admin-layout">
        <div className="admin-sidebar">
          <h3 className="sidebar-title">⚙️ {t("adminPanelTitle")}</h3>

          <div className={`sidebar-item ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>{t("dashboard")}</div>
          <div className={`sidebar-item ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>{t("userManagement")}</div>
          <div className={`sidebar-item ${activeTab === "orders" ? "active" : ""}`} onClick={() => setActiveTab("orders")}>{t("ordersAndSales")}</div>
          <div className={`sidebar-item ${activeTab === "products" ? "active" : ""}`} onClick={() => setActiveTab("products")}>{t("products")}</div>
          <div className={`sidebar-item ${activeTab === "deliveries" ? "active" : ""}`} onClick={() => setActiveTab("deliveries")}>{t("deliveries")}</div>
          <div className={`sidebar-item ${activeTab === "verifications" ? "active" : ""}`} onClick={() => setActiveTab("verifications")}>{t("verificationRequests")}</div>
          <div className={`sidebar-item ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}>{t("reports")}</div>
          <div className={`sidebar-item ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>{t("settings")}</div>
          <div className={`sidebar-item ${activeTab === "auditLogs" ? "active" : ""}`} onClick={() => setActiveTab("auditLogs")}>{t("auditLogs")}</div>
          <div className="sidebar-item" onClick={() => { logout(); navigate("/login"); }}>{t("logout")}</div>
        </div>

        <div className="admin-main">
          {loading && (
            <div className="loading">{t("loading")}</div>
          )}

          {!loading && activeTab === "dashboard" && (
            <>
              {/* Welcome Section */}
              <div className="admin-welcome">
                <h2>{t("welcomeAdmin")}</h2>
                <p>{t("adminSubtitle")}</p>
              </div>

              {/* KPI Stats */}
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

              {/* Quick Actions */}
              <div className="admin-section">
                <h3>{t("quickActions")}</h3>
                <div className="quick-actions-grid">
                  <div className="quick-action-card" onClick={() => setActiveTab("users")}>
                    <h4>👥 {t("manageUsers")}</h4>
                    <p>{t("manageUsersDesc")}</p>
                    <button>{t("goToUsers")}</button>
                  </div>

                  <div className="quick-action-card" onClick={() => setActiveTab("orders")}>
                    <h4>📊 {t("viewOrders")}</h4>
                    <p>{t("viewOrdersDesc")}</p>
                    <button>{t("viewOrdersButton")}</button>
                  </div>

                  <div className="quick-action-card" onClick={() => setActiveTab("products")}>
                    <h4>📦 {t("manageProducts")}</h4>
                    <p>{t("manageProductsDesc")}</p>
                    <button>{t("viewProductsButton")}</button>
                  </div>

                  <div className="quick-action-card" onClick={() => setActiveTab("deliveries")}>
                    <h4>🚚 {t("trackDeliveries")}</h4>
                    <p>{t("trackDeliveriesDesc")}</p>
                    <button>{t("viewDeliveriesButton")}</button>
                  </div>
                </div>
              </div>
            </>
          )}

          {!loading && activeTab === "users" && (
            <div className="admin-section">
              <div className="section-header">
                  <h3>{t("userManagement")}</h3>
                  <div className="filters">
                    <input
                      type="text"
                      placeholder={t("searchUsers")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                      <option value="">{t("allRoles")}</option>
                      <option value="buyer">{t("buyers")}</option>
                      <option value="farmer">{t("farmers")}</option>
                      <option value="fertilizer_seller">{t("fertilizerSellers")}</option>
                      <option value="delivery_partner">{t("deliveryPartners")}</option>
                      <option value="admin">{t("admins")}</option>
                    </select>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t("name")}</th>
                      <th>{t("email")}</th>
                      <th>{t("role")}</th>
                      <th>{t("status")}</th>
                      <th>{t("joined")}</th>
                      <th>{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user._id}>
                        <td>{user.firstName} {user.lastName}</td>
                        <td>{user.email}</td>
                        <td><span className="role-badge">{user.role}</span></td>
                        <td>
                          <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                            {user.isActive ? t("active") : t("inactive")}
                          </span>
                        </td>
                        <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td className="actions-cell">
                          <button
                            className={`action-btn ${user.isActive ? 'danger' : 'success'}`}
                            onClick={() => handleUserStatusToggle(user._id, user.isActive)}
                          >
                            {user.isActive ? t("deactivate") : t("activate")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && activeTab === "orders" && (
            <div className="admin-section">
              <div className="section-header">
                <h3>{t("ordersAndSales")}</h3>
                <div className="filters">
                  <input
                    type="text"
                    placeholder={t("searchOrders")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t("orderId")}</th>
                      <th>{t("buyer")}</th>
                      <th>{t("items")}</th>
                      <th>{t("total")}</th>
                      <th>{t("status")}</th>
                      <th>{t("date")}</th>
                      <th>{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order._id}>
                        <td className="order-id">#{order._id.slice(-8)}</td>
                        <td>{order.buyer?.firstName} {order.buyer?.lastName}</td>
                        <td>{order.items?.length} items</td>
                        <td>₹{order.totalPrice}</td>
                        <td>
                          <select
                            value={order.status}
                            onChange={(e) => handleOrderStatusUpdate(order._id, e.target.value)}
                          >
                            <option value="pending">{t("pending")}</option>
                            <option value="confirmed">{t("confirmed")}</option>
                            <option value="processing">{t("processing")}</option>
                            <option value="shipped">{t("shipped")}</option>
                            <option value="delivered">{t("delivered")}</option>
                            <option value="cancelled">{t("cancelled")}</option>
                          </select>
                        </td>
                        <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                        <td className="actions-cell">
                          <button className="action-link">👁️ View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && activeTab === "products" && (
            <div className="admin-section">
              <div className="section-header">
                <h3>{t("products")}</h3>
                <div className="filters">
                  <input
                    type="text"
                    placeholder={t("searchProducts")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t("product")}</th>
                      <th>{t("seller")}</th>
                      <th>{t("category")}</th>
                      <th>{t("price")}</th>
                      <th>{t("stock")}</th>
                      <th>{t("status")}</th>
                      <th>{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product._id}>
                        <td>{product.name}</td>
                        <td>{product.seller?.firstName} {product.seller?.lastName}</td>
                        <td>{product.category}</td>
                        <td>₹{product.price}</td>
                        <td>{product.quantity}</td>
                        <td>
                          <span className={`status-badge ${product.isActive ? 'active' : 'inactive'}`}>
                            {product.isActive ? t("active") : t("inactive")}
                          </span>
                        </td>
                        <td className="actions-cell">
                          <button className="action-link">{t("view")}</button>
                          <button className="action-link danger" onClick={() => handleProductDelete(product._id)}>
                            🗑️ {t("delete")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && activeTab === "verifications" && (
            <div className="admin-section">
              <div className="section-header">
                <h3>{t("verificationRequests")}</h3>
                <div className="filters">
                  <input
                    type="text"
                    placeholder={t("searchVerifications")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t("name")}</th>
                      <th>{t("email")}</th>
                      <th>{t("role")}</th>
                      <th>{t("status")}</th>
                      <th>{t("submitted")}</th>
                      <th>{t("documents")}</th>
                      <th>{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.length ? (
                      verifications.map((item) => (
                        <tr key={item._id}>
                          <td>{item.firstName} {item.lastName}</td>
                          <td>{item.email}</td>
                          <td>{item.role}</td>
                          <td>
                            <span className={`status-badge ${item.verification?.status || 'not_submitted'}`}>
                              {item.verification?.status?.replace(/_/g, ' ') || 'not submitted'}
                            </span>
                          </td>
                          <td>
                            {item.verification?.submittedAt
                              ? new Date(item.verification.submittedAt).toLocaleDateString()
                              : '—'}
                          </td>
                          <td>
                            {/* Documents column: show links to uploaded files if present */}
                            {(() => {
                              const docs = [];
                              const v = item.verification || {};
                              if (v.identityDocumentUrl) docs.push({ label: 'ID', url: v.identityDocumentUrl });
                              if (v.farmingProofUrl) docs.push({ label: 'Proof', url: v.farmingProofUrl });
                              if (v.farmPhotoUrl) docs.push({ label: 'Farm', url: v.farmPhotoUrl });
                              if (v.shopCertificateUrl) docs.push({ label: 'Certificate', url: v.shopCertificateUrl });
                              if (v.shopPhotoUrl) docs.push({ label: 'Shop', url: v.shopPhotoUrl });

                              return docs.length ? (
                                <div className="doc-links">
                                  {docs.map((d, idx) => (
                                    <a key={idx} href={d.url} target="_blank" rel="noopener noreferrer" className="doc-link">{d.label}</a>
                                  ))}
                                </div>
                              ) : (
                                <span>—</span>
                              );
                            })()}
                          </td>
                          <td className="actions-cell">
                            <button className="action-btn success" onClick={() => handleVerificationReview(item._id, 'verified')}>
                              {t("approve")}
                            </button>
                            <button className="action-btn danger" onClick={() => handleVerificationReview(item._id, 'rejected')}>
                              {t("reject")}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ padding: '20px', textAlign: 'center' }}>
                          {t("noVerificationRequests")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && activeTab === "deliveries" && (
            <div className="admin-section">
              <div className="section-header">
                <h3>{t("deliveries")}</h3>
                <div className="filters">
                  <input
                    type="text"
                    placeholder={t("searchDeliveries")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t("deliveryId")}</th>
                      <th>{t("partner")}</th>
                      <th>{t("recipient")}</th>
                      <th>{t("type")}</th>
                      <th>{t("status")}</th>
                      <th>{t("date")}</th>
                      <th>{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((delivery) => (
                      <tr key={delivery._id}>
                        <td className="order-id">{delivery.deliveryNumber}</td>
                        <td>{delivery.deliveryPartner?.firstName} {delivery.deliveryPartner?.lastName}</td>
                        <td>{delivery.recipientName}</td>
                        <td>{delivery.type}</td>
                        <td>
                          <span className={`status-badge ${delivery.status}`}>
                            {delivery.status}
                          </span>
                        </td>
                        <td>{new Date(delivery.createdAt).toLocaleDateString()}</td>
                        <td className="actions-cell">
                          <button className="action-link">👁️ View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && activeTab === "reports" && (
            <div className="admin-section">
              <div className="section-header">
                <h3>{t("reports")}</h3>
              </div>
              <div className="placeholder-card">
                <p>{t("reports")} content will be available here soon.</p>
              </div>
            </div>
          )}

          {!loading && activeTab === "settings" && (
            <div className="admin-section">
              <div className="section-header">
                <h3>{t("settings")}</h3>
              </div>
              <div className="placeholder-card">
                <p>{t("settings")} content will be available here soon.</p>
              </div>
            </div>
          )}

          {!loading && activeTab === "auditLogs" && (
            <div className="admin-section">
              <div className="section-header">
                <h3>{t("auditLogs")}</h3>
              </div>
              <div className="placeholder-card">
                <p>{t("auditLogs")} content will be available here soon.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
