import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppHooks.js";
import { authAPI } from "../../services/api.js";
import { FiMail, FiLock, FiShield, FiEye, FiEyeOff } from "react-icons/fi";
import { FaLeaf, FaUsers } from "react-icons/fa";
import { MdOutlineAgriculture } from "react-icons/md";
import "./login.css";

function Login() {
  const navigate = useNavigate();
  const { login, setLoading, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setError("");
    try {
      setLoading(true);
      const data = await authAPI.login(email, password);
      login(data.user, data.token);

      const roleRoutes = {
        farmer: "/farmer",
        buyer: "/buyer",
        fertilizer_seller: "/fertilizer",
        delivery_partner: "/delivery",
        verification_employee: "/verification-employee",
        admin: "/admin",
      };

      navigate(roleRoutes[data.user.role] || "/");
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-left-banner">
        <div className="login-overlay">
          <div className="logo-container">
            <h1 className="logo-text">
              Agro<span>Connect</span>
            </h1>
            <MdOutlineAgriculture className="logo-icon" />
          </div>

          <span className="logo-leaf-divider">🍃</span>

          <p className="banner-slogan">
            Connecting farmers directly with consumers.<br />
            Simple, accessible, and powered by voice technology.
          </p>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <MdOutlineAgriculture size={22} />
              </div>
              <p>Empower<br />Farmers</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <FaUsers size={22} />
              </div>
              <p>Connect<br />Consumers</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <FaLeaf size={20} />
              </div>
              <p>Sustainable<br />Future</p>
            </div>
          </div>
        </div>
      </div>

      <div className="login-right-form">
        <div className="leaf-decor leaf-1"></div>
        <div className="leaf-decor leaf-2"></div>
        <div className="wavy-bottom"></div>

        <div className="form-wrapper">
          <h2 className="login-title">Login</h2>

          {error && <div className="form-error-alert">{error}</div>}

          <div className="input-group-container">
            <div className="custom-input-wrapper">
              <FiMail className="input-icon" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                required
              />
            </div>

            <div className="custom-input-wrapper" style={{ position: "relative" }}>
              <FiLock className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                required
                style={{ paddingRight: "40px" }}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((value) => !value)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  padding: "0",
                }}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          <button className="custom-login-btn" onClick={handleLogin} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>

          <p className="signup-link-text">
            Don't have an account? <span onClick={() => navigate("/roles")}>Register here</span>
          </p>

          <div className="divider-container">
            <span className="line"></span>
            <span className="text">or</span>
            <span className="line"></span>
          </div>

          <button className="guest-btn" onClick={() => navigate("/")}>
            <FiShield className="guest-icon" />
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
