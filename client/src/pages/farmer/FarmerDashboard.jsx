import "./farmerdashboard.css";
import { useNavigate } from "react-router-dom";
const FarmerDashboard = () => {
  const navigate = useNavigate();   

  return (
    <div className="farmer-dashboard-page">
      {/* Topbar */}
      <div className="farmer-topbar">
        <div className="farmer-brand">🌱 AgroConnect</div>

        <div className="farmer-topbar-right">
          <button className="lang-btn">English ▼</button>
          <div className="profile-circle">F</div>
        </div>
      </div>

      <div className="farmer-layout">
        {/* Sidebar */}
        <div className="farmer-sidebar">
          <h3 className="sidebar-title">Farmer Panel</h3>

          <div className="sidebar-item active">Dashboard</div>
          <div className="sidebar-item">Add Product</div>
          <div className="sidebar-item">My Products</div>
          <div className="sidebar-item">Orders</div>
          <div className="sidebar-item">Buy Fertilizers</div>
          <div className="sidebar-item">Price Suggestions</div>
          <div className="sidebar-item">Payments</div>
          <div className="sidebar-item">Profile</div>
        </div>

        {/* Main Content */}
        <div className="farmer-main">
          <div className="welcome-card">
            <h2>Welcome back, Farmer 👋</h2>
            <p>
              Manage your products, monitor orders, and buy fertilizers from
              trusted local sellers.
            </p>
          </div>

          {/* Summary Cards */}
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

          {/* Quick Actions */}
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
                <button>Open Market</button>
              </div>

              <div className="action-card">
                <h4>View Orders</h4>
                <p>Track customer orders and delivery updates</p>
                <button>Check Orders</button>
              </div>
            </div>
          </div>

          {/* Recent Products */}
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
        </div>
      </div>
    </div>
  );
};

export default FarmerDashboard;