import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppHooks.js";
import { orderAPI, productAPI, userAPI } from "../../services/api.js";
import "./admindashboard.css";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOrders: 0,
    revenue: 0,
    totalProducts: 0,
    farmers: 0,
    buyers: 0,
    fertilizerSellers: 0,
    deliveryPartners: 0,
  });
  const [recentUsers, setRecentUsers] = useState([]);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError("");

      try {
        const [ordersRes, farmersRes, buyersRes, fertilizerRes, deliveryRes, productsRes] =
          await Promise.all([
            orderAPI.getOrders(),
            userAPI.getUsersByRole("farmer"),
            userAPI.getUsersByRole("buyer"),
            userAPI.getUsersByRole("fertilizer_seller"),
            userAPI.getUsersByRole("delivery_partner"),
            productAPI.getAllProducts({ limit: 1 }),
          ]);

        const totalUsers =
          (farmersRes.count || 0) +
          (buyersRes.count || 0) +
          (fertilizerRes.count || 0) +
          (deliveryRes.count || 0);

        const revenue = ordersRes.orders?.reduce((sum, order) => sum + (order.totalAmount || 0), 0) || 0;

        setStats({
          totalUsers,
          totalOrders: ordersRes.count || 0,
          revenue,
          totalProducts: productsRes.total || 0,
          farmers: farmersRes.count || 0,
          buyers: buyersRes.count || 0,
          fertilizerSellers: fertilizerRes.count || 0,
          deliveryPartners: deliveryRes.count || 0,
        });
        setRecentUsers([
          ...(farmersRes.users || []),
          ...(buyersRes.users || []),
          ...(fertilizerRes.users || []),
          ...(deliveryRes.users || []),
        ]
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .slice(0, 6));
      } catch (err) {
        setError(err.message || "Unable to load admin dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const platformStats = [
    { label: "Total Users", value: stats.totalUsers, icon: "👥", color: "blue" },
    { label: "Total Orders", value: stats.totalOrders, icon: "📦", color: "green" },
    { label: "Revenue", value: `₹${stats.revenue.toLocaleString()}`, icon: "💰", color: "purple" },
    { label: "Active Farmers", value: stats.farmers, icon: "🌾", color: "orange" },
  ];

  const roleDistribution = [
    { role: "Farmers", count: stats.farmers, percentage: stats.totalUsers ? Math.round((stats.farmers / stats.totalUsers) * 100) : 0 },
    { role: "Buyers", count: stats.buyers, percentage: stats.totalUsers ? Math.round((stats.buyers / stats.totalUsers) * 100) : 0 },
    { role: "Fertilizer Sellers", count: stats.fertilizerSellers, percentage: stats.totalUsers ? Math.round((stats.fertilizerSellers / stats.totalUsers) * 100) : 0 },
    { role: "Delivery Partners", count: stats.deliveryPartners, percentage: stats.totalUsers ? Math.round((stats.deliveryPartners / stats.totalUsers) * 100) : 0 },
  ];

  return (
    <div className="admin-dashboard-page">
      <div className="admin-topbar">
        <div className="admin-topbar-inner">
          <div className="admin-brand">🌱 AgroConnect</div>
          <div className="admin-title">Admin Control Center</div>
          <div className="admin-topbar-right">
            <button className="notify-btn">🔔</button>
            <button className="settings-btn">⚙️</button>
            <button className="logout-btn" onClick={() => { logout(); navigate("/login"); }}>
              Logout
            </button>
            <div className="profile-circle">A</div>
          </div>
        </div>
      </div>

      <div className="admin-layout">
        <div className="admin-sidebar">
          <h3 className="sidebar-title">⚙️ Admin Panel</h3>
          <div className="sidebar-item active">Dashboard</div>
          <div className="sidebar-item">User Management</div>
          <div className="sidebar-item">Orders & Sales</div>
          <div className="sidebar-item">Products</div>
          <div className="sidebar-item">Payments</div>
          <div className="sidebar-item">Deliveries</div>
          <div className="sidebar-item">Reports</div>
          <div className="sidebar-item">Settings</div>
          <div className="sidebar-item">Audit Logs</div>
          <div className="sidebar-item">Logout</div>
        </div>

        <div className="admin-main">
          <div className="admin-welcome">
            <h2>Welcome to AgroConnect Admin Panel 🚀</h2>
            <p>Manage users, monitor platform activities, and control system operations</p>
          </div>

          {loading ? (
            <div className="loading-state">Loading dashboard data...</div>
          ) : error ? (
            <div className="error-state">{error}</div>
          ) : (
            <>
              <div className="kpi-grid">
                {platformStats.map((stat, idx) => (
                  <div className="kpi-card" key={idx} data-color={stat.color}>
                    <div className="kpi-icon">{stat.icon}</div>
                    <div className="kpi-content">
                      <p className="kpi-label">{stat.label}</p>
                      <h3 className="kpi-value">{stat.value}</h3>
                    </div>
                  </div>
                ))}
              </div>

              <div className="charts-section">
                <div className="chart-box">
                  <h3>User Role Distribution</h3>
                  <div className="role-distribution">
                    {roleDistribution.map((item) => (
                      <div className="role-item" key={item.role}>
                        <div className="role-label">
                          <span className="role-name">{item.role}</span>
                          <span className="role-count">{item.count}</span>
                        </div>
                        <div className="role-bar">
                          <div className="role-progress" style={{ width: `${item.percentage}%` }}></div>
                        </div>
                        <span className="role-percentage">{item.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="chart-box">
                  <h3>Platform Health</h3>
                  <div className="health-metrics">
                    <div className="health-item">
                      <span className="health-label">Server Status</span>
                      <span className="health-value green">● Online</span>
                    </div>
                    <div className="health-item">
                      <span className="health-label">Database Status</span>
                      <span className="health-value green">● Connected</span>
                    </div>
                    <div className="health-item">
                      <span className="health-label">API Status</span>
                      <span className="health-value green">● Operational</span>
                    </div>
                    <div className="health-item">
                      <span className="health-label">System Load</span>
                      <span className="health-value green">● Normal</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="admin-section">
                <div className="section-header">
                  <h3>Recent User Registrations</h3>
                  <button className="view-all-btn">View All Users →</button>
                </div>
                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentUsers.map((user) => (
                        <tr key={user._id || user.email}>
                          <td className="user-name">{user.firstName} {user.lastName}</td>
                          <td>
                            <span className="role-badge">{user.role}</span>
                          </td>
                          <td className="user-email">{user.email}</td>
                          <td>
                            <span className={`status-badge ${user.isActive ? "active" : "inactive"}`}>
                              {user.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="actions-cell">
                            <button className="action-link">👁️ View</button>
                            <button className="action-link">✏️ Edit</button>
                            <button className="action-link danger">🗑️ Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admin-section">
                <h3>Quick Actions</h3>
                <div className="quick-actions-grid">
                  <div className="quick-action-card">
                    <h4>👥 Manage Users</h4>
                    <p>Add, edit, or remove users from the platform</p>
                    <button>Go to Users</button>
                  </div>
                  <div className="quick-action-card">
                    <h4>📊 View Reports</h4>
                    <p>Access detailed sales, revenue, and usage reports</p>
                    <button>Generate Reports</button>
                  </div>
                  <div className="quick-action-card">
                    <h4>💳 Process Payments</h4>
                    <p>Review and approve pending transactions</p>
                    <button>View Payments</button>
                  </div>
                  <div className="quick-action-card">
                    <h4>📧 Send Notifications</h4>
                    <p>Broadcast messages to users or specific groups</p>
                    <button>Send Notification</button>
                  </div>
                  <div className="quick-action-card">
                    <h4>🛡️ System Settings</h4>
                    <p>Configure platform settings and security</p>
                    <button>Settings</button>
                  </div>
                  <div className="quick-action-card">
                    <h4>📋 Audit Logs</h4>
                    <p>View all system activities and changes</p>
                    <button>View Logs</button>
                  </div>
                </div>
              </div>

              <div className="admin-section">
                <h3>System Operations</h3>
                <div className="operations-box">
                  <div className="operation-item">
                    <div className="op-info">
                      <h4>Database Backup</h4>
                      <p>Last backup: 2 hours ago</p>
                    </div>
                    <button className="op-btn">Backup Now</button>
                  </div>
                  <div className="operation-item">
                    <div className="op-info">
                      <h4>Clear Cache</h4>
                      <p>Cache size: 245 MB</p>
                    </div>
                    <button className="op-btn">Clear Now</button>
                  </div>
                  <div className="operation-item">
                    <div className="op-info">
                      <h4>System Maintenance</h4>
                      <p>Schedule platform maintenance</p>
                    </div>
                    <button className="op-btn">Schedule</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
