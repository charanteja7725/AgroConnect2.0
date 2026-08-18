import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cartAPI, orderAPI } from "../../services/api.js";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useNotification } from "../../context/AppContext.jsx";
import "./cart.css";

const Cart = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState({
    fullName: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "India",
    landmark: "",
    coordinates: null,
  });
  const [deliveryLocationNote, setDeliveryLocationNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("upi");

  const fetchCart = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await cartAPI.getCart();
      setCart(data.cart);
    } catch (err) {
      setError(err.message || "Unable to load cart");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) {
        return resolve(true);
      }

      const script = document.createElement("script");
      script.id = "razorpay-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleQuantityChange = async (item, delta) => {
    const nextQuantity = item.quantity + delta;
    if (nextQuantity < 1) return;
    try {
      await cartAPI.updateCartItem(item._id, nextQuantity);
      addNotification("Cart updated", "success");
      fetchCart();
    } catch (err) {
      addNotification(err.message || "Unable to update quantity", "error");
    }
  };

  const handleRemove = async (item) => {
    try {
      await cartAPI.removeFromCart(item._id);
      addNotification("Item removed from cart", "success");
      fetchCart();
    } catch (err) {
      addNotification(err.message || "Unable to remove item", "error");
    }
  };

  const handleUseCurrentLocation = async () => {
    setCheckoutError("");
    setDeliveryLocationNote("");
    try {
      const coords = await LocationService.getCurrentLocation();
      const addressData = await LocationService.reverseGeocode(coords.latitude, coords.longitude);
      const newAddress = {
        ...deliveryAddress,
        street: addressData?.road || addressData?.suburb || deliveryAddress.street,
        city: addressData?.city || addressData?.town || addressData?.village || deliveryAddress.city,
        state: addressData?.state || deliveryAddress.state,
        zipCode: addressData?.postcode || deliveryAddress.zipCode,
        country: addressData?.country || deliveryAddress.country,
        coordinates: {
          type: "Point",
          coordinates: [coords.longitude, coords.latitude],
        },
      };

      setDeliveryAddress(newAddress);
      setDeliveryLocationNote(`Current location captured at ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
    } catch (err) {
      setCheckoutError(err.message || "Unable to fetch current location");
    }
  };

  const openRazorpayCheckout = async (paymentData, order) => {
    const options = {
      key: paymentData.razorpayKey,
      amount: paymentData.amount,
      currency: paymentData.currency,
      name: "AgroConnect",
      description: `Payment for order ${order.orderNumber || order._id}`,
      order_id: paymentData.razorpayOrderId,
      handler: async (response) => {
        try {
          await paymentAPI.confirmPayment(paymentData.paymentId, order._id, {
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            razorpaySignature: response.razorpay_signature,
          });

          setCheckoutSuccess("Payment completed successfully. Redirecting...");
          addNotification("Payment successful", "success");
          setTimeout(() => navigate("/buyer"), 1400);
        } catch (err) {
          setCheckoutError(err.message || "Payment confirmation failed");
          addNotification(err.message || "Payment confirmation failed", "error");
        }
      },
      prefill: {
        name: deliveryAddress.fullName || `${user?.firstName || ""} ${user?.lastName || ""}`,
        email: user?.email || "",
        contact: deliveryAddress.phone || user?.phone || "",
      },
      theme: {
        color: "#009933",
      },
      modal: {
        ondismiss: () => {
          setCheckoutError("Payment was cancelled. You can try again.");
        },
      },
    };

    const razorpayInstance = new window.Razorpay(options);
    razorpayInstance.open();
  };

  const handleCheckout = async () => {
    setCheckoutError("");
    setCheckoutSuccess("");

    if (!deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.zipCode) {
      setCheckoutError("Please fill in your delivery address before checkout.");
      return;
    }

    if (!cart?.items?.length) {
      setCheckoutError("Your cart is empty.");
      return;
    }

    try {
      setLoading(true);
      const orderResponse = await orderAPI.createOrder({ deliveryAddress, paymentMethod });
      const order = orderResponse.order;

      if (!order || !order._id || order.totalAmount == null) {
        throw new Error("Invalid order response. Please try again.");
      }

      const paymentResponse = await paymentAPI.createPaymentIntent(order._id, Number(order.totalAmount));

      if (!paymentResponse || !paymentResponse.razorpayOrderId) {
        throw new Error(paymentResponse?.error || "Invalid Razorpay response");
      }

      if (paymentResponse.razorpayOrderId.startsWith("order_mock_")) {
        // Automatically confirm payment for simulated checkout!
        addNotification("Simulating checkout payment...", "info");
        await paymentAPI.confirmPayment(paymentResponse.paymentId, order._id, {
          razorpayPaymentId: `pay_mock_${Math.random().toString(36).substring(7)}`,
          razorpayOrderId: paymentResponse.razorpayOrderId,
          razorpaySignature: "mock_signature_bypass",
        });
        
        setCheckoutSuccess("Mock payment completed successfully! Redirecting...");
        addNotification("Payment successful (Simulated)", "success");
        setTimeout(() => navigate("/buyer"), 1400);
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        throw new Error("Razorpay Checkout could not be loaded. Please refresh the page.");
      }

      openRazorpayCheckout(paymentResponse, order);
    } catch (err) {
      const message = err.message || err || "Unable to complete checkout";
      setCheckoutError(message);
      addNotification(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const total = cart?.totalPrice || 0;
  const tax = Math.round(total * 0.05);
  const totalAmount = total + tax;

  return (
    <div className="cart-page">
      <div className="cart-topbar">
        <div className="cart-brand" onClick={() => navigate("/buyer")}>🌱 {t("appName")}</div>
      </div>

      <div className="cart-container">
        <div className="cart-items-section">
          <h2>{t("cartTitle")}</h2>
          {loading ? (
            <p>{t("loadingCart")}</p>
          ) : error ? (
            <p className="error-state">{error}</p>
          ) : cart?.items?.length ? (
            cart.items.map((item) => (
              <div className="cart-item" key={item._id}>
                <div className="cart-item-left">
                  <div className="item-image">🥬</div>
                  <div>
                    <h4>{item.product?.name || item.productName}</h4>
                    <p className="farmer">{item.seller?.firstName || item.sellerName || "Seller"}</p>
                    <p className="price">₹{item.price}/kg</p>
                  </div>
                </div>

                <div className="cart-item-right">
                  <div className="quantity-box">
                    <button onClick={() => handleQuantityChange(item, -1)}>-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => handleQuantityChange(item, 1)}>+</button>
                  </div>

                  <div className="item-total">₹{item.totalPrice}</div>
                  <button className="remove-btn" onClick={() => handleRemove(item)}>
                    Remove
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-cart">
              <p>{t("cartEmpty")}</p>
              <button onClick={() => navigate("/buyer")}>{t("continueShoppingBtn")}</button>
            </div>
          )}
        </div>

        <div className="cart-summary">
          <h3>{t("orderSummary")}</h3>
          <div className="summary-row">
            <span>{t("items")}</span>
            <span>{cart?.items?.length || 0}</span>
          </div>
          <div className="summary-row">
            <span>{t("subtotal")}</span>
            <span>₹{total}</span>
          </div>
          <div className="summary-row">
            <span>{t("tax")}</span>
            <span>₹{tax}</span>
          </div>
          <div className="summary-row total-row">
            <span>{t("total")}</span>
            <span>₹{totalAmount}</span>
          </div>

          <div className="checkout-section">
            <h4>{t("deliveryAddress")}</h4>
            <input
              type="text"
              placeholder={t("fullName")}
              value={deliveryAddress.fullName}
              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, fullName: e.target.value })}
            />
            <input
              type="text"
              placeholder={t("phoneLabel")}
              value={deliveryAddress.phone}
              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, phone: e.target.value })}
            />
            <input
              type="text"
              placeholder={t("streetLabel")}
              value={deliveryAddress.street}
              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, street: e.target.value })}
            />
            <input
              type="text"
              placeholder={t("cityLabel")}
              value={deliveryAddress.city}
              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, city: e.target.value })}
            />
            <input
              type="text"
              placeholder={t("stateLabel")}
              value={deliveryAddress.state}
              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, state: e.target.value })}
            />
            <input
              type="text"
              placeholder={t("zipCodeLabel")}
              value={deliveryAddress.zipCode}
              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, zipCode: e.target.value })}
            />
            <input
              type="text"
              placeholder={t("landmarkLabel")}
              value={deliveryAddress.landmark}
              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, landmark: e.target.value })}
            />
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="upi">UPI</option>
              <option value="credit_card">Credit Card</option>
              <option value="debit_card">Debit Card</option>
              <option value="wallet">Wallet</option>
            </select>

            {checkoutError && <p className="error-state">{checkoutError}</p>}
            {checkoutSuccess && <p className="success-state">{checkoutSuccess}</p>}

            <button className="checkout-btn" onClick={handleCheckout} disabled={!cart?.items?.length || loading}>
              {loading ? t("processing") : t("checkoutBtn")}
            </button>
            <button className="back-btn" onClick={() => navigate("/buyer")}>{t("continueShoppingBtn")}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
