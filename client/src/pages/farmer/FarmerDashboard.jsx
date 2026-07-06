import { useState, useEffect, useCallback } from "react";
import "./farmerdashboard.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppHooks.js";
import { productAPI, orderAPI, pricingAPI } from "../../services/api";

const FarmerDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Dashboard data
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalEarnings: 0,
    pendingOrders: 0,
  });

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [priceEstimates, setPriceEstimates] = useState({});

  const fetchFarmerProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await productAPI.getSellerProducts(user._id);
      setProducts(response.products || []);
      setStats((prev) => ({
        ...prev,
        totalProducts: response.products?.length || 0,
      }));
    } catch (err) {
      console.error("Error fetching products:", err);
      setError("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [user._id]);

  const fetchFarmerOrders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await orderAPI.getOrders();
      const farmerOrders =
        response.orders?.filter((order) =>
          order.items?.some((item) => item.seller?.toString() === user._id)
        ) || [];
      setOrders(farmerOrders);
      setStats((prev) => ({
        ...prev,
        totalOrders: farmerOrders.length,
        pendingOrders: farmerOrders.filter((o) => o.status === "pending").length,
      }));
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [user._id]);

  // Fetch farmer's products
  useEffect(() => {
    if (activeSection === "my-products" || activeSection === "dashboard") {
      fetchFarmerProducts();
    }
  }, [activeSection, fetchFarmerProducts]);

  // Fetch farmer's orders
  useEffect(() => {
    if (activeSection === "orders") {
      fetchFarmerOrders();
    }
  }, [activeSection, fetchFarmerOrders]);

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;

    try {
      await productAPI.deleteProduct(productId);
      setProducts(products.filter(p => p._id !== productId));
      alert("Product deleted successfully");
    } catch (err) {
      console.error("Error deleting product:", err);
      setError("Failed to delete product");
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await orderAPI.updateOrderStatus(orderId, newStatus, "");
      setOrders(orders.map((o) =>
        o._id === orderId ? { ...o, status: newStatus } : o
      ));
      alert(`Order ${newStatus}`);
    } catch (err) {
      console.error("Error updating order status:", err);
      setError("Failed to update order status");
    }
  };

  const handleGetPriceSuggestion = async (product) => {
    try {
      const response = await pricingAPI.suggestPrice(
        product.type,
        product.category,
        product.quantity,
        product.price
      );
      setPriceEstimates({
        ...priceEstimates,
        [product._id]: response.suggestedPrice || product.price,
      });
    } catch (err) {
      console.error("Error getting price suggestion:", err);
    }
  };

  const sectionTitle = {
    dashboard: "Welcome back, Farmer 👋",
    "my-products": "My Products",
    orders: "Your Orders",
    profile: "Your Profile",
  };

  const sectionDescription = {
    dashboard: "Manage your products, monitor orders, and track earnings.",
    "my-products": "Review your product listings and keep inventory up to date.",
    orders: "Track recent orders and confirm/reject deliveries.",
    profile: "Update your profile details and contact information.",
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case "my-products":
        return (
          <div className="dashboard-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3>My Products</h3>
              <button
                className="section-action"
                onClick={() => navigate("/farmer/add-product")}
              >
                + Add New Product
              </button>
            </div>

            {loading ? (
              <p>Loading products...</p>
            ) : products.length === 0 ? (
              <p className="placeholder-text">No products listed yet. Start by adding a new product!</p>
            ) : (
              <div className="products-grid">
                {products.map(product => (
                  <div key={product._id} className="product-card">
                    <div className="product-image">
                      {product.images?.[0]?.url ? (
                        <img src={product.images[0].url} alt={product.name} />
                      ) : (
                        <div className="no-image">No Image</div>
                      )}
                    </div>
                    <h4>{product.name}</h4>
                    <p>₹{product.price} / {product.unit}</p>
                    <p className="stock">Stock: {product.quantity} {product.unit}</p>
                    <div className="product-actions">
                      <button
                        className="btn-small"
                        onClick={() => handleGetPriceSuggestion(product)}
                      >
                        💡 AI Price
                      </button>
                      {priceEstimates[product._id] && (
                        <p className="price-estimate">
                          Suggested: ₹{priceEstimates[product._id]}
                        </p>
                      )}
                      <button
                        className="btn-edit"
                        onClick={() => navigate(`/farmer/edit-product/${product._id}`)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteProduct(product._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "orders":
        return (
          <div className="dashboard-section">
            <h3>Incoming Orders</h3>
            {loading ? (
              <p>Loading orders...</p>
            ) : orders.length === 0 ? (
              <p className="placeholder-text">No orders yet</p>
            ) : (
              <div className="orders-table">
                {orders.map(order => (
                  <div key={order._id} className="order-card">
                    <div className="order-header">
                      <h4>Order #{order._id.substring(0, 8)}</h4>
                      <span className={`status status-${order.status}`}>{order.status}</span>
                    </div>
                    <p>Buyer: {order.buyer?.firstName} {order.buyer?.lastName}</p>
                    <p>Total Amount: ₹{order.totalAmount}</p>
                    <p>Delivery Address: {order.deliveryAddress}</p>
                    <div className="items-list">
                      {order.items?.map((item, idx) => (
                        <p key={idx}>
                          • {item.productName} x{item.quantity} = ₹{item.totalPrice}
                        </p>
                      ))}
                    </div>
                    {order.status === "pending" && (
                      <div className="order-actions">
                        <button
                          className="btn-confirm"
                          onClick={() => handleUpdateOrderStatus(order._id, "confirmed")}
                        >
                          Confirm Order
                        </button>
                        <button
                          className="btn-reject"
                          onClick={() => handleUpdateOrderStatus(order._id, "cancelled")}
                        >
                          Reject Order
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "profile":
        return (
          <div className="dashboard-section">
            <h3>Your Profile</h3>
            {user && (
              <div className="profile-card">
                <p><strong>Name:</strong> {user.firstName} {user.lastName}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Phone:</strong> {user.phone}</p>
                <p><strong>Role:</strong> {user.role}</p>
                <p><strong>Total Earnings:</strong> ₹{user.totalEarnings || 0}</p>
                <p><strong>Total Orders:</strong> {user.totalOrders || 0}</p>
                <button
                  className="section-action"
                  onClick={() => navigate("/profile")}
                >
                  Edit Profile
                </button>
              </div>
            )}
          </div>
        );

      default:
        return (
          <>
            <div className="summary-grid">
              <div className="summary-card">
                <h4>Total Products</h4>
                <p className="big-number">{stats.totalProducts}</p>
              </div>
              <div className="summary-card">
                <h4>Orders Received</h4>
                <p className="big-number">{stats.totalOrders}</p>
              </div>
              <div className="summary-card">
                <h4>Total Earnings</h4>
                <p className="big-number">₹{user?.totalEarnings || 0}</p>
              </div>
              <div className="summary-card">
                <h4>Pending Orders</h4>
                <p className="big-number">{stats.pendingOrders}</p>
              </div>
            </div>

            <div className="dashboard-section">
              <h3>Quick Actions</h3>
              <div className="action-grid">
                <div className="action-card">
                  <h4>Add New Product</h4>
                  <p>List fresh produce with AI price suggestion</p>
                  <button onClick={() => navigate("/farmer/add-product")}>
                    Add Product
                  </button>
                </div>
                <div className="action-card">
                  <h4>View Orders</h4>
                  <p>Track customer orders and confirmations</p>
                  <button onClick={() => setActiveSection("orders")}>
                    Check Orders
                  </button>
                </div>
                <div className="action-card">
                  <h4>Buy Fertilizers</h4>
                  <p>Browse fertilizers from nearby sellers</p>
                  <button onClick={() => navigate("/fertilizer")}>
                    Open Market
                  </button>
                </div>
              </div>
            </div>

            {products.length > 0 && (
              <div className="dashboard-section">
                <h3>Recent Products</h3>
                <div className="product-table">
                  <div className="product-row header">
                    <span>Product</span>
                    <span>Quantity</span>
                    <span>Price</span>
                    <span>Status</span>
                  </div>
                  {products.slice(0, 5).map(product => (
                    <div key={product._id} className="product-row">
                      <span>{product.name}</span>
                      <span>{product.quantity} {product.unit}</span>
                      <span>₹{product.price}</span>
                      <span className={`status ${product.isActive ? "active-status" : "inactive-status"}`}>
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );
    }
  };

  return (
    <div className="farmer-dashboard-page">
      {/* Topbar */}
      <div className="farmer-topbar">
        <div className="farmer-brand">🌱 AgroConnect</div>
        <div className="farmer-topbar-right">
          <button className="lang-btn">English ▼</button>
          <button
            className="logout-btn"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Logout
          </button>
          <div className="profile-circle">{user?.firstName?.[0]}</div>
        </div>
      </div>

      <div className="farmer-layout">
        {/* Sidebar */}
        <div className="farmer-sidebar">
          <h3 className="sidebar-title">Farmer Panel</h3>
          <div
            className={`sidebar-item ${activeSection === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveSection("dashboard")}
          >
            Dashboard
          </div>
          <div
            className={`sidebar-item ${activeSection === "my-products" ? "active" : ""}`}
            onClick={() => setActiveSection("my-products")}
          >
            My Products
          </div>
          <div
            className={`sidebar-item ${activeSection === "orders" ? "active" : ""}`}
            onClick={() => setActiveSection("orders")}
          >
            Orders
          </div>
          <div className="sidebar-item" onClick={() => navigate("/buyer")}>
            Buy Fertilizers
          </div>
          <div
            className={`sidebar-item ${activeSection === "profile" ? "active" : ""}`}
            onClick={() => setActiveSection("profile")}
          >
            Profile
          </div>
        </div>

        {/* Main Content */}
        <div className="farmer-main">
          {error && <div className="error-message">{error}</div>}
          <div className="welcome-card">
            <h2>{sectionTitle[activeSection]}</h2>
            <p>{sectionDescription[activeSection]}</p>
          </div>
          {renderSectionContent()}
        </div>
      </div>
    </div>
  );
};

export default FarmerDashboard;