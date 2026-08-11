import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { deliveryAPI } from "../../services/api.js";
import "./deliverydashboard.css";

const DeliveryDashboard = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { logout, user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusUpdates, setStatusUpdates] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  const loadDeliveries = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await deliveryAPI.getDeliveries();
      setDeliveries(response.deliveries || []);
    } catch (err) {
      setError("Failed to load deliveries");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDeliveries();
    setRefreshing(false);
  };

  const handleStatusChange = (deliveryId, status) => {
    setStatusUpdates((prev) => ({ ...prev, [deliveryId]: status }));
  };

  const updateDeliveryStatus = async (deliveryId) => {
    const newStatus = statusUpdates[deliveryId];
    if (!newStatus) return;

    try {
      await deliveryAPI.updateDeliveryStatus(deliveryId, newStatus, null, "Updated by partner");
      await loadDeliveries();
      setStatusUpdates((prev) => ({ ...prev, [deliveryId]: "" }));
    } catch (err) {
      setError("Failed to update delivery status");
      console.error(err);
    }
  };

  const activeDeliveries = useMemo(
    () => deliveries.filter((delivery) => !["delivered", "cancelled", "failed"].includes(delivery.status)),
    [deliveries]
  );

  const completedToday = useMemo(() => {
    const today = new Date().toDateString();
    return deliveries.filter((delivery) => {
      const deliveredAt = delivery.actualDeliveryTime ? new Date(delivery.actualDeliveryTime) : null;
      return deliveredAt && deliveredAt.toDateString() === today;
    });
  }, [deliveries]);

  const earningsToday = useMemo(
    () =>
      completedToday.reduce(
        (sum, delivery) => sum + (delivery.totalEarnings || delivery.deliveryCharge || 0),
        0
      ),
    [completedToday]
  );

  const completedCount = useMemo(
    () => deliveries.filter((delivery) => delivery.status === "delivered").length,
    [deliveries]
  );

  const completionRate = useMemo(
    () => (deliveries.length === 0 ? 0 : Math.round((completedCount / deliveries.length) * 100)),
    [deliveries.length, completedCount]
  );

  const stats = [
    { label: t("activeDeliveries"), value: activeDeliveries.length.toString(), icon: "📦" },
    { label: t("earningsToday"), value: `₹${earningsToday.toLocaleString()}`, icon: "💰" },
    { label: t("rating"), value: `${user?.rating?.toFixed(1) || "0.0"}/5`, icon: "⭐" },
    { label: t("completionRate"), value: `${completionRate}%`, icon: "✅" },
  ];

  const statusOptions = [
    "assigned",
    "accepted",
    "picked_up",
    "in_transit",
    "near_delivery",
    "delivered",
    "cancelled",
  ];

  return (
    <div className="delivery-dashboard-page">
      {/* Topbar */}
      <div className="delivery-topbar">
        <div className="delivery-topbar-inner">
          <div className="delivery-brand">🌱 AgroConnect</div>
          <div className="delivery-title">🚚 {t("deliveryDashboardTitle")}</div>
          <div className="delivery-topbar-right">
            <button className="lang-btn">{t("english")} ▼</button>
            <button className="location-btn">📍 {t("currentLocation")}</button>
            <button className="logout-btn" onClick={() => { logout(); navigate("/login"); }}>
              {t("logout")}
            </button>
            <div className="profile-circle">{user?.firstName?.[0] || "D"}</div>
          </div>
        </div>
      </div>

      <div className="delivery-layout">
        {/* Sidebar */}
        <div className="delivery-sidebar">
          <h3 className="sidebar-title">🚚 {t("deliveryPanelTitle")}</h3>

          <div className="sidebar-item active">{t("dashboard")}</div>
          <div className="sidebar-item">{t("activeDeliveries")}</div>
          <div className="sidebar-item">{t("completed")}</div>
          <div className="sidebar-item">{t("earningsToday")}</div>
          <div className="sidebar-item">{t("routePlanner")}</div>
          <div className="sidebar-item">{t("navigation")}</div>
          <div className="sidebar-item">{t("support")}</div>
          <div className="sidebar-item">{t("profile")}</div>
          <div className="sidebar-item" onClick={() => { logout(); navigate("/login"); }}>{t("logout")}</div>
        </div>

        {/* Main Content */}
        <div className="delivery-main">
          {loading ? (
            <div className="loading">{t("loadingDeliveries")}</div>
          ) : (
            <>
              {/* Welcome */}
              <div className="delivery-welcome">
                <h2>{t("welcomeDeliveryPartner")}</h2>
                <p>{t("deliveryPartnerDescription")}</p>
              </div>

              {error && <div className="error-message">{error}</div>}

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
                  <h3>🔴 {t("activeDeliveries")} ({activeDeliveries.length})</h3>
                  <button className="refresh-btn" onClick={handleRefresh}>
                    {refreshing ? t("refreshing") : `🔄 ${t("refresh")}`}
                  </button>
                </div>

                {!activeDeliveries.length ? (
                  <p>{t("noActiveDeliveries")}</p>
                ) : (
                  <div className="active-deliveries">
                    {activeDeliveries.map((delivery) => (
                      <div className="delivery-card active" key={delivery._id} onClick={() => navigate(`/delivery/${delivery._id}`)}>
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
                              <span className="text">{delivery.senderName || delivery.sender?.firstName || t("sender")}</span>
                            </div>
                            <div className="route-arrow">→</div>
                            <div className="route-point to">
                              <span className="point">📥</span>
                              <span className="text">{delivery.recipientName || delivery.recipient?.firstName || t("recipient")}</span>
                            </div>
                          </div>

                          <div className="delivery-meta">
                            <span className="meta-item">📍 {delivery.recipientLocation?.address || t("locationPending")}</span>
                            <span className="meta-item">💼 {delivery.type === "fertilizer" ? t("deliveryTypeFertilizer") : t("deliveryTypeProduct")}</span>
                            <span className="meta-item">💰 ₹{delivery.deliveryCharge || 0}</span>
                          </div>
                        </div>

                        <div className="delivery-actions">
                          <select
                            value={statusUpdates[delivery._id] || delivery.status}
                            onChange={(e) => handleStatusChange(delivery._id, e.target.value)}
                          >
                            <option value="">Update status</option>
                            {statusOptions.map((status) => (
                              <option key={status} value={status}>
                                {t(`deliveryStatus_${status}`, status.replace(/_/g, " "))}
                              </option>
                            ))}
                          </select>
                          <button
                            className="action-btn primary"
                            onClick={() => updateDeliveryStatus(delivery._id)}
                            disabled={!statusUpdates[delivery._id] || statusUpdates[delivery._id] === delivery.status}
                          >
                            {t("update")}
                          </button>
                          <button className="action-btn" onClick={() => navigate(`/delivery/${delivery._id}`)}>
                            {t("details")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Completed Today */}
              <div className="delivery-section">
                <div className="section-header">
                  <h3>✅ {t("completedToday")} ({completedToday.length})</h3>
                  <button className="view-all" onClick={() => navigate("/delivery")}>{t("viewAll")}</button>
                </div>

                {!completedToday.length ? (
                  <p>{t("noDeliveriesCompletedToday")}</p>
                ) : (
                  <div className="completed-list">
                    {completedToday.map((delivery) => (
                      <div className="completed-item" key={delivery._id}>
                        <div className="completed-left">
                          <span className="completed-id">{delivery.deliveryNumber || delivery._id}</span>
                          <span className="completed-from">{delivery.senderName || delivery.sender?.firstName || "Sender"}</span>
                        </div>
                        <div className="completed-right">
                          <span className="completed-amount">₹{delivery.totalEarnings || delivery.deliveryCharge || 0}</span>
                          <span className="completed-time">{new Date(delivery.actualDeliveryTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Route Optimization */}
              <div className="delivery-section">
                <h3>{t("smartRoutePlanner")}</h3>
                <div className="route-planner">
                  <div className="route-info-box">
                    <p>
                      <strong>{t("optimizedRoute")}</strong> {t("routeSummary", { count: activeDeliveries.length })}
                    </p>
                    <button className="optimize-btn">🎯 {t("optimizeRoute")}</button>
                  </div>
                  <div className="map-placeholder">
                    <p>{t("liveMapPlaceholder")}</p>
                  </div>
                </div>
              </div>

              {/* Earnings Summary */}
              <div className="delivery-section">
                <h3>{t("earningsThisWeek")}</h3>
                <div className="earnings-grid">
                  <div className="earnings-card">
                    <div className="earnings-day">{t("upcoming")}</div>
                    <div className="earnings-amount">₹{earningsToday.toLocaleString()}</div>
                    <div className="earnings-deliveries">{completedToday.length} {t("completedTodayLabel")}</div>
                  </div>
                  <div className="earnings-card">
                    <div className="earnings-day">{t("completed")}</div>
                    <div className="earnings-amount">₹{deliveries.filter((d) => d.status === "delivered").reduce((sum, d) => sum + (d.totalEarnings || d.deliveryCharge || 0), 0).toLocaleString()}</div>
                    <div className="earnings-deliveries">{completedCount} {t("deliveriesLabel")}</div>
                  </div>
                  <div className="earnings-card">
                    <div className="earnings-day">{t("pending")}</div>
                    <div className="earnings-amount">₹{activeDeliveries.reduce((sum, d) => sum + (d.totalEarnings || d.deliveryCharge || 0), 0).toLocaleString()}</div>
                    <div className="earnings-deliveries">{activeDeliveries.length} {t("activeLabel")}</div>
                  </div>
                  <div className="earnings-card">
                    <div className="earnings-day">{t("rate")}</div>
                    <div className="earnings-amount">{completionRate}%</div>
                    <div className="earnings-deliveries">{t("completion")}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryDashboard;
