import { useNavigate } from "react-router-dom";
import "./role.css";

const RoleSelection = () => {
  const navigate = useNavigate();

  return (
    <div className="ag-role-page">
      
      {/* Top Green Bar */}
      <div className="ag-role-topbar">
        <div className="ag-role-brand">🌱 AgroConnect</div>
      </div>

      {/* Main Content */}
      <div className="ag-role-content">
        <h2 className="ag-role-title">Choose Your Role</h2>
        <p className="ag-role-subtitle">
          Select how you’d like to use AgroConnect
        </p>

        <div className="ag-role-grid">

          {/* Farmer */}
          <div
            className="ag-role-card farmer-card"
            onClick={() => navigate("/farmer")}
          >
            <div className="ag-role-icon farmer-icon">🌱</div>
            <h3>Farmer</h3>
            <p>
              Sell your produce directly to consumers with voice-assisted product listing
            </p>
            <span className="ag-role-btn farmer-link">Get Started →</span>
          </div>

          {/* Customer */}
          <div
            className="ag-role-card customer-card"
            onClick={() => navigate("/buyer")}
          >
            <div className="ag-role-icon customer-icon">🛒</div>
            <h3>Customer</h3>
            <p>
              Buy fresh products directly from nearby farmers at the best prices
            </p>
            <span className="ag-role-btn customer-link">Get Started →</span>
          </div>

          {/* Fertilizer Seller */}
          <div
            className="ag-role-card seller-card"
            onClick={() => navigate("/fertilizer")}
          >
            <div className="ag-role-icon seller-icon">🏪</div>
            <h3>Fertilizer Seller</h3>
            <p>
              Sell fertilizers and agricultural supplies to local farmers
            </p>
            <span className="ag-role-btn seller-link">Get Started →</span>
          </div>

          {/* Delivery Partner */}
          <div
            className="ag-role-card delivery-card"
            onClick={() => navigate("/delivery")}
          >
            <div className="ag-role-icon delivery-icon">🚚</div>
            <h3>Delivery Partner</h3>
            <p>
              Earn by delivering fresh produce from farmers to customers
            </p>
            <span className="ag-role-btn delivery-link">Get Started →</span>
          </div>

          {/* Admin */}
          <div
            className="ag-role-card admin-card"
            onClick={() => navigate("/admin")}
          >
            <div className="ag-role-icon admin-icon">🛡️</div>
            <h3>Admin</h3>
            <p>
              Manage the platform, users, and monitor marketplace analytics
            </p>
            <span className="ag-role-btn admin-link">Get Started →</span>
          </div>

        </div>

        {/* Login Link */}
        <p className="ag-role-login-text">
          Already have an account? <span onClick={() => navigate("/login")}>Login here</span>
        </p>
      </div>

    </div>
  );
};

export default RoleSelection;