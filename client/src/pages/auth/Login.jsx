import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppContext.jsx";
import { authAPI } from "../../services/api.js";
import "./login.css";

function Login() {
  const navigate = useNavigate();
  const { login, setLoading, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    try {
      setLoading(true);
      const data = await authAPI.login(email, password);
      login(data.user, data.token);
      switch (data.user.role) {
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
        case "admin":
          navigate("/admin");
          break;
        default:
          navigate("/");
      }
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <h1>AgroConnect 🌾</h1>
        <p>Connecting Farmers & Buyers Directly</p>
      </div>

      <div className="login-right">
        <h2>Login</h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="login-btn" onClick={handleLogin} disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>

        {error && <p className="form-error">{error}</p>}

        <p className="signup-text">
          Don't have an account? <span onClick={() => navigate("/role")}>Select your role</span>
        </p>
      </div>
    </div>
  );
}

export default Login;
