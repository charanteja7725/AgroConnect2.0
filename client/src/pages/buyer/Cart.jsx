import { useNavigate } from "react-router-dom";
import "./cart.css";

const Cart = () => {
  const navigate = useNavigate();

  const cartItems = [
    {
      id: 1,
      name: "Tomatoes",
      farmer: "Ravi Farms",
      price: 28,
      quantity: 2,
    },
    {
      id: 2,
      name: "Onions",
      farmer: "Green Leaf Farm",
      price: 24,
      quantity: 3,
    },
  ];

  const total = cartItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  return (
    <div className="cart-page">
      {/* Topbar */}
      <div className="cart-topbar">
        <div className="cart-brand" onClick={() => navigate("/buyer")}>
          🌱 AgroConnect
        </div>
      </div>

      <div className="cart-container">
        {/* Left - Items */}
        <div className="cart-items-section">
          <h2>Your Cart</h2>

          {cartItems.map((item) => (
            <div className="cart-item" key={item.id}>
              <div className="cart-item-left">
                <div className="item-image">🥬</div>

                <div>
                  <h4>{item.name}</h4>
                  <p className="farmer">{item.farmer}</p>
                  <p className="price">₹{item.price}/kg</p>
                </div>
              </div>

              <div className="cart-item-right">
                <div className="quantity-box">
                  <button>-</button>
                  <span>{item.quantity}</span>
                  <button>+</button>
                </div>

                <div className="item-total">
                  ₹{item.price * item.quantity}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right - Summary */}
        <div className="cart-summary">
          <h3>Order Summary</h3>

          <div className="summary-row">
            <span>Items</span>
            <span>{cartItems.length}</span>
          </div>

          <div className="summary-row">
            <span>Total Price</span>
            <span>₹{total}</span>
          </div>

          <button className="checkout-btn">
            Proceed to Checkout
          </button>

          <button
            className="back-btn"
            onClick={() => navigate("/buyer")}
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cart;