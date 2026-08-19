import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useNotification } from "../../context/AppHooks.js";
import { deliveryAPI } from "../../services/api.js";
import { LocationService } from "../../services/LocationService.js";
import "./deliverydashboard.css";

const nextDeliveryAction = (status) => {
  if (["assigned", "accepted"].includes(status)) {
    return { status: "picked_up", label: "📦 Mark Picked Up" };
  }
  if (status === "picked_up") {
    return { status: "in_transit", label: "🚚 Start Delivery" };
  }
  if (["in_transit", "near_delivery"].includes(status)) {
    return { status: "delivered", label: "✅ Mark Delivered" };
  }
  return null;
};

const DeliveryDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { addNotification } = useNotification();

  const [activeSection, setActiveSection] = useState("dashboard");
  const [deliveries, setDeliveries] = useState([]);
  const [nearbyDeliveries, setNearbyDeliveries] = useState([]);
  const [locationCoords, setLocationCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await deliveryAPI.getDeliveries();
      setDeliveries(response.deliveries || []);
    } catch (err) {
      setError(err.message || "Unable to load deliveries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const loadNearbyOrders = useCallback(async (coords) => {
    if (
      !Number.isFinite(Number(coords?.latitude)) ||
      !Number.isFinite(Number(coords?.longitude))
    ) {
      setNearbyDeliveries([]);
      return;
    }

    setNearbyLoading(true);
    setError("");
    try {
      const response = await deliveryAPI.getNearbyDeliveries(
        Number(coords.longitude),
        Number(coords.latitude),
        20000
      );
      setNearbyDeliveries(response.deliveries || []);
    } catch (err) {
      setError(err.message || "Unable to fetch nearby delivery jobs");
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  const handleUseCurrentLocation = async () => {
    setNearbyLoading(true);
    setError("");
    try {
      const coords = await LocationService.getCurrentLocation();
      setLocationCoords(coords);
      await loadNearbyOrders(coords);
      setActiveSection("available-orders");
      addNotification?.("Delivery-job location updated", "success");
    } catch (err) {
      setError(err.message || "Unable to get current GPS location");
    } finally {
      setNearbyLoading(false);
    }
  };

  const handleAcceptDelivery = async (deliveryId) => {
    setNearbyLoading(true);
    setError("");
    try {
      await deliveryAPI.acceptDelivery(deliveryId);
      addNotification?.("Delivery job accepted", "success");
      await Promise.all([
        fetchDeliveries(),
        locationCoords ? loadNearbyOrders(locationCoords) : Promise.resolve(),
      ]);
      setActiveSection("active-deliveries");
    } catch (err) {
      const message = err.message || "Unable to accept delivery";
      setError(message);
      addNotification?.(message, "error");
      if (locationCoords) await loadNearbyOrders(locationCoords);
    } finally {
      setNearbyLoading(false);
    }
  };

  const handleUpdateDeliveryStatus = async (deliveryId, status) => {
    setLoading(true);
    setError("");
    try {
      let currentLocation = null;
      try {
        currentLocation = await LocationService.getCurrentLocation();
      } catch (locationError) {
        console.warn("Updating delivery status without GPS:", locationError);
      }

      await deliveryAPI.updateDeliveryStatus(
        deliveryId,
        status,
        currentLocation,
        `Marked ${status.replace(/_/g, " ")}`
      );
      addNotification?.(`Delivery marked ${status.replace(/_/g, " ")}`, "success");
      await fetchDeliveries();
    } catch (err) {
      const message = err.message || "Unable to update delivery status";
      setError(message);
      addNotification?.(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const activeDeliveries = useMemo(
    () => deliveries.filter((delivery) => !["delivered", "cancelled", "failed"].includes(delivery.status)),
    [deliveries]
  );
  const completedDeliveries = useMemo(
    () => deliveries.filter((delivery) => delivery.status === "delivered"),
    [deliveries]
  );

  const stats = useMemo(
    () => ({
      activeJobs: activeDeliveries.length,
      completedJobs: completedDeliveries.length,
      totalEarnings: completedDeliveries.reduce(
        (sum, delivery) => sum + (Number(delivery.totalEarnings) || 0),
        0
      ),
      rating: Number(user?.rating) || 0,
      completionRate: Number(user?.completionRate) || 0,
    }),
    [activeDeliveries.length, completedDeliveries, user?.completionRate, user?.rating]
  );

  const sectionTitle = {
    dashboard: `Welcome back, ${user?.firstName || "Delivery Partner"} 🚚`,
    "active-deliveries": "Active Deliveries",
    "available-orders": "Available Delivery Jobs",
    completed: "Completed Deliveries",
    profile: "Delivery Partner Profile",
  };

  const sectionDescription = {
    dashboard: "Claim delivery jobs, update fulfilment status, and track completed payouts.",
    "active-deliveries": "Work only through the valid pickup → transit → delivered sequence.",
    "available-orders": "Use GPS to discover unclaimed jobs within 20 km.",
    completed: "Review completed delivery tasks and payouts.",
    profile: "View your delivery-partner account information.",
  };

  const renderActiveDeliveries = () => (
    <div className="dashboard-section-card">
      <div className="section-card-header">
        <div><h3>Active Deliveries ({activeDeliveries.length})</h3><p className="subtext">Jobs currently assigned to you</p></div>
        <button className="btn-primary-action" onClick={fetchDeliveries}>🔄 Refresh</button>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner"></div><p>Loading active deliveries...</p></div>
      ) : activeDeliveries.length === 0 ? (
        <div className="empty-state-box">
          <div className="empty-icon">🚚</div>
          <h4>No Active Deliveries</h4>
          <p>Use your GPS location to find an available delivery job.</p>
          <button className="btn-primary-action" onClick={handleUseCurrentLocation}>📍 Find Nearby Jobs</button>
        </div>
      ) : (
        <div className="orders-list">
          {activeDeliveries.map((delivery) => {
            const action = nextDeliveryAction(delivery.status);
            return (
              <div className="farmer-order-card" key={delivery._id}>
                <div className="order-card-header">
                  <div>
                    <span className="order-id">Job #{delivery.deliveryNumber || delivery._id?.substring(0, 8)}</span>
                    <span className="order-date">{delivery.createdAt ? new Date(delivery.createdAt).toLocaleDateString() : "Recent"}</span>
                  </div>
                  <span className={`status-pill status-${delivery.status}`}>{delivery.status?.replace(/_/g, " ")}</span>
                </div>

                <div className="order-card-body">
                  <div className="order-info-column">
                    <p className="info-item"><strong>Pick Up:</strong> {delivery.senderName || delivery.sender?.businessName || delivery.sender?.firstName || "Seller"}</p>
                    <p className="info-item"><strong>Drop Off:</strong> {delivery.recipientName || delivery.recipient?.firstName || "Recipient"}</p>
                    <p className="info-item"><strong>Address:</strong> {delivery.recipientLocation?.address || "Address available in details"}</p>
                  </div>
                  <div className="order-items-column">
                    <p className="info-item"><strong>Payout:</strong> <span className="highlight-price">₹{Number(delivery.totalEarnings) || 0}</span></p>
                    <p className="info-item"><strong>Items:</strong> {delivery.items?.length || 0}</p>
                  </div>
                </div>

                <div className="order-card-actions">
                  <button className="btn-table-edit" onClick={() => navigate(`/delivery/${delivery._id}`)}>View Details</button>
                  {action && (
                    <button className="btn-confirm-order" onClick={() => handleUpdateDeliveryStatus(delivery._id, action.status)} disabled={loading}>
                      {action.label}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderAvailableJobs = () => (
    <div className="dashboard-section-card">
      <div className="section-card-header">
        <div>
          <h3>Available Jobs Near You</h3>
          <p className="subtext">
            {locationCoords
              ? `Within 20 km of ${Number(locationCoords.latitude).toFixed(3)}, ${Number(locationCoords.longitude).toFixed(3)}`
              : "Share your current GPS location to search nearby jobs"}
          </p>
        </div>
        <button className="btn-primary-action" onClick={handleUseCurrentLocation}>📍 {locationCoords ? "Refresh GPS" : "Use GPS"}</button>
      </div>

      {!locationCoords ? (
        <div className="empty-state-box"><div className="empty-icon">📍</div><h4>Location Required</h4><p>AgroConnect does not query a fake 0,0 location. Use your real GPS to find jobs.</p></div>
      ) : nearbyLoading ? (
        <div className="loading-state"><div className="spinner"></div><p>Searching nearby jobs...</p></div>
      ) : nearbyDeliveries.length === 0 ? (
        <div className="empty-state-box"><div className="empty-icon">🚚</div><h4>No Available Jobs Nearby</h4><p>Try refreshing again later.</p></div>
      ) : (
        <div className="orders-list">
          {nearbyDeliveries.map((delivery) => (
            <div className="farmer-order-card" key={delivery._id}>
              <div className="order-card-header">
                <div><span className="order-id">Job #{delivery.deliveryNumber || delivery._id?.substring(0, 8)}</span><span className="order-date">Available</span></div>
                <span className="status-pill status-pending">Unclaimed</span>
              </div>
              <div className="order-card-body">
                <div className="order-info-column">
                  <p className="info-item"><strong>Pick Up:</strong> {delivery.senderName || "Seller"}</p>
                  <p className="info-item"><strong>Deliver To:</strong> {delivery.recipientName || "Recipient"}</p>
                </div>
                <div className="order-items-column">
                  <p className="info-item"><strong>Drop-off:</strong> {delivery.recipientLocation?.address || "Nearby address"}</p>
                  <p className="info-item"><strong>Payout:</strong> <span className="highlight-price">₹{Number(delivery.totalEarnings) || 0}</span></p>
                </div>
              </div>
              <div className="order-card-actions">
                <button className="btn-primary-action" style={{ width: "100%" }} onClick={() => handleAcceptDelivery(delivery._id)} disabled={nearbyLoading}>
                  ✅ Accept Delivery Job
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCompleted = () => (
    <div className="dashboard-section-card">
      <div className="section-card-header"><div><h3>Completed Deliveries ({completedDeliveries.length})</h3><p className="subtext">Successfully fulfilled jobs</p></div></div>
      {completedDeliveries.length === 0 ? (
        <div className="empty-state-box"><div className="empty-icon">✅</div><h4>No Completed Deliveries Yet</h4></div>
      ) : (
        <div className="table-responsive-container">
          <table className="custom-dashboard-table">
            <thead><tr><th>Delivery</th><th>Sender</th><th>Recipient</th><th>Payout</th><th>Completed</th><th></th></tr></thead>
            <tbody>
              {completedDeliveries.map((delivery) => (
                <tr key={delivery._id}>
                  <td>#{delivery.deliveryNumber || delivery._id?.substring(0, 8)}</td>
                  <td>{delivery.senderName || "Seller"}</td>
                  <td>{delivery.recipientName || "Recipient"}</td>
                  <td className="highlight-price">₹{Number(delivery.totalEarnings) || 0}</td>
                  <td>{delivery.actualDeliveryTime ? new Date(delivery.actualDeliveryTime).toLocaleDateString() : "Completed"}</td>
                  <td><button className="btn-table-edit" onClick={() => navigate(`/delivery/${delivery._id}`)}>Details</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderProfile = () => (
    <div className="dashboard-section-card">
      <div className="section-card-header"><div><h3>Delivery Partner Profile</h3><p className="subtext">Your account information</p></div></div>
      <div className="profile-details-grid">
        <div className="profile-avatar-banner">
          <div className="large-avatar-circle">{user?.firstName?.[0] || "D"}</div>
          <h4>{user?.firstName} {user?.lastName}</h4>
          <span className="role-badge">🚚 Delivery Partner</span>
        </div>
        <div className="profile-fields-card">
          <div className="field-row"><span className="field-label">Email</span><span className="field-value">{user?.email || "Not provided"}</span></div>
          <div className="field-row"><span className="field-label">Phone</span><span className="field-value">{user?.phone || "Not provided"}</span></div>
          <div className="field-row"><span className="field-label">Rating</span><span className="field-value">{stats.rating > 0 ? `⭐ ${stats.rating.toFixed(1)} / 5` : "No rating yet"}</span></div>
          <div className="field-row"><span className="field-label">Completion Rate</span><span className="field-value">{stats.completionRate}%</span></div>
          <div className="field-row"><span className="field-label">Completed Jobs</span><span className="field-value">{stats.completedJobs}</span></div>
          <div className="field-row"><span className="field-label">Completed Payouts</span><span className="field-value highlight-price">₹{stats.totalEarnings}</span></div>
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <>
      <div className="stats-grid">
        {[
          ["green", "🚚", "Active Jobs", stats.activeJobs, "In progress"],
          ["blue", "✅", "Completed", stats.completedJobs, "Finished jobs"],
          ["emerald", "💰", "Completed Payouts", `₹${stats.totalEarnings}`, "Delivered jobs"],
          ["amber", "⭐", "Rating", stats.rating > 0 ? stats.rating.toFixed(1) : "—", "Partner rating"],
        ].map(([theme, icon, label, value, sub]) => (
          <div className={`stat-widget ${theme}`} key={label}>
            <div className="stat-icon-bg">{icon}</div>
            <div className="stat-info"><span className="stat-label">{label}</span><h3 className="stat-value">{value}</h3><span className="stat-subtext">{sub}</span></div>
          </div>
        ))}
      </div>

      <div className="dashboard-section-card">
        <div className="section-card-header"><div><h3>Quick Actions</h3><p className="subtext">Manage your delivery work</p></div></div>
        <div className="quick-actions-grid">
          <div className="action-tile green-accent"><div className="tile-header"><span className="tile-icon">📍</span><h4>Find Jobs</h4></div><p>Use GPS to search available jobs within 20 km.</p><button className="btn-tile-action" onClick={handleUseCurrentLocation}>Find Jobs →</button></div>
          <div className="action-tile blue-accent"><div className="tile-header"><span className="tile-icon">🚚</span><h4>Active Jobs</h4></div><p>Continue pickups and deliveries already assigned to you.</p><button className="btn-tile-action" onClick={() => setActiveSection("active-deliveries")}>Open Jobs →</button></div>
          <div className="action-tile emerald-accent"><div className="tile-header"><span className="tile-icon">✅</span><h4>Completed</h4></div><p>Review delivered jobs and completed payouts.</p><button className="btn-tile-action" onClick={() => setActiveSection("completed")}>View History →</button></div>
        </div>
      </div>
    </>
  );

  const renderSectionContent = () => {
    if (activeSection === "active-deliveries") return renderActiveDeliveries();
    if (activeSection === "available-orders") return renderAvailableJobs();
    if (activeSection === "completed") return renderCompleted();
    if (activeSection === "profile") return renderProfile();
    return renderDashboard();
  };

  return (
    <div className="farmer-portal-container">
      <header className="farmer-navbar">
        <div className="navbar-left">
          <div className="brand-logo" onClick={() => setActiveSection("dashboard")}>
            <span className="brand-leaf">🌱</span><span className="brand-title">AgroConnect</span><span className="portal-badge">Delivery Partner</span>
          </div>
        </div>
        <div className="navbar-right">
          <button className="navbar-btn-market" onClick={handleUseCurrentLocation}>📍 Find Jobs</button>
          <div className="user-profile-menu">
            <div className="avatar-circle">{user?.firstName?.[0] || "D"}</div>
            <span className="user-name-display">{user?.firstName || "Partner"}</span>
            <button className="btn-logout" onClick={() => { logout(); navigate("/login"); }}>🚪 Logout</button>
          </div>
        </div>
      </header>

      <div className="farmer-body-layout">
        <aside className="farmer-sidebar">
          <div className="sidebar-nav-list">
            <div className={`sidebar-nav-item ${activeSection === "dashboard" ? "active" : ""}`} onClick={() => setActiveSection("dashboard")}><span className="nav-icon">📊</span><span className="nav-label">Dashboard</span></div>
            <div className={`sidebar-nav-item ${activeSection === "active-deliveries" ? "active" : ""}`} onClick={() => setActiveSection("active-deliveries")}><span className="nav-icon">🚚</span><span className="nav-label">Active Jobs</span>{activeDeliveries.length > 0 && <span className="nav-count-badge warning">{activeDeliveries.length}</span>}</div>
            <div className={`sidebar-nav-item ${activeSection === "available-orders" ? "active" : ""}`} onClick={() => setActiveSection("available-orders")}><span className="nav-icon">📍</span><span className="nav-label">Available Jobs</span></div>
            <div className={`sidebar-nav-item ${activeSection === "completed" ? "active" : ""}`} onClick={() => setActiveSection("completed")}><span className="nav-icon">✅</span><span className="nav-label">Completed</span></div>
            <div className={`sidebar-nav-item ${activeSection === "profile" ? "active" : ""}`} onClick={() => setActiveSection("profile")}><span className="nav-icon">👤</span><span className="nav-label">Profile</span></div>
          </div>
        </aside>

        <main className="farmer-main-content">
          {error && <div className="error-banner">{error}</div>}
          <div className="welcome-banner-card">
            <div className="banner-text"><h2>{sectionTitle[activeSection]}</h2><p>{sectionDescription[activeSection]}</p></div>
            {activeSection === "dashboard" && <div className="banner-action-side"><button className="banner-primary-btn" onClick={handleUseCurrentLocation}>📍 Find Jobs Near Me</button></div>}
          </div>
          {renderSectionContent()}
        </main>
      </div>
    </div>
  );
};

export default DeliveryDashboard;
