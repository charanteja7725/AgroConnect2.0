import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useNotification } from "../../context/AppHooks.js";
import { deliveryAPI } from "../../services/api.js";
import { LocationService } from "../../services/LocationService.js";
import "./deliverydashboard.css";

const DeliveryDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { addNotification } = useNotification();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [deliveries, setDeliveries] = useState([]);
  const [nearbyDeliveries, setNearbyDeliveries] = useState([]);
  const [locationCoords, setLocationCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    todayDeliveries: 0,
    earningsToday: 0,
    rating: user?.rating || 4.9,
    completionRate: 98,
  });

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await deliveryAPI.getDeliveries();
      const loadedDeliveries = response.deliveries || [];
      setDeliveries(loadedDeliveries);
      const earnings = loadedDeliveries.reduce((sum, delivery) => sum + (delivery.totalEarnings || 0), 0);

      setStats((prev) => ({
        ...prev,
        todayDeliveries: loadedDeliveries.filter((delivery) => delivery.status !== "delivered").length,
        earningsToday: earnings,
      }));
    } catch (err) {
      setError(err.message || "Unable to load deliveries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const handleUpdateDeliveryStatus = async (deliveryId, status) => {
    setLoading(true);
    try {
      await deliveryAPI.updateDeliveryStatus(deliveryId, status, null, `Marked ${status}`);
      if (addNotification) addNotification(`Delivery marked as ${status}`, "success");
      await fetchDeliveries();
      if (activeSection === "available-orders" && locationCoords) {
        await loadNearbyOrders(locationCoords);
      }
    } catch (err) {
      setError(err.message || "Unable to update delivery status");
    } finally {
      setLoading(false);
    }
  };

  const loadNearbyOrders = async (coords) => {
    if (!coords?.latitude || !coords?.longitude) return;

    try {
      const response = await deliveryAPI.getNearbyDeliveries(coords.longitude, coords.latitude, 20000);
      setNearbyDeliveries(response.deliveries || []);
    } catch (err) {
      setError(err.message || "Unable to fetch nearby orders");
    }
  };

  const handleUseCurrentLocation = async () => {
    setLoading(true);
    setError("");

    try {
      const coords = await LocationService.getCurrentLocation();
      setLocationCoords(coords);
      await loadNearbyOrders(coords);
      setActiveSection("available-orders");
      if (addNotification) addNotification("Location updated successfully", "success");
    } catch (err) {
      setError(err.message || "Unable to get current GPS location");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptDelivery = async (deliveryId) => {
    setLoading(true);
    setError("");
    try {
      await deliveryAPI.acceptDelivery(deliveryId);
      if (addNotification) addNotification("Delivery order accepted!", "success");
      await fetchDeliveries();
      await loadNearbyOrders(locationCoords);
    } catch (err) {
      setError(err.message || "Unable to accept delivery");
    } finally {
      setLoading(false);
    }
  };

  const activeDeliveries = deliveries.filter((delivery) => !["delivered", "cancelled", "failed"].includes(delivery.status));
  const completedToday = deliveries.filter((delivery) => delivery.status === "delivered");

  const sectionTitle = {
    dashboard: `Welcome back, ${user?.firstName || "Delivery Partner"} 🚚`,
    "active-deliveries": "Active Deliveries in Progress",
    "available-orders": "Available Delivery Jobs",
    completed: "Completed Delivery History",
    profile: "Delivery Partner Profile",
  };

  const sectionDescription = {
    dashboard: "Manage pick-ups, track live routes, and complete deliveries to earn payout.",
    "active-deliveries": "Update pick-up, transit, and drop-off statuses for claimed packages.",
    "available-orders": "Discover nearby delivery requests available to accept.",
    completed: "Review your completed delivery tasks.",
    profile: "View verified delivery partner account information.",
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case "active-deliveries":
        return (
          <div className="dashboard-section-card">
            <div className="section-card-header">
              <div>
                <h3>Active Deliveries ({activeDeliveries.length})</h3>
                <p className="subtext">Update status for orders currently assigned to you</p>
              </div>
              <button className="btn-primary-action" onClick={fetchDeliveries}>🔄 Refresh</button>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading active deliveries...</p>
              </div>
            ) : activeDeliveries.length === 0 ? (
              <div className="empty-state-box">
                <div className="empty-icon">🚚</div>
                <h4>No Active Deliveries</h4>
                <p>You have no active orders in progress right now. Click "Available Orders" to claim jobs.</p>
                <button className="btn-primary-action" onClick={handleUseCurrentLocation}>
                  📍 Find Nearby Orders
                </button>
              </div>
            ) : (
              <div className="orders-list">
                {activeDeliveries.map((delivery) => (
                  <div className="farmer-order-card" key={delivery._id}>
                    <div className="order-card-header">
                      <div>
                        <span className="order-id">Job #{delivery.deliveryNumber || delivery._id?.substring(0, 8)}</span>
                        <span className="order-date">
                          {delivery.createdAt ? new Date(delivery.createdAt).toLocaleDateString() : "Today"}
                        </span>
                      </div>
                      <span className={`status-pill status-${delivery.status}`}>{delivery.status}</span>
                    </div>

                    <div className="order-card-body">
                      <div className="order-info-column">
                        <p className="info-item">
                          <strong>Pick Up From:</strong> {delivery.senderName || delivery.sender?.firstName || "Seller"}
                        </p>
                        <p className="info-item">
                          <strong>Deliver To:</strong> {delivery.recipientName || delivery.recipient?.firstName || "Buyer"}
                        </p>
                        <p className="info-item">
                          <strong>Delivery Address:</strong> {delivery.recipientLocation?.address || delivery.recipientLocation?.city || "Standard Address"}
                        </p>
                      </div>

                      <div className="order-items-column">
                        <p className="info-item">
                          <strong>Earnings Payout:</strong> <span className="highlight-price">₹{delivery.totalEarnings || 150}</span>
                        </p>
                        <p className="info-item">
                          <strong>Distance:</strong> {delivery.totalDistance ? `${delivery.totalDistance} km` : "Standard Route"}
                        </p>
                      </div>
                    </div>

                    <div className="order-card-actions">
                      <button
                        className="btn-confirm-order"
                        onClick={() => handleUpdateDeliveryStatus(delivery._id, "picked_up")}
                      >
                        📦 Pick Up
                      </button>
                      <button
                        className="btn-confirm-order"
                        style={{ background: "#2563eb" }}
                        onClick={() => handleUpdateDeliveryStatus(delivery._id, "in_transit")}
                      >
                        🚚 In Transit
                      </button>
                      <button
                        className="btn-confirm-order"
                        style={{ background: "#059669" }}
                        onClick={() => handleUpdateDeliveryStatus(delivery._id, "delivered")}
                      >
                        ✅ Mark Delivered
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "available-orders":
        return (
          <div className="dashboard-section-card">
            <div className="section-card-header">
              <div>
                <h3>Available Orders Near You</h3>
                {locationCoords ? (
                  <p className="subtext">Orders near GPS {locationCoords.latitude.toFixed(3)}, {locationCoords.longitude.toFixed(3)}</p>
                ) : (
                  <p className="subtext">Use your GPS location to find delivery requests nearby</p>
                )}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="btn-primary-action" onClick={handleUseCurrentLocation}>📍 GPS Location</button>
                <button className="btn-table-edit" onClick={() => loadNearbyOrders(locationCoords)}>🔄 Refresh</button>
              </div>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Searching for nearby orders...</p>
              </div>
            ) : nearbyDeliveries.length === 0 ? (
              <div className="empty-state-box">
                <div className="empty-icon">📍</div>
                <h4>No Nearby Delivery Orders Found</h4>
                <p>Click "GPS Location" to update location coordinates.</p>
              </div>
            ) : (
              <div className="orders-list">
                {nearbyDeliveries.map((delivery) => (
                  <div className="farmer-order-card" key={delivery._id}>
                    <div className="order-card-header">
                      <div>
                        <span className="order-id">Order #{delivery.deliveryNumber || delivery._id?.substring(0, 8)}</span>
                        <span className="order-date">Available</span>
                      </div>
                      <span className="status-pill status-pending">Unclaimed</span>
                    </div>

                    <div className="order-card-body">
                      <div className="order-info-column">
                        <p className="info-item">
                          <strong>Pick Up:</strong> {delivery.senderName || delivery.sender?.firstName || "Seller"}
                        </p>
                        <p className="info-item">
                          <strong>Deliver To:</strong> {delivery.recipientName || delivery.recipient?.firstName || "Buyer"}
                        </p>
                      </div>

                      <div className="order-items-column">
                        <p className="info-item">
                          <strong>Address:</strong> {delivery.recipientLocation?.address || "Nearby Address"}
                        </p>
                        <p className="info-item">
                          <strong>Payout Fee:</strong> <span className="highlight-price">₹{delivery.totalEarnings || 150}</span>
                        </p>
                      </div>
                    </div>

                    <div className="order-card-actions">
                      <button
                        className="btn-primary-action"
                        style={{ width: "100%" }}
                        disabled={Boolean(delivery.deliveryPartner)}
                        onClick={() => handleAcceptDelivery(delivery._id)}
                      >
                        {delivery.deliveryPartner ? "Already Claimed" : "✅ Accept Delivery Job"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "completed":
        return (
          <div className="dashboard-section-card">
            <div className="section-card-header">
              <h3>Completed Deliveries ({completedToday.length})</h3>
              <p className="subtext">Successfully fulfilled orders</p>
            </div>

            {completedToday.length === 0 ? (
              <div className="empty-state-box">
                <div className="empty-icon">✅</div>
                <h4>No Completed Deliveries Yet</h4>
                <p>Completed jobs will appear here.</p>
              </div>
            ) : (
              <div className="table-responsive-container">
                <table className="custom-dashboard-table">
                  <thead>
                    <tr>
                      <th>Delivery ID</th>
                      <th>Sender</th>
                      <th>Recipient</th>
                      <th>Earnings</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedToday.map((delivery) => (
                      <tr key={delivery._id}>
                        <td>#{delivery.deliveryNumber || delivery._id?.substring(0, 8)}</td>
                        <td>{delivery.senderName || "Seller"}</td>
                        <td>{delivery.recipientName || "Buyer"}</td>
                        <td className="highlight-price">₹{delivery.totalEarnings || 150}</td>
                        <td><span className="status-pill status-delivered">Delivered</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      case "profile":
        return (
          <div className="dashboard-section-card">
            <div className="section-card-header">
              <h3>Delivery Partner Profile</h3>
              <p className="subtext">Your verified account information</p>
            </div>
            {user ? (
              <div className="profile-details-grid">
                <div className="profile-avatar-banner">
                  <div className="large-avatar-circle">
                    {user.firstName?.[0] || "D"}
                  </div>
                  <h4>{user.firstName} {user.lastName}</h4>
                  <span className="role-badge">🚚 Delivery Partner</span>
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
                    <span className="field-label">Total Earnings</span>
                    <span className="field-value highlight-price">₹{stats.earningsToday}</span>
                  </div>
                  <div className="field-row">
                    <span className="field-label">Rating</span>
                    <span className="field-value">⭐ {stats.rating} / 5</span>
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
                <div className="stat-icon-bg">📦</div>
                <div className="stat-info">
                  <span className="stat-label">Active Jobs</span>
                  <h3 className="stat-value">{stats.todayDeliveries}</h3>
                  <span className="stat-subtext">Deliveries in progress</span>
                </div>
              </div>

              <div className="stat-widget emerald">
                <div className="stat-icon-bg">💰</div>
                <div className="stat-info">
                  <span className="stat-label">Total Earnings</span>
                  <h3 className="stat-value">₹{stats.earningsToday}</h3>
                  <span className="stat-subtext">Delivery payouts</span>
                </div>
              </div>

              <div className="stat-widget blue">
                <div className="stat-icon-bg">⭐</div>
                <div className="stat-info">
                  <span className="stat-label">Rating</span>
                  <h3 className="stat-value">{stats.rating}/5</h3>
                  <span className="stat-subtext">Customer feedback</span>
                </div>
              </div>

              <div className="stat-widget amber">
                <div className="stat-icon-bg">✅</div>
                <div className="stat-info">
                  <span className="stat-label">Completion Rate</span>
                  <h3 className="stat-value">{stats.completionRate}%</h3>
                  <span className="stat-subtext">Successful drop-offs</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="dashboard-section-card">
              <div className="section-card-header">
                <h3>Quick Actions</h3>
                <p className="subtext">Task shortcuts for delivery management</p>
              </div>

              <div className="quick-actions-grid">
                <div className="action-tile green-accent">
                  <div className="tile-header">
                    <span className="tile-icon">📍</span>
                    <h4>Find Nearby Jobs</h4>
                  </div>
                  <p>Use your current GPS location to discover available pickup requests.</p>
                  <button
                    className="btn-tile-action"
                    onClick={handleUseCurrentLocation}
                  >
                    Use GPS Location →
                  </button>
                </div>

                <div className="action-tile blue-accent">
                  <div className="tile-header">
                    <span className="tile-icon">🚚</span>
                    <h4>Active Deliveries</h4>
                  </div>
                  <p>Update pickup, transit, and delivery progress for active packages.</p>
                  <button
                    className="btn-tile-action"
                    onClick={() => setActiveSection("active-deliveries")}
                  >
                    Check Active Jobs →
                  </button>
                </div>

                <div className="action-tile emerald-accent">
                  <div className="tile-header">
                    <span className="tile-icon">👤</span>
                    <h4>Partner Profile</h4>
                  </div>
                  <p>View account details and payout statistics.</p>
                  <button
                    className="btn-tile-action"
                    onClick={() => setActiveSection("profile")}
                  >
                    View Profile →
                  </button>
                </div>
              </div>
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
            <span className="portal-badge">Delivery Partner Portal</span>
          </div>
        </div>

        <div className="navbar-right">
          <button
            className="navbar-btn-market"
            onClick={handleUseCurrentLocation}
          >
            📍 GPS Location
          </button>
          
          <div className="user-profile-menu">
            <div className="avatar-circle">
              {user?.firstName?.[0] || "D"}
            </div>
            <span className="user-name-display">{user?.firstName || "Partner"}</span>
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
              className={`sidebar-nav-item ${activeSection === "active-deliveries" ? "active" : ""}`}
              onClick={() => setActiveSection("active-deliveries")}
            >
              <span className="nav-icon">🚚</span>
              <span className="nav-label">Active Jobs</span>
              {activeDeliveries.length > 0 && (
                <span className="nav-count-badge warning">{activeDeliveries.length}</span>
              )}
            </div>

            <div
              className={`sidebar-nav-item ${activeSection === "available-orders" ? "active" : ""}`}
              onClick={() => setActiveSection("available-orders")}
            >
              <span className="nav-icon">📍</span>
              <span className="nav-label">Available Orders</span>
            </div>

            <div
              className={`sidebar-nav-item ${activeSection === "completed" ? "active" : ""}`}
              onClick={() => setActiveSection("completed")}
            >
              <span className="nav-icon">✅</span>
              <span className="nav-label">Completed</span>
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
                  onClick={handleUseCurrentLocation}
                >
                  📍 Find Jobs Near Me
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

export default DeliveryDashboard;

