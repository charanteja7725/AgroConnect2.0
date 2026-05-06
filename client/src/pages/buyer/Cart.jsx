import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cartAPI, orderAPI } from "../../services/api.js";
import { useNotification } from "../../context/AppContext.jsx";
import "./cart.css";

const Cart = () => {
  const navigate = useNavigate();
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
  });
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

  const handleCheckout = async () => {
    setCheckoutError("");
    setCheckoutSuccess("");

    if (!deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.zipCode) {
      setCheckoutError("Please fill in your delivery address before checkout.");
      return;
    }

    try {
      await orderAPI.createOrder({ deliveryAddress, paymentMethod });
      setCheckoutSuccess("Order created successfully. Redirecting to dashboard...");
      addNotification("Order placed successfully", "success");
      setTimeout(() => navigate("/buyer"), 1500);
    } catch (err) {
      setCheckoutError(err.message || "Unable to complete checkout");
      addNotification(err.message || "Checkout failed", "error");
    }
  };

  const total = cart?.totalPrice || 0;
  const tax = Math.round(total * 0.05);
  const totalAmount = total + tax;

  return (
    <div className="cart-page">
      <div className="cart-topbar">
        <div className="cart-brand" onClick={() => navigate("/buyer")}>🌱 AgroConnect</div>
      </div>

      <div className="cart-container">
        <div className="cart-items-section">
          <h2>Your Cart</h2>
          {loading ? (
            <p>Loading cart...</p>
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
              <p>Your cart is empty.</p>
              <button onClick={() => navigate("/buyer")}>Continue Shopping</button>
            </div>
          )}
        </div>

        <div className="cart-summary">
          <h3>Order Summary</h3>
          <div className="summary-row">
            <span>Items</span>
            <span>{cart?.items?.length || 0}</span>
          </div>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>₹{total}</span>
          </div>
          <div className="summary-row">
            <span>Tax (5%)</span>
            <span>₹{tax}</span>
          </div>
          <div className="summary-row total-row">
            <span>Total</span>
            <span>₹{totalAmount}</span>
          </div>

          <div className="checkout-section">
            <h4>Delivery Address</h4>
            <input
              type="text"
              placeholder="Full Name"
              value={deliveryAddress.fullName}
              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, fullName: e.target.value })}
            />
            <input
              type="text"
              placeholder="Phone"
              value={deliveryAddress.phone}
              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, phone: e.target.value })}
            />
            <input
              type="text"
              placeholder="Street"
              value={deliveryAddress.street}
              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, street: e.target.value })}
            />
            <input
              type="text"
              placeholder="City"
              value={deliveryAddress.city}
              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, city: e.target.value })}
            />
            <input
              type="text"
              placeholder="State"
              value={deliveryAddress.state}
              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, state: e.target.value })}
            />
            <input
              type="text"
              placeholder="Zip Code"
              value={deliveryAddress.zipCode}
              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, zipCode: e.target.value })}
            />
            <input
              type="text"
              placeholder="Landmark"
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
              {loading ? "Processing..." : "Proceed to Checkout"}
            </button>
            <button className="back-btn" onClick={() => navigate("/buyer")}>Continue Shopping</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
