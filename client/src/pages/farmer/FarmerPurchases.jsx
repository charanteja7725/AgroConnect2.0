import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { orderAPI } from "../../services/api.js";
import { useAuth, useNotification } from "../../context/AppHooks.js";
import "./farmerdashboard.css";

const FarmerPurchases = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState("");

  const loadPurchases = useCallback(async () => {
    if (!user?._id) return;
    setLoading(true);
    setError("");

    try {
      const response = await orderAPI.getOrders();
      const purchases = (response.orders || []).filter((order) => {
        const buyerId = order.buyer?._id || order.buyer;
        return buyerId?.toString() === user._id.toString();
      });
      setOrders(purchases);
    } catch (err) {
      setError(err.message || "Unable to load fertilizer purchases");
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  const cancelOrder = async (orderId) => {
    if (!window.confirm("Cancel this purchase? Reserved stock will be returned to the seller.")) {
      return;
    }

    setCancelling(orderId);
    try {
      await orderAPI.cancelOrder(orderId, "Cancelled by farmer buyer");
      addNotification?.("Purchase cancelled", "success");
      await loadPurchases();
    } catch (err) {
      addNotification?.(err.message || "Unable to cancel purchase", "error");
    } finally {
      setCancelling("");
    }
  };

  return (
    <div className="farmer-portal-container">
      <header className="farmer-navbar">
        <div className="navbar-left">
          <div className="brand-logo" onClick={() => navigate("/farmer")}>
            <span className="brand-leaf">🌱</span>
            <span className="brand-title">AgroConnect</span>
            <span className="portal-badge">Farmer Purchases</span>
          </div>
        </div>
        <div className="navbar-right">
          <button className="navbar-btn-market" onClick={() => navigate("/fertilizer-store")}>
            🧪 Buy Fertilizers
          </button>
          <button className="navbar-btn-market" onClick={() => navigate("/buyer/cart")}>
            🛒 Cart
          </button>
          <button className="navbar-btn-add" onClick={() => navigate("/farmer")}>
            ← Farmer Dashboard
          </button>
        </div>
      </header>

      <main className="farmer-main-content" style={{ margin: "0 auto", maxWidth: 1200 }}>
        <div className="welcome-banner-card">
          <div className="banner-text">
            <h2>My Fertilizer Purchases</h2>
            <p>Track fertilizer-store orders placed from your farmer account.</p>
          </div>
        </div>

        <div className="dashboard-section-card">
          <div className="section-card-header">
            <div>
              <h3>Purchase History</h3>
              <p className="subtext">Orders where your farmer account is the buyer</p>
            </div>
            <button className="btn-primary-action" onClick={loadPurchases}>🔄 Refresh</button>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner"></div><p>Loading purchases...</p></div>
          ) : error ? (
            <div className="error-banner">{error}</div>
          ) : orders.length === 0 ? (
            <div className="empty-state-box">
              <div className="empty-icon">🧪</div>
              <h4>No Fertilizer Purchases Yet</h4>
              <p>Browse the fertilizer store to place your first order.</p>
              <button className="btn-primary-action" onClick={() => navigate("/fertilizer-store")}>
                Browse Fertilizers →
              </button>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <div className="farmer-order-card" key={order._id}>
                  <div className="order-card-header">
                    <div>
                      <span className="order-id">Order #{order.orderNumber || order._id?.substring(0, 8)}</span>
                      <span className="order-date">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN") : "Recent"}
                      </span>
                    </div>
                    <span className={`status-pill status-${order.status || "pending"}`}>
                      {order.status || "pending"}
                    </span>
                  </div>

                  <div className="order-card-body">
                    <div className="order-items-column">
                      <strong>Items</strong>
                      <ul className="items-summary-list">
                        {(order.items || []).map((item, index) => (
                          <li key={item._id || index}>
                            <span>{item.productName || "Fertilizer"}</span>
                            <span className="qty-tag">x{item.quantity}</span>
                            <span className="price-tag">₹{item.totalPrice || item.price * item.quantity || 0}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="order-info-column">
                      <p className="info-item"><strong>Total:</strong> <span className="highlight-price">₹{order.totalAmount || 0}</span></p>
                      <p className="info-item"><strong>Payment:</strong> {order.payment?.method?.replace(/_/g, " ") || "N/A"} — {order.payment?.status || "pending"}</p>
                    </div>
                  </div>

                  {["pending", "confirmed", "processing"].includes(order.status) && (
                    <div className="order-card-actions">
                      <button
                        className="btn-reject-order"
                        disabled={cancelling === order._id}
                        onClick={() => cancelOrder(order._id)}
                      >
                        {cancelling === order._id ? "Cancelling..." : "Cancel Purchase"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FarmerPurchases;
