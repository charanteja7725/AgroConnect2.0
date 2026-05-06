import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppContext.jsx";
import "./admindashboard.css";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const recentUsers = [
    { id: 1, name: "Ramesh Kumar", role: "Farmer", email: "ramesh@farm.com", status: "Active" },
    { id: 2, name: "Priya Singh", role: "Buyer", email: "priya@buyer.com", status: "Active" },
    { id: 3, name: "Agro Supplies", role: "Fertilizer", email: "agro@supply.com", status: "Active" },
    { id: 4, name: "Delivery Guy", role: "Delivery", email: "delivery@agro.com", status: "Active" },
  ];

  const platformStats = [
    { label: "Total Users", value: "2,847", icon: "👥", color: "blue" },
    { label: "Total Orders", value: "1,243", icon: "📦", color: "green" },
    { label: "Revenue", value: "₹12,34,500", icon: "💰", color: "purple" },
    { label: "Active Farmers", value: "456", icon: "🌾", color: "orange" },
  ];

  const roleDistribution = [
    { role: "Farmers", count: 456, percentage: 30 },
    { role: "Buyers", count: 980, percentage: 50 },
    { role: "Fertilizer Sellers", count: 234, percentage: 12 },
    { role: "Delivery Partners", count: 177, percentage: 8 },
  ];

  return (
    <div className="admin-dashboard-page">
      {/* Admin Topbar */}
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
        {/* Sidebar */}
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

        {/* Main Content */}
        <div className="admin-main">
          {/* Welcome Section */}
          <div className="admin-welcome">
            <h2>Welcome to AgroConnect Admin Panel 🚀</h2>
            <p>Manage users, monitor platform activities, and control system operations</p>
          </div>

          {/* KPI Stats */}
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

          {/* Charts Section */}
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

          {/* Recent Users */}
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
                    <tr key={user.id}>
                      <td className="user-name">{user.name}</td>
                      <td>
                        <span className="role-badge">{user.role}</span>
                      </td>
                      <td className="user-email">{user.email}</td>
                      <td>
                        <span className="status-badge active">{user.status}</span>
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

          {/* Quick Actions */}
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

          {/* System Operations */}
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
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
