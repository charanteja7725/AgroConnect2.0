import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppHooks.js";
import { deliveryAPI } from "../../services/api.js";
import { LocationService } from "../../services/LocationService.js";
import "./deliverydashboard.css";

const DeliveryDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [deliveries, setDeliveries] = useState([]);
  const [nearbyDeliveries, setNearbyDeliveries] = useState([]);
  const [locationCoords, setLocationCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    todayDeliveries: 0,
    earningsToday: 0,
    rating: 4.9,
    completionRate: 98,
  });

  const fetchDeliveries = async () => {
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
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const handleUpdateDeliveryStatus = async (deliveryId, status) => {
    setLoading(true);
    try {
      await deliveryAPI.updateDeliveryStatus(deliveryId, status, null, `Marked ${status}`);
      await fetchDeliveries();
      if (activeSection === "available-orders") {
        await loadNearbyOrders(locationCoords);
      }
    } catch (err) {
      setError(err.message || "Unable to update delivery status");
    } finally {
      setLoading(false);
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
    } catch (err) {
      setError(err.message || "Unable to get current location");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadNearby = handleUseCurrentLocation;

  const loadNearbyOrders = async (coords) => {
    if (!coords?.latitude || !coords?.longitude) {
      return;
    }

    const response = await deliveryAPI.getNearbyDeliveries(coords.longitude, coords.latitude, 20000);
    setNearbyDeliveries(response.deliveries || []);
  };

  const handleAcceptDelivery = async (deliveryId) => {
    setLoading(true);
    setError("");
    try {
      await deliveryAPI.acceptDelivery(deliveryId);
      await fetchDeliveries();
      await loadNearbyOrders(locationCoords);
    } catch (err) {
      setError(err.message || "Unable to accept delivery");
    } finally {
      setLoading(false);
    }
  };


  const renderSectionContent = () => {
    const activeDeliveries = deliveries.filter((delivery) => !["delivered", "cancelled", "failed"].includes(delivery.status));
    const completedToday = deliveries.filter((delivery) => delivery.status === "delivered");

    switch (activeSection) {
      case "active-deliveries":
        return (
          <div className="delivery-section">
            <div className="section-header">
              <h3>🔴 Active Deliveries ({activeDeliveries.length})</h3>
              <button className="refresh-btn" onClick={fetchDeliveries}>🔄 Refresh</button>
            </div>
            {loading ? (
              <p>Loading deliveries...</p>
            ) : activeDeliveries.length === 0 ? (
              <p className="placeholder-text">No active deliveries at the moment.</p>
            ) : (
              <div className="active-deliveries">
                {activeDeliveries.map((delivery) => (
                  <div className="delivery-card active" key={delivery._id}>
                    <div className="delivery-header">
                      <div className="delivery-id">
                        <span className="id-label">{delivery.deliveryNumber || delivery._id}</span>
                        <span className={`delivery-type ${delivery.type}`}>{delivery.type}</span>
                      </div>
                      <div className={`delivery-status ${delivery.status}`}>{delivery.status}</div>
                    </div>
                    <div className="delivery-details">
                      <div className="route-info">
                        <div className="route-point from">
                          <span className="point">📤</span>
                          <span className="text">{delivery.senderName || delivery.sender?.firstName}</span>
                        </div>
                        <div className="route-arrow">→</div>
                        <div className="route-point to">
                          <span className="point">📥</span>
                          <span className="text">{delivery.recipientName || delivery.recipient?.firstName}</span>
                        </div>
                      </div>
                      <div className="delivery-meta">
                        <span className="meta-item">📍 {delivery.recipientLocation?.address || delivery.recipientLocation?.city}</span>
                        <span className="meta-item">📏 {delivery.totalDistance ? `${delivery.totalDistance} km` : "—"}</span>
                        <span className="meta-item">⏱️ {delivery.deliveryDuration ? `${delivery.deliveryDuration} mins` : "TBD"}</span>
                      </div>
                    </div>
                    <div className="delivery-actions">
                      <button className="action-btn primary" onClick={() => handleUpdateDeliveryStatus(delivery._id, "picked_up")}>Pick Up</button>
                      <button className="action-btn" onClick={() => handleUpdateDeliveryStatus(delivery._id, "in_transit")}>In Transit</button>
                      <button className="action-btn" onClick={() => handleUpdateDeliveryStatus(delivery._id, "delivered")}>Mark Delivered</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "completed":
        return (
          <div className="delivery-section">
            <div className="section-header">
              <h3>✅ Completed Today ({completedToday.length})</h3>
              <button className="view-all">View Details →</button>
            </div>
            <div className="completed-list">
              {completedToday.map((delivery) => (
                <div className="completed-item" key={delivery._id}>
                  <div className="completed-left">
                    <span className="completed-id">{delivery.deliveryNumber || delivery._id}</span>
                    <span className="completed-from">{delivery.senderName || delivery.sender?.firstName}</span>
                  </div>
                  <div className="completed-right">
                    <span className="completed-amount">₹{delivery.totalEarnings || 0}</span>
                    <span className="completed-time">{new Date(delivery.actualDeliveryTime || delivery.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "earnings":
        return (
          <div className="delivery-section">
            <h3>💰 Earnings This Week</h3>
            <div className="earnings-grid">
              <div className="earnings-card">
                <div className="earnings-day">Monday</div>
                <div className="earnings-amount">₹1,450</div>
                <div className="earnings-deliveries">5 deliveries</div>
              </div>
              <div className="earnings-card">
                <div className="earnings-day">Tuesday</div>
                <div className="earnings-amount">₹1,680</div>
                <div className="earnings-deliveries">6 deliveries</div>
              </div>
              <div className="earnings-card">
                <div className="earnings-day">Wednesday</div>
                <div className="earnings-amount">₹1,200</div>
                <div className="earnings-deliveries">4 deliveries</div>
              </div>
              <div className="earnings-card">
                <div className="earnings-day">Thursday</div>
                <div className="earnings-amount">₹1,800</div>
                <div className="earnings-deliveries">7 deliveries</div>
              </div>
              <div className="earnings-card">
                <div className="earnings-day">Friday</div>
                <div className="earnings-amount">₹2,100</div>
                <div className="earnings-deliveries">8 deliveries</div>
              </div>
              <div className="earnings-card">
                <div className="earnings-day">Saturday</div>
                <div className="earnings-amount">₹1,950</div>
                <div className="earnings-deliveries">7 deliveries</div>
              </div>
              <div className="earnings-card">
                <div className="earnings-day">Sunday</div>
                <div className="earnings-amount">₹1,600</div>
                <div className="earnings-deliveries">6 deliveries</div>
              </div>
            </div>
          </div>
        );

      case "available-orders":
        return (
          <div className="delivery-section">
            <div className="section-header">
              <div>
                <h3>📍 Available Orders Near You</h3>
                {locationCoords ? (
                  <p className="subtext">Showing orders near {locationCoords.latitude.toFixed(4)}, {locationCoords.longitude.toFixed(4)}</p>
                ) : (
                  <p className="subtext">Use your current location to see order requests nearby.</p>
                )}
              </div>
              <div className="section-actions">
                <button className="primary-btn" onClick={handleUseCurrentLocation}>Use My Current Location</button>
                <button className="refresh-btn" onClick={() => loadNearbyOrders(locationCoords)}>Refresh Nearby</button>
              </div>
            </div>

            {loading ? (
              <p>Loading nearby orders...</p>
            ) : nearbyDeliveries.length === 0 ? (
              <p className="placeholder-text">No nearby orders found yet. Try refreshing your location.</p>
            ) : (
              <div className="delivery-list">
                {nearbyDeliveries.map((delivery) => (
                    <div className="delivery-card available" key={delivery._id}>
                      <div className="delivery-header">
                        <div className="delivery-id">
                          <span className="id-label">{delivery.deliveryNumber || delivery._id}</span>
                          <span className={`delivery-type ${delivery.type}`}>{delivery.type}</span>
                        </div>
                        <div className={`delivery-status ${delivery.status}`}>{delivery.status}</div>
                      </div>

                      <div className="delivery-details">
                        <div className="route-info">
                          <div className="route-point from">
                            <span className="point">📤</span>
                            <span className="text">{delivery.senderName || delivery.sender?.firstName || "Seller"}</span>
                          </div>
                          <div className="route-arrow">→</div>
                          <div className="route-point to">
                            <span className="point">📥</span>
                            <span className="text">{delivery.recipientName || delivery.recipient?.firstName || "Buyer"}</span>
                          </div>
                        </div>
                        <div className="delivery-meta">
                          <span className="meta-item">📍 {delivery.recipientLocation?.address || delivery.recipientLocation?.city || "Delivery address"}</span>
                          <span className="meta-item">📏 {delivery.totalDistance ? `${delivery.totalDistance} km` : "Distance not set"}</span>
                        </div>
                      </div>

                      <div className="delivery-actions">
                        {delivery.deliveryPartner ? (
                          <button className="action-btn" disabled>
                            Claimed
                          </button>
                        ) : (
                          <button className="action-btn primary" onClick={() => handleAcceptDelivery(delivery._id)}>
                            Accept Delivery
                          </button>
                        )}
                      </div>
                    </div>
                ))}
              </div>
            )}
          </div>
        );

      case "profile":
        return (
          <div className="delivery-section">
            <h3>Your Profile</h3>
            <div className="profile-card">
              <p><strong>Name:</strong> Delivery Partner</p>
              <p><strong>Email:</strong> partner@agroconnect.com</p>
              <p><strong>Phone:</strong> +91 98765 43210</p>
              <p><strong>Role:</strong> Delivery Partner</p>
              <p><strong>Total Earnings:</strong> ₹{stats.earningsToday}</p>
              <p><strong>Total Deliveries:</strong> {stats.todayDeliveries}</p>
              <button className="section-action">Edit Profile</button>
            </div>
          </div>
        );

      default:
        return (
          <>
            <div className="delivery-welcome">
              <h2>Welcome, Delivery Partner 👋</h2>
              <p>Track your deliveries, optimize routes, and maximize earnings</p>
            </div>

            <div className="delivery-stats-grid">
              <div className="delivery-stat-card">
                <div className="stat-icon">📦</div>
                <div className="stat-info">
                  <p className="stat-label">Today's Deliveries</p>
                  <h3 className="stat-value">{stats.todayDeliveries}</h3>
                </div>
              </div>
              <div className="delivery-stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-info">
                  <p className="stat-label">Earnings Today</p>
                  <h3 className="stat-value">₹{stats.earningsToday.toLocaleString() || 0}</h3>
                </div>
              </div>
              <div className="delivery-stat-card">
                <div className="stat-icon">⭐</div>
                <div className="stat-info">
                  <p className="stat-label">Rating</p>
                  <h3 className="stat-value">{stats.rating}/5</h3>
                </div>
              </div>
              <div className="delivery-stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <p className="stat-label">Completion Rate</p>
                  <h3 className="stat-value">{stats.completionRate}%</h3>
                </div>
              </div>
            </div>

            {error && <div className="error-state">{error}</div>}

            <div className="delivery-section">
              <h3>🗺️ Smart Route Planner</h3>
              <div className="route-planner">
                <div className="route-info-box">
                  <p>
                    <strong>Optimized Route:</strong> Complete {activeDeliveries.length} deliveries with smart routing and live tracking.
                  </p>
                  <button className="optimize-btn" onClick={handleLoadNearby}>🎯 Optimize Route</button>
                </div>
                <div className="map-placeholder">
                  <p>📍 Live route planning and nearby delivery suggestions are now connected.</p>
                </div>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="delivery-dashboard-page">
      <div className="delivery-topbar">
        <div className="delivery-topbar-inner">
          <div className="delivery-brand">🌱 AgroConnect</div>
          <div className="delivery-title">🚚 Delivery Partner Dashboard</div>
          <div className="delivery-topbar-right">
            <button className="lang-btn">English ▼</button>
            <button className="location-btn" onClick={handleLoadNearby}>📍 Refresh Nearby</button>
            <button className="logout-btn" onClick={() => { logout(); navigate("/login"); }}>
              Logout
            </button>
            <div className="profile-circle">D</div>
          </div>
        </div>
      </div>

      <div className="delivery-layout">
        <div className="delivery-sidebar">
          <h3 className="sidebar-title">🚚 Delivery Panel</h3>
          <div className={`sidebar-item ${activeSection === "dashboard" ? "active" : ""}`} onClick={() => setActiveSection("dashboard")}>Dashboard</div>
          <div className={`sidebar-item ${activeSection === "active-deliveries" ? "active" : ""}`} onClick={() => setActiveSection("active-deliveries")}>Active Deliveries</div>
          <div className={`sidebar-item ${activeSection === "available-orders" ? "active" : ""}`} onClick={handleUseCurrentLocation}>Available Orders</div>
          <div className={`sidebar-item ${activeSection === "completed" ? "active" : ""}`} onClick={() => setActiveSection("completed")}>Completed</div>
          <div className={`sidebar-item ${activeSection === "earnings" ? "active" : ""}`} onClick={() => setActiveSection("earnings")}>Earnings</div>
          <div className={`sidebar-item ${activeSection === "profile" ? "active" : ""}`} onClick={() => setActiveSection("profile")}>Profile</div>
          <div className="sidebar-item" onClick={() => setActiveSection("dashboard")}>Route Planner</div>
          <div className="sidebar-item" onClick={() => setActiveSection("dashboard")}>Navigation</div>
          <div className="sidebar-item" onClick={() => setActiveSection("dashboard")}>Support</div>
          <div className="sidebar-item" onClick={() => { logout(); navigate("/login"); }}>Logout</div>
        </div>

        <div className="delivery-main">
          {renderSectionContent()}
        </div>
      </div>
    </div>
  );
};

export default DeliveryDashboard;
