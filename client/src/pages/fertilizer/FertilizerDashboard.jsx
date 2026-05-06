import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppContext.jsx";
import "./fertilizerdashboard.css";

const FertilizerDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const products = [
    {
      id: 1,
      name: "NPK Fertilizer 20-20-20",
      category: "Chemical",
      price: 450,
      stock: 100,
      demand: "High",
      image: "🧪",
    },
    {
      id: 2,
      name: "Organic Compost",
      category: "Organic",
      price: 300,
      stock: 150,
      demand: "Medium",
      image: "♻️",
    },
    {
      id: 3,
      name: "Urea Fertilizer",
      category: "Chemical",
      price: 350,
      stock: 80,
      demand: "High",
      image: "🧪",
    },
  ];

  const orders = [
    {
      id: 101,
      farmer: "Ramesh Kumar",
      product: "NPK Fertilizer",
      qty: 50,
      amount: 22500,
      status: "Pending",
      date: "2024-05-02",
    },
    {
      id: 102,
      farmer: "Suresh Patel",
      product: "Organic Compost",
      qty: 100,
      amount: 30000,
      status: "Delivered",
      date: "2024-04-28",
    },
    {
      id: 103,
      farmer: "Anil Sharma",
      product: "Urea Fertilizer",
      qty: 30,
      amount: 10500,
      status: "Processing",
      date: "2024-05-01",
    },
  ];

  return (
    <div className="fertilizer-dashboard-page">
      {/* Topbar */}
      <div className="fertilizer-topbar">
        <div className="fertilizer-topbar-inner">
          <div className="fertilizer-brand">🌱 AgroConnect</div>
          <div className="fertilizer-topbar-center">Fertilizer Seller Dashboard</div>
          <div className="fertilizer-topbar-right">
            <button className="lang-btn">English ▼</button>
            <button className="voice-assist-btn">🎤</button>
            <button className="logout-btn" onClick={() => { logout(); navigate("/login"); }}>
              Logout
            </button>
            <div className="profile-circle">S</div>
          </div>
        </div>
      </div>

      <div className="fertilizer-layout">
        {/* Sidebar */}
        <div className="fertilizer-sidebar">
          <h3 className="sidebar-title">📋 Fertilizer Seller</h3>

          <div className="sidebar-item active">Dashboard</div>
          <div className="sidebar-item">Add Product</div>
          <div className="sidebar-item">My Products</div>
          <div className="sidebar-item">Orders</div>
          <div className="sidebar-item">Inventory</div>
          <div className="sidebar-item">AI Price Tips</div>
          <div className="sidebar-item">Payments</div>
          <div className="sidebar-item">Profile</div>
          <div className="sidebar-item">Logout</div>
        </div>

        {/* Main Content */}
        <div className="fertilizer-main">
          {/* Welcome Card */}
          <div className="welcome-card fertilizer-welcome">
            <h2>Welcome, Fertilizer Seller 👋</h2>
            <p>Manage your fertilizer products and reach farmers directly</p>
          </div>

          {/* Summary Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">📦</div>
              <div className="stat-content">
                <h4>Total Products</h4>
                <p className="stat-number">8</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📋</div>
              <div className="stat-content">
                <h4>Active Orders</h4>
                <p className="stat-number">12</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div className="stat-content">
                <h4>This Month Revenue</h4>
                <p className="stat-number">₹1,45,000</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">⭐</div>
              <div className="stat-content">
                <h4>Rating</h4>
                <p className="stat-number">4.8/5</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="dashboard-section">
            <h3>Quick Actions</h3>
            <div className="action-buttons">
              <button className="action-btn primary">➕ Add New Product</button>
              <button className="action-btn">📊 View Analytics</button>
              <button className="action-btn">🚚 Track Deliveries</button>
              <button className="action-btn">💬 Messages</button>
            </div>
          </div>

          {/* Products Overview */}
          <div className="dashboard-section">
            <div className="section-header">
              <h3>Your Fertilizer Products</h3>
              <button className="view-all-btn">View All →</button>
            </div>

            <div className="product-grid-fer">
              {products.map((product) => (
                <div className="fertilizer-product-card" key={product.id}>
                  <div className="product-icon">{product.image}</div>
                  <h4>{product.name}</h4>
                  <p className="product-category">{product.category}</p>
                  <div className="product-details">
                    <div>
                      <span className="label">Price:</span>
                      <span className="value">₹{product.price}</span>
                    </div>
                    <div>
                      <span className="label">Stock:</span>
                      <span className="value">{product.stock} bags</span>
                    </div>
                  </div>
                  <div className="demand-badge" data-demand={product.demand}>
                    {product.demand} Demand
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="dashboard-section">
            <div className="section-header">
              <h3>Recent Orders from Farmers</h3>
              <button className="view-all-btn">View All →</button>
            </div>

            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Farmer</th>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="order-id">#{order.id}</td>
                      <td>{order.farmer}</td>
                      <td>{order.product}</td>
                      <td>{order.qty} bags</td>
                      <td className="amount">₹{order.amount}</td>
                      <td>
                        <span className={`status-badge ${order.status.toLowerCase()}`}>
                          {order.status}
                        </span>
                      </td>
                      <td>{order.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Price Recommendations */}
          <div className="dashboard-section">
            <h3>🤖 AI Price Recommendations</h3>
            <div className="recommendations-box">
              <div className="recommendation">
                <p>
                  <strong>NPK Fertilizer:</strong> Current price ₹450. Market analysis suggests you could increase
                  to ₹480 while remaining competitive. Demand is High.
                </p>
              </div>
              <div className="recommendation">
                <p>
                  <strong>Organic Compost:</strong> Current price ₹300. Competitor average is ₹320. Consider
                  maintaining current price for volume advantage.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FertilizerDashboard;
