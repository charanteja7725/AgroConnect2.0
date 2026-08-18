import { useNavigate } from "react-router-dom";
import "./role.css";

const RoleSelection = () => {
  const navigate = useNavigate();

  return (
    <div className="ag-role-page">

      {/* Top Green Bar */}
      <div className="ag-role-topbar">
        <div className="ag-role-brand">🌱 AgroConnect</div>
        <span
          className="ag-role-topbar-login"
          onClick={() => navigate("/login")}
        >
          Already have an account? Login →
        </span>
      </div>

      {/* Main Content */}
      <div className="ag-role-content">

        {/* Hero Title */}
        <div className="ag-role-hero">
          <h2 className="ag-role-title">Choose Your Role</h2>
          <p className="ag-role-subtitle">
            Select how you'd like to use AgroConnect
          </p>
        </div>

        <div className="ag-role-grid">

          {/* Farmer */}
          <div
            className="ag-role-card farmer-card"
            onClick={() => navigate("/register?role=farmer")}
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
            onClick={() => navigate("/register?role=buyer")}
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
            onClick={() => navigate("/register?role=fertilizer_seller")}
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
            onClick={() => navigate("/register?role=delivery_partner")}
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
            onClick={() => navigate("/login")}
          >
            <div className="ag-role-icon admin-icon">🛡️</div>
            <h3>Admin</h3>
            <p>
              Manage the platform, users, and monitor marketplace analytics
            </p>
            <span className="ag-role-btn admin-link">Login →</span>
          </div>

        </div>

        {/* Login Link */}
        <p className="ag-role-login-text">
          Already have an account?{" "}
          <span onClick={() => navigate("/login")}>Login here</span>
        </p>
      </div>

    </div>
  );
};

export default RoleSelection;