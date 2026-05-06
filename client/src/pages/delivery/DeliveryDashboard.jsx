import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppContext.jsx";
import "./deliverydashboard.css";

const DeliveryDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const activeDeliveries = [
    {
      id: "DEL001",
      type: "Product",
      from: "Ramesh Kumar (Farmer)",
      to: "Priya Singh (Buyer)",
      location: "Sector 5, Noida",
      status: "In Transit",
      distance: "3.2 km away",
      time: "8 mins",
    },
    {
      id: "DEL002",
      type: "Fertilizer",
      from: "Agro Supplies Co",
      to: "Suresh Patel (Farmer)",
      location: "Sector 7, Noida",
      status: "Picked Up",
      distance: "1.5 km away",
      time: "5 mins",
    },
  ];

  const completedToday = [
    { id: "DEL003", type: "Product", from: "Anil Sharma", amount: "₹450", completedAt: "02:30 PM" },
    { id: "DEL004", type: "Fertilizer", from: "Soil Care Ltd", amount: "₹2,100", completedAt: "11:45 AM" },
    { id: "DEL005", type: "Product", from: "Vijay Kumar", amount: "₹680", completedAt: "09:15 AM" },
  ];

  const stats = [
    { label: "Today's Deliveries", value: "8", icon: "📦" },
    { label: "Earnings Today", value: "₹1,850", icon: "💰" },
    { label: "Rating", value: "4.9/5", icon: "⭐" },
    { label: "Completion Rate", value: "98%", icon: "✅" },
  ];

  return (
    <div className="delivery-dashboard-page">
      {/* Topbar */}
      <div className="delivery-topbar">
        <div className="delivery-topbar-inner">
          <div className="delivery-brand">🌱 AgroConnect</div>
          <div className="delivery-title">🚚 Delivery Partner Dashboard</div>
          <div className="delivery-topbar-right">
            <button className="lang-btn">English ▼</button>
            <button className="location-btn">📍 Location</button>
            <button className="logout-btn" onClick={() => { logout(); navigate("/login"); }}>
              Logout
            </button>
            <div className="profile-circle">D</div>
          </div>
        </div>
      </div>

      <div className="delivery-layout">
        {/* Sidebar */}
        <div className="delivery-sidebar">
          <h3 className="sidebar-title">🚚 Delivery Panel</h3>

          <div className="sidebar-item active">Dashboard</div>
          <div className="sidebar-item">Active Deliveries</div>
          <div className="sidebar-item">Completed</div>
          <div className="sidebar-item">Earnings</div>
          <div className="sidebar-item">Route Planner</div>
          <div className="sidebar-item">Navigation</div>
          <div className="sidebar-item">Support</div>
          <div className="sidebar-item">Profile</div>
          <div className="sidebar-item">Logout</div>
        </div>

        {/* Main Content */}
        <div className="delivery-main">
          {/* Welcome */}
          <div className="delivery-welcome">
            <h2>Welcome, Delivery Partner 👋</h2>
            <p>Track your deliveries, optimize routes, and maximize earnings</p>
          </div>

          {/* Stats Grid */}
          <div className="delivery-stats-grid">
            {stats.map((stat, idx) => (
              <div className="delivery-stat-card" key={idx}>
                <div className="stat-icon">{stat.icon}</div>
                <div className="stat-info">
                  <p className="stat-label">{stat.label}</p>
                  <h3 className="stat-value">{stat.value}</h3>
                </div>
              </div>
            ))}
          </div>

          {/* Active Deliveries */}
          <div className="delivery-section">
            <div className="section-header">
              <h3>🔴 Active Deliveries ({activeDeliveries.length})</h3>
              <button className="refresh-btn">🔄 Refresh</button>
            </div>

            <div className="active-deliveries">
              {activeDeliveries.map((delivery) => (
                <div className="delivery-card active" key={delivery.id}>
                  <div className="delivery-header">
                    <div className="delivery-id">
                      <span className="id-label">{delivery.id}</span>
                      <span className={`delivery-type ${delivery.type.toLowerCase()}`}>{delivery.type}</span>
                    </div>
                    <div className={`delivery-status ${delivery.status.toLowerCase()}`}>{delivery.status}</div>
                  </div>

                  <div className="delivery-details">
                    <div className="route-info">
                      <div className="route-point from">
                        <span className="point">📤</span>
                        <span className="text">{delivery.from}</span>
                      </div>
                      <div className="route-arrow">→</div>
                      <div className="route-point to">
                        <span className="point">📥</span>
                        <span className="text">{delivery.to}</span>
                      </div>
                    </div>

                    <div className="delivery-meta">
                      <span className="meta-item">📍 {delivery.location}</span>
                      <span className="meta-item">📏 {delivery.distance}</span>
                      <span className="meta-item">⏱️ ~{delivery.time}</span>
                    </div>
                  </div>

                  <div className="delivery-actions">
                    <button className="action-btn primary">📍 Navigate</button>
                    <button className="action-btn">☎️ Contact</button>
                    <button className="action-btn">📸 Proof</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Completed Today */}
          <div className="delivery-section">
            <div className="section-header">
              <h3>✅ Completed Today ({completedToday.length})</h3>
              <button className="view-all">View Details →</button>
            </div>

            <div className="completed-list">
              {completedToday.map((delivery) => (
                <div className="completed-item" key={delivery.id}>
                  <div className="completed-left">
                    <span className="completed-id">{delivery.id}</span>
                    <span className="completed-from">{delivery.from}</span>
                  </div>
                  <div className="completed-right">
                    <span className="completed-amount">{delivery.amount}</span>
                    <span className="completed-time">{delivery.completedAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Route Optimization */}
          <div className="delivery-section">
            <h3>🗺️ Smart Route Planner</h3>
            <div className="route-planner">
              <div className="route-info-box">
                <p>
                  <strong>Optimized Route:</strong> Complete {activeDeliveries.length} deliveries in ~25 minutes
                </p>
                <button className="optimize-btn">🎯 Optimize Route</button>
              </div>
              <div className="map-placeholder">
                <p>📍 Map will appear here after API integration</p>
              </div>
            </div>
          </div>

          {/* Earnings Summary */}
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
                <div className="earnings-amount">₹1,850</div>
                <div className="earnings-deliveries">7 deliveries</div>
              </div>
              <div className="earnings-card">
                <div className="earnings-day">Today</div>
                <div className="earnings-amount">₹1,200</div>
                <div className="earnings-deliveries">5 deliveries (ongoing)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryDashboard;
