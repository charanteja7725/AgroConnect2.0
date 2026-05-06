import { useState } from "react";
import "./farmerdashboard.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppContext.jsx";
const FarmerDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [activeSection, setActiveSection] = useState("dashboard");

  const sectionTitle = {
    dashboard: "Welcome back, Farmer 👋",
    "my-products": "My Products",
    orders: "Your Orders",
    "price-suggestions": "Price Suggestions",
    payments: "Payments",
    profile: "Your Profile",
  };

  const sectionDescription = {
    dashboard: "Manage your products, monitor orders, and buy fertilizers from trusted local sellers.",
    "my-products": "Review your product listings and keep inventory up to date.",
    orders: "Track recent orders and follow up on pending deliveries.",
    "price-suggestions": "Use AI-powered price tips to stay competitive in the market.",
    payments: "Review and manage your payout history and transaction status.",
    profile: "Update your profile details and contact information.",
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case "my-products":
        return (
          <div className="dashboard-section">
            <h3>My Products</h3>
            <p className="placeholder-text">
              You can add new products, update pricing, and manage stock from the Add Product page.
            </p>
            <button className="section-action" onClick={() => navigate("/farmer/add-product")}>Add New Product</button>
          </div>
        );
      case "orders":
        return (
          <div className="dashboard-section">
            <h3>Orders</h3>
            <p className="placeholder-text">
              Here you will see a list of your recent customer orders. Monitor delivery status and order updates.
            </p>
            <div className="order-summary-card">
              <p>Pending Orders: 3</p>
              <p>Completed Orders: 8</p>
            </div>
          </div>
        );
      case "price-suggestions":
        return (
          <div className="dashboard-section">
            <h3>Price Suggestions</h3>
            <p className="placeholder-text">Compare your current prices with market trends and adjust to maximize earnings.</p>
            <div className="suggestion-box">
              <p>Tomatoes: Consider pricing at ₹30 / kg for better demand.</p>
              <p>Onions: Recommend keeping your price at ₹25 / kg.</p>
            </div>
          </div>
        );
      case "payments":
        return (
          <div className="dashboard-section">
            <h3>Payments</h3>
            <p className="placeholder-text">Review your payouts and recent transaction history.</p>
            <div className="payment-summary-card">
              <p>Last payout: ₹4,250</p>
              <p>Next payout: Tomorrow</p>
            </div>
          </div>
        );
      case "profile":
        return (
          <div className="dashboard-section">
            <h3>Profile</h3>
            <p className="placeholder-text">Update your farmer profile, contact details, and farm information.</p>
            <div className="profile-card">
              <p>Name: Farmer Name</p>
              <p>Role: Farmer</p>
              <p>Email: your.email@example.com</p>
            </div>
          </div>
        );
      default:
        return (
          <>
            <div className="summary-grid">
              <div className="summary-card">
                <h4>Total Products</h4>
                <p>12</p>
              </div>
              <div className="summary-card">
                <h4>Orders Received</h4>
                <p>8</p>
              </div>
              <div className="summary-card">
                <h4>Earnings</h4>
                <p>₹4,250</p>
              </div>
              <div className="summary-card">
                <h4>Pending Deliveries</h4>
                <p>3</p>
              </div>
            </div>

            <div className="dashboard-section">
              <h3>Quick Actions</h3>

              <div className="action-grid">
                <div className="action-card">
                  <h4>Add New Product</h4>
                  <p>List fresh produce with AI price suggestion</p>
                  <button onClick={() => navigate("/farmer/add-product")}>Add Product</button>
                </div>

                <div className="action-card">
                  <h4>Buy Fertilizers</h4>
                  <p>Browse fertilizers from nearby sellers</p>
                  <button onClick={() => navigate("/fertilizer")}>Open Market</button>
                </div>

                <div className="action-card">
                  <h4>View Orders</h4>
                  <p>Track customer orders and delivery updates</p>
                  <button onClick={() => setActiveSection("orders")}>Check Orders</button>
                </div>
              </div>
            </div>

            <div className="dashboard-section">
              <h3>Recent Products</h3>

              <div className="product-table">
                <div className="product-row header">
                  <span>Product</span>
                  <span>Quantity</span>
                  <span>Price</span>
                  <span>Status</span>
                </div>
                <div className="product-row">
                  <span>Tomatoes</span>
                  <span>50 kg</span>
                  <span>₹28/kg</span>
                  <span className="status active-status">Active</span>
                </div>
                <div className="product-row">
                  <span>Onions</span>
                  <span>70 kg</span>
                  <span>₹24/kg</span>
                  <span className="status active-status">Active</span>
                </div>
                <div className="product-row">
                  <span>Potatoes</span>
                  <span>40 kg</span>
                  <span>₹20/kg</span>
                  <span className="status pending-status">Pending</span>
                </div>
              </div>
            </div>
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
          <button className="logout-btn" onClick={() => { logout(); navigate("/login"); }}>
            Logout
          </button>
          <div className="profile-circle">F</div>
        </div>
      </div>

      <div className="farmer-layout">
        {/* Sidebar */}
        <div className="farmer-sidebar">
          <h3 className="sidebar-title">Farmer Panel</h3>

          <div className={`sidebar-item ${activeSection === "dashboard" ? "active" : ""}`} onClick={() => setActiveSection("dashboard")}>Dashboard</div>
          <div className={`sidebar-item ${activeSection === "add-product" ? "active" : ""}`} onClick={() => navigate("/farmer/add-product")}>Add Product</div>
          <div className={`sidebar-item ${activeSection === "my-products" ? "active" : ""}`} onClick={() => setActiveSection("my-products")}>My Products</div>
          <div className={`sidebar-item ${activeSection === "orders" ? "active" : ""}`} onClick={() => setActiveSection("orders")}>Orders</div>
          <div className="sidebar-item" onClick={() => navigate("/fertilizer")}>Buy Fertilizers</div>
          <div className={`sidebar-item ${activeSection === "price-suggestions" ? "active" : ""}`} onClick={() => setActiveSection("price-suggestions")}>Price Suggestions</div>
          <div className={`sidebar-item ${activeSection === "payments" ? "active" : ""}`} onClick={() => setActiveSection("payments")}>Payments</div>
          <div className={`sidebar-item ${activeSection === "profile" ? "active" : ""}`} onClick={() => setActiveSection("profile")}>Profile</div>
        </div>

        {/* Main Content */}
        <div className="farmer-main">
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