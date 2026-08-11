import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authAPI } from "../../services/api.js";
import { useAuth, useNotification } from "../../context/AppHooks.js";
import { FiMail, FiLock, FiUser, FiPhone, FiCheckCircle } from "react-icons/fi";
import { FaLeaf, FaUsers } from "react-icons/fa";
import { MdOutlineAgriculture } from "react-icons/md";
import "./login.css";

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { addNotification } = useNotification();

  const initialRole = searchParams.get("role") || "buyer";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(initialRole);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError("");

    if (!firstName || !lastName || !email || !phone || !password || !role) {
      setError("Please complete all required fields.");
      return;
    }

    try {
      setLoading(true);
      const data = await authAPI.register({
        firstName,
        lastName,
        email,
        phone,
        password,
        role,
      });

      login(data.user, data.token);
      addNotification("Registration successful", "success");

      switch (role) {
        case "farmer":
          navigate("/farmer");
          break;
        case "buyer":
          navigate("/buyer");
          break;
        case "fertilizer_seller":
          navigate("/fertilizer");
          break;
        case "delivery_partner":
          navigate("/delivery");
          break;
        default:
          navigate("/");
      }
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* LEFT SIDE - Hero & Image Banner */}
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

      {/* RIGHT SIDE - Beautiful Form */}
      <div className="login-right-form">
        {/* Decorative elements */}
        <div className="leaf-decor leaf-1"></div>
        <div className="leaf-decor leaf-2"></div>
        <div className="wavy-bottom"></div>

        <div className="form-wrapper">
          <h2 className="login-title">Create Account</h2>

          {error && <div className="form-error-alert">{error}</div>}

          <div className="input-group-container">
            {/* First & Last Name inline */}
            <div className="register-grid">
              <div className="custom-input-wrapper">
                <FiUser className="input-icon" />
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="custom-input-wrapper">
                <FiUser className="input-icon" />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="custom-input-wrapper">
              <FiMail className="input-icon" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Phone Field */}
            <div className="custom-input-wrapper">
              <FiPhone className="input-icon" />
              <input
                type="text"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            {/* Password Field */}
            <div className="custom-input-wrapper">
              <FiLock className="input-icon" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Role Field Dropdown */}
            <div className="custom-input-wrapper">
              <FiCheckCircle className="input-icon" />
              <select 
                value={role} 
                onChange={(e) => setRole(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  width: "100%",
                  fontSize: "16px",
                  fontWeight: "500",
                  color: "#334155",
                  background: "transparent",
                  cursor: "pointer"
                }}
              >
                <option value="buyer">Buyer / Customer</option>
                <option value="farmer">Farmer</option>
                <option value="fertilizer_seller">Fertilizer Seller</option>
                <option value="delivery_partner">Delivery Partner</option>
              </select>
            </div>
          </div>

          <button className="custom-login-btn" onClick={handleRegister} disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </button>

          <p className="signup-link-text">
            Already have an account? <span onClick={() => navigate("/login")}>Login here</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
