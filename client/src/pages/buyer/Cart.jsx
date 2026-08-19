import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cartAPI, orderAPI, paymentAPI } from "../../services/api.js";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { useAuth, useNotification } from "../../context/AppHooks.js";
import LocationService from "../../services/LocationService.js";
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
  const [deliveryLocationNote, setDeliveryLocationNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("upi");
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

  const homePath = user?.role === "farmer" ? "/farmer" : "/buyer";
  const shoppingPath = user?.role === "farmer" ? "/fertilizer-store" : "/buyer";
  const ordersPath = user?.role === "farmer" ? "/farmer/purchases" : "/buyer";

  useEffect(() => {
    if (!user) return;
    setDeliveryAddress((previous) => ({
      ...previous,
      fullName:
        previous.fullName || [user.firstName, user.lastName].filter(Boolean).join(" "),
      phone: previous.phone || user.phone || "",
      street: previous.street || user.address?.street || "",
      city: previous.city || user.address?.city || "",
      state: previous.state || user.address?.state || "",
      zipCode: previous.zipCode || user.address?.zipCode || "",
      country: previous.country || user.address?.country || "India",
    }));
  }, [user]);

  const fetchCart = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);

      const existing = document.getElementById("razorpay-script");
      if (existing) {
        existing.addEventListener("load", () => resolve(true), { once: true });
        existing.addEventListener("error", () => resolve(false), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = "razorpay-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleQuantityChange = async (item, delta) => {
    const nextQuantity = Number(item.quantity) + delta;
    if (nextQuantity < 1) return;

    try {
      await cartAPI.updateCartItem(item._id, nextQuantity);
      addNotification?.("Cart updated", "success");
      await fetchCart();
    } catch (err) {
      addNotification?.(err.message || "Unable to update quantity", "error");
    }
  };

  const handleRemove = async (item) => {
    try {
      await cartAPI.removeFromCart(item._id);
      addNotification?.("Item removed from cart", "success");
      await fetchCart();
    } catch (err) {
      addNotification?.(err.message || "Unable to remove item", "error");
    }
  };

  const handleUseCurrentLocation = async () => {
    setCheckoutError("");
    setDeliveryLocationNote("");

    try {
      const coords = await LocationService.getCurrentLocation();
      const addressData = await LocationService.reverseGeocode(
        coords.latitude,
        coords.longitude
      );

      setDeliveryAddress((previous) => ({
        ...previous,
        street: addressData?.road || addressData?.suburb || previous.street,
        city:
          addressData?.city ||
          addressData?.town ||
          addressData?.village ||
          previous.city,
        state: addressData?.state || previous.state,
        zipCode: addressData?.postcode || previous.zipCode,
        country: addressData?.country || previous.country || "India",
        coordinates: {
          type: "Point",
          coordinates: [Number(coords.longitude), Number(coords.latitude)],
        },
      }));

      setDeliveryLocationNote(
        `Current location captured at ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
      );
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

          setCheckoutSuccess("Payment completed successfully. Redirecting to your orders...");
          addNotification?.("Payment successful", "success");
          setTimeout(() => navigate(ordersPath), 1200);
        } catch (err) {
          setCheckoutError(err.message || "Payment confirmation failed");
          addNotification?.(err.message || "Payment confirmation failed", "error");
        }
      },
      prefill: {
        name:
          deliveryAddress.fullName ||
          `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
        email: user?.email || "",
        contact: deliveryAddress.phone || user?.phone || "",
      },
      theme: { color: "#009933" },
      modal: {
        ondismiss: () => {
          setCheckoutError(
            "Payment was cancelled. The order remains pending; you can review or cancel it from your orders."
          );
        },
      },
    };

    new window.Razorpay(options).open();
  };

  const handleCheckout = async () => {
    setCheckoutError("");
    setCheckoutSuccess("");

    const requiredFields = [
      deliveryAddress.fullName,
      deliveryAddress.phone,
      deliveryAddress.street,
      deliveryAddress.city,
      deliveryAddress.state,
      deliveryAddress.zipCode,
    ];

    if (requiredFields.some((value) => !String(value || "").trim())) {
      setCheckoutError("Please fill in the complete delivery address before checkout.");
      return;
    }

    if (!cart?.items?.length) {
      setCheckoutError("Your cart is empty.");
      return;
    }

    setLoading(true);

    try {
      const orderResponse = await orderAPI.createOrder({
        deliveryAddress,
        paymentMethod,
      });
      const order = orderResponse.order;

      if (!order?._id || order.totalAmount == null) {
        throw new Error("Invalid order response. Please try again.");
      }

      if (paymentMethod === "cash_on_delivery") {
        setCheckoutSuccess("Order placed successfully with cash on delivery.");
        addNotification?.("Order placed successfully", "success");
        setTimeout(() => navigate(ordersPath), 1000);
        return;
      }

      const paymentResponse = await paymentAPI.createPaymentIntent(
        order._id,
        Number(order.totalAmount)
      );

      if (!paymentResponse?.razorpayOrderId) {
        throw new Error("Payment provider did not return a valid payment order");
      }

      if (paymentResponse.razorpayOrderId.startsWith("order_mock_")) {
        await paymentAPI.confirmPayment(paymentResponse.paymentId, order._id, {
          razorpayPaymentId: `pay_mock_${Math.random().toString(36).slice(2)}`,
          razorpayOrderId: paymentResponse.razorpayOrderId,
          razorpaySignature: "development_mock",
        });
        setCheckoutSuccess("Development payment completed. Redirecting...");
        addNotification?.("Development payment completed", "success");
        setTimeout(() => navigate(ordersPath), 1000);
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        throw new Error(
          "Razorpay Checkout could not be loaded. The order is pending and can be cancelled from your orders."
        );
      }

      await openRazorpayCheckout(paymentResponse, order);
    } catch (err) {
      const message = err?.message || "Unable to complete checkout";
      setCheckoutError(message);
      addNotification?.(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const total = Number(cart?.totalPrice) || 0;
  const tax = Math.round(total * 0.05);
  const totalAmount = total + tax;

  return (
    <div className="cart-page">
      <div className="cart-topbar">
        <div className="cart-brand" onClick={() => navigate(homePath)}>
          🌱 {t("appName")}
        </div>
      </div>

      <div className="cart-container">
        <div className="cart-items-section">
          <h2>{t("cartTitle")}</h2>

          {loading && !cart ? (
            <p>{t("loadingCart")}</p>
          ) : error ? (
            <p className="error-state">{error}</p>
          ) : cart?.items?.length ? (
            cart.items.map((item) => (
              <div className="cart-item" key={item._id}>
                <div className="cart-item-left">
                  <div className="item-image">
                    {item.product?.images?.[0]?.url ? (
                      <img src={item.product.images[0].url} alt={item.product?.name || "Product"} />
                    ) : (
                      "🥬"
                    )}
                  </div>
                  <div>
                    <h4>{item.product?.name || item.productName || "Product"}</h4>
                    <p className="farmer">
                      {item.seller?.businessName || item.seller?.firstName || item.sellerName || "Seller"}
                    </p>
                    <p className="price">
                      ₹{item.price}/{item.product?.unit || "unit"}
                    </p>
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
              <button onClick={() => navigate(shoppingPath)}>{t("continueShoppingBtn")}</button>
            </div>
          )}
        </div>

        <div className="cart-summary">
          <h3>{t("orderSummary")}</h3>
          <div className="summary-row"><span>{t("items")}</span><span>{cart?.items?.length || 0}</span></div>
          <div className="summary-row"><span>{t("subtotal")}</span><span>₹{total}</span></div>
          <div className="summary-row"><span>{t("tax")}</span><span>₹{tax}</span></div>
          <div className="summary-row total-row"><span>{t("total")}</span><span>₹{totalAmount}</span></div>

          <div className="checkout-section">
            <h4>{t("deliveryAddress")}</h4>

            {[
              ["fullName", t("fullName")],
              ["phone", t("phoneLabel")],
              ["street", t("streetLabel")],
              ["city", t("cityLabel")],
              ["state", t("stateLabel")],
              ["zipCode", t("zipCodeLabel")],
              ["landmark", t("landmarkLabel")],
            ].map(([field, placeholder]) => (
              <input
                key={field}
                type="text"
                placeholder={placeholder}
                value={deliveryAddress[field] || ""}
                onChange={(event) =>
                  setDeliveryAddress((previous) => ({
                    ...previous,
                    [field]: event.target.value,
                  }))
                }
              />
            ))}

            <button type="button" className="back-btn" onClick={handleUseCurrentLocation}>
              📍 Use Current Location
            </button>
            {deliveryLocationNote && <p className="success-state">{deliveryLocationNote}</p>}

            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              <option value="upi">UPI / Razorpay</option>
              <option value="credit_card">Credit Card / Razorpay</option>
              <option value="debit_card">Debit Card / Razorpay</option>
              <option value="wallet">Wallet / Razorpay</option>
              <option value="cash_on_delivery">Cash on Delivery</option>
            </select>

            {checkoutError && <p className="error-state">{checkoutError}</p>}
            {checkoutSuccess && <p className="success-state">{checkoutSuccess}</p>}

            <button
              className="checkout-btn"
              onClick={handleCheckout}
              disabled={!cart?.items?.length || loading}
            >
              {loading ? t("processing") : t("checkoutBtn")}
            </button>
            <button className="back-btn" onClick={() => navigate(shoppingPath)}>
              {t("continueShoppingBtn")}
            </button>
            <button className="back-btn" onClick={() => navigate(ordersPath)}>
              View My Orders
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
