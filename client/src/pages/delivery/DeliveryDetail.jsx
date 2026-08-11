import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { deliveryAPI, orderAPI } from "../../services/api.js";
import "./deliverydetail.css";

const DeliveryDetail = () => {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [delivery, setDelivery] = useState(null);
  const [order, setOrder] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadDeliveryDetails();
  }, [id]);

  const loadDeliveryDetails = async () => {
    try {
      setLoading(true);
      setError("");

      // Load delivery details
      const deliveryData = await deliveryAPI.getDelivery(id);
      setDelivery(deliveryData);

      // Load associated order details
      if (deliveryData.orderId) {
        const orderData = await orderAPI.getOrderById(deliveryData.orderId);
        setOrder(orderData);
      }
    } catch (err) {
      setError(err.message || "Failed to load delivery details");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      setUpdating(true);
      await deliveryAPI.updateDeliveryStatus(id, newStatus);
      setDelivery((prev) => ({ ...prev, status: newStatus }));
    } catch (err) {
      setError(err.message || "Failed to update delivery status");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "assigned":
        return "status-assigned";
      case "picked_up":
        return "status-picked";
      case "in_transit":
        return "status-transit";
      case "delivered":
        return "status-delivered";
      case "cancelled":
        return "status-cancelled";
      default:
        return "status-pending";
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="delivery-detail-page">
        <div className="loading">{t("downloading")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="delivery-detail-page">
        <div className="error-container">
          <div className="error-message">{error}</div>
          <button className="retry-btn" onClick={loadDeliveryDetails}>
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="delivery-detail-page">
        <div className="not-found">{t("deliveryNotFound")}</div>
      </div>
    );
  }

  return (
    <div className="delivery-detail-page">
      {/* Topbar */}
      <div className="delivery-detail-topbar">
        <div className="delivery-detail-topbar-inner">
          <div className="delivery-detail-brand">🚚 AgroConnect</div>
          <div className="delivery-detail-title">{t("deliveryDetails")}</div>
          <button className="back-btn" onClick={() => navigate("/delivery")}> 
            ← {t("backToDashboard")}
          </button>
        </div>
      </div>

      <div className="delivery-detail-container">
        {/* Delivery Status Card */}
        <div className="status-card">
          <div className="status-header">
              <h2>{t("deliveryDetails")} #{delivery._id.slice(-8)}</h2>

            <div className="status-actions">
              {delivery.status === "assigned" && (
                <button
                  className="status-btn picked-up"
                  onClick={() => handleStatusUpdate("picked_up")}
                  disabled={updating}
                >
                  {updating ? t("updating") : t("markPickedUp")}
                </button>
              )}
              {delivery.status === "picked_up" && (
                <button
                  className="status-btn transit"
                  onClick={() => handleStatusUpdate("in_transit")}
                  disabled={updating}
                >
                  {updating ? t("updating") : t("startDelivery")}
                </button>
              )}
              {delivery.status === "in_transit" && (
                <button
                  className="status-btn delivered"
                  onClick={() => handleStatusUpdate("delivered")}
                  disabled={updating}
                >
                  {updating ? t("updating") : t("markDelivered")}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="detail-grid">
          {/* Delivery Information */}
          <div className="detail-card">
            <h3>{t("deliveryInformation")}</h3>
            <div className="detail-content">
              <div className="detail-row">
                <span className="label">{t("deliveryIdLabel")}</span>
                <span className="value">{delivery._id}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("assignedDate")}</span>
                <span className="value">{formatDate(delivery.assignedAt)}</span>
              </div>
              {delivery.pickedUpAt && (
                <div className="detail-row">
                  <span className="label">{t("pickedUp")}</span>
                  <span className="value">{formatDate(delivery.pickedUpAt)}</span>
                </div>
              )}
              {delivery.deliveredAt && (
                <div className="detail-row">
                  <span className="label">{t("delivered")}</span>
                  <span className="value">{formatDate(delivery.deliveredAt)}</span>
                </div>
              )}
              <div className="detail-row">
                <span className="label">{t("deliveryFee")}</span>
                <span className="value">₹{delivery.deliveryFee}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("distance")}</span>
                <span className="value">{delivery.distance} km</span>
              </div>
            </div>
          </div>

          {/* Pickup Location */}
          <div className="detail-card">
            <h3>{t("pickupLocation")}</h3>
            <div className="detail-content">
              <div className="detail-row">
                <span className="label">{t("addressLabel")}</span>
                <span className="value">{delivery.pickupAddress}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("farmerLabel")}</span>
                <span className="value">{delivery.farmerName}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("contactLabel")}</span>
                <span className="value">{delivery.farmerPhone}</span>
              </div>
            </div>
          </div>

          {/* Delivery Location */}
          <div className="detail-card">
            <h3>{t("deliveryLocation")}</h3>
            <div className="detail-content">
              <div className="detail-row">
                <span className="label">{t("addressLabel")}</span>
                <span className="value">{delivery.deliveryAddress}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("buyer")}</span>
                <span className="value">{delivery.buyerName}</span>
              </div>
              <div className="detail-row">
                <span className="label">{t("contact")}</span>
                <span className="value">{delivery.buyerPhone}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Details */}
        {order && (
          <div className="order-card">
            <h3>{t("orderDetails")}</h3>
            <div className="order-content">
              <div className="order-header">
                <div className="order-info">
                  <span className="order-id">Order #{order._id.slice(-8)}</span>
                  <span className="order-date">{formatDate(order.createdAt)}</span>
                </div>
                <div className="order-total">₹{order.totalAmount}</div>
              </div>

              <div className="order-items">
                {order.items.map((item, index) => (
                  <div key={index} className="order-item">
                    <div className="item-info">
                      <span className="item-name">{item.productName}</span>
                      <span className="item-quantity">
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                    <div className="item-price">₹{item.price * item.quantity}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryDetail;