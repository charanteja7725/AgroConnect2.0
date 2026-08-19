import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deliveryAPI, orderAPI } from "../../services/api.js";
import { useAuth, useNotification } from "../../context/AppHooks.js";
import { LocationService } from "../../services/LocationService.js";
import "./deliverydetail.css";

const formatDate = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatAddress = (location) => {
  if (!location) return "Address not available";
  if (typeof location === "string") return location;
  if (typeof location.address === "string" && location.address.trim()) return location.address;
  if (Array.isArray(location.coordinates) && location.coordinates.length === 2) {
    return `GPS ${Number(location.coordinates[1]).toFixed(5)}, ${Number(location.coordinates[0]).toFixed(5)}`;
  }
  return "Address not available";
};

const DeliveryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [delivery, setDelivery] = useState(null);
  const [order, setOrder] = useState(null);
  const [updating, setUpdating] = useState(false);

  const loadDeliveryDetails = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError("");

      const response = await deliveryAPI.getDelivery(id);
      const loadedDelivery = response?.delivery;
      if (!loadedDelivery?._id) throw new Error("Delivery not found");
      setDelivery(loadedDelivery);

      if (loadedDelivery.order && typeof loadedDelivery.order === "object") {
        setOrder(loadedDelivery.order);
      } else if (loadedDelivery.order) {
        const orderResponse = await orderAPI.getOrder(loadedDelivery.order);
        setOrder(orderResponse?.order || null);
      } else {
        setOrder(null);
      }
    } catch (err) {
      setError(err.message || "Failed to load delivery details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDeliveryDetails();
  }, [loadDeliveryDetails]);

  const handleStatusUpdate = async (newStatus) => {
    try {
      setUpdating(true);
      setError("");

      let currentLocation = null;
      try {
        currentLocation = await LocationService.getCurrentLocation();
      } catch (locationError) {
        console.warn("Delivery status updated without GPS:", locationError);
      }

      const response = await deliveryAPI.updateDeliveryStatus(
        id,
        newStatus,
        currentLocation,
        `Marked ${newStatus.replace(/_/g, " ")} by delivery partner`
      );

      setDelivery(response?.delivery || ((previous) => ({ ...previous, status: newStatus })));
      addNotification?.(`Delivery marked as ${newStatus.replace(/_/g, " ")}`, "success");
      await loadDeliveryDetails();
    } catch (err) {
      const message = err.message || "Failed to update delivery status";
      setError(message);
      addNotification?.(message, "error");
    } finally {
      setUpdating(false);
    }
  };

  const statusAction = () => {
    if (!delivery) return null;

    if (["assigned", "accepted"].includes(delivery.status)) {
      return ["picked_up", "📦 Mark Picked Up"];
    }
    if (delivery.status === "picked_up") {
      return ["in_transit", "🚚 Start Delivery"];
    }
    if (delivery.status === "in_transit") {
      return ["delivered", "✅ Mark Delivered"];
    }
    if (delivery.status === "near_delivery") {
      return ["delivered", "✅ Mark Delivered"];
    }
    return null;
  };

  if (loading) {
    return <div className="delivery-detail-page"><div className="loading">Loading delivery details...</div></div>;
  }

  if (error && !delivery) {
    return (
      <div className="delivery-detail-page">
        <div className="error-container">
          <div className="error-message">{error}</div>
          <button className="retry-btn" onClick={loadDeliveryDetails}>Retry</button>
          <button className="back-btn" onClick={() => navigate("/delivery")}>Back</button>
        </div>
      </div>
    );
  }

  if (!delivery) {
    return <div className="delivery-detail-page"><div className="not-found">Delivery not found</div></div>;
  }

  const action = statusAction();
  const partnerId = delivery.deliveryPartner?._id || delivery.deliveryPartner;
  const isAssignedPartner = partnerId?.toString() === user?._id?.toString();

  return (
    <div className="delivery-detail-page">
      <div className="delivery-detail-topbar">
        <div className="delivery-detail-topbar-inner">
          <div className="delivery-detail-brand">🚚 AgroConnect</div>
          <div className="delivery-detail-title">Delivery Details</div>
          <button className="back-btn" onClick={() => navigate("/delivery")}>
            ← Back to Dashboard
          </button>
        </div>
      </div>

      <div className="delivery-detail-container">
        {error && <div className="error-message">{error}</div>}

        <div className="status-card">
          <div className="status-header">
            <div>
              <h2>Delivery #{delivery.deliveryNumber || delivery._id.slice(-8)}</h2>
              <p>Status: <strong>{String(delivery.status || "assigned").replace(/_/g, " ")}</strong></p>
            </div>

            <div className="status-actions">
              {action && isAssignedPartner && (
                <button
                  className="status-btn delivered"
                  onClick={() => handleStatusUpdate(action[0])}
                  disabled={updating}
                >
                  {updating ? "Updating..." : action[1]}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail-card">
            <h3>Delivery Information</h3>
            <div className="detail-content">
              <div className="detail-row"><span className="label">Delivery ID</span><span className="value">{delivery.deliveryNumber || delivery._id}</span></div>
              <div className="detail-row"><span className="label">Created</span><span className="value">{formatDate(delivery.createdAt)}</span></div>
              <div className="detail-row"><span className="label">Picked Up</span><span className="value">{formatDate(delivery.pickupTime)}</span></div>
              <div className="detail-row"><span className="label">Delivered</span><span className="value">{formatDate(delivery.actualDeliveryTime)}</span></div>
              <div className="detail-row"><span className="label">Delivery Payout</span><span className="value">₹{delivery.totalEarnings ?? delivery.deliveryCharge ?? 0}</span></div>
              <div className="detail-row"><span className="label">Distance</span><span className="value">{delivery.totalDistance ? `${delivery.totalDistance} km` : "Not calculated"}</span></div>
            </div>
          </div>

          <div className="detail-card">
            <h3>Pickup</h3>
            <div className="detail-content">
              <div className="detail-row"><span className="label">Seller</span><span className="value">{delivery.senderName || delivery.sender?.businessName || `${delivery.sender?.firstName || ""} ${delivery.sender?.lastName || ""}`.trim() || "Seller"}</span></div>
              <div className="detail-row"><span className="label">Phone</span><span className="value">{delivery.senderPhone || delivery.sender?.phone || "Not provided"}</span></div>
              <div className="detail-row"><span className="label">Address</span><span className="value">{formatAddress(delivery.senderLocation)}</span></div>
            </div>
          </div>

          <div className="detail-card">
            <h3>Drop-off</h3>
            <div className="detail-content">
              <div className="detail-row"><span className="label">Recipient</span><span className="value">{delivery.recipientName || `${delivery.recipient?.firstName || ""} ${delivery.recipient?.lastName || ""}`.trim() || "Buyer"}</span></div>
              <div className="detail-row"><span className="label">Phone</span><span className="value">{delivery.recipientPhone || delivery.recipient?.phone || "Not provided"}</span></div>
              <div className="detail-row"><span className="label">Address</span><span className="value">{formatAddress(delivery.recipientLocation)}</span></div>
            </div>
          </div>
        </div>

        <div className="order-card">
          <h3>Items to Deliver</h3>
          <div className="order-content">
            {(delivery.items || []).map((item, index) => (
              <div key={item._id || index} className="order-item">
                <div className="item-info">
                  <span className="item-name">{item.name || "Product"}</span>
                  <span className="item-quantity">Quantity: {item.quantity || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {order && (
          <div className="order-card">
            <h3>Order Summary</h3>
            <div className="order-content">
              <div className="order-header">
                <div className="order-info">
                  <span className="order-id">Order #{order.orderNumber || order._id?.slice(-8)}</span>
                  <span className="order-date">{formatDate(order.createdAt)}</span>
                </div>
                <div className="order-total">₹{order.totalAmount || 0}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryDetail;
