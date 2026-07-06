import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authAPI } from "../../services/api.js";
import { useAuth, useNotification } from "../../context/AppHooks.js";
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
      <div className="login-left">
        <h1>AgroConnect 🌾</h1>
        <p>Sign up to buy, sell or deliver farm products.</p>
      </div>

      <div className="login-right">
        <h2>Create Account</h2>

        <div className="register-grid">
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="text"
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="buyer">Buyer</option>
          <option value="farmer">Farmer</option>
          <option value="fertilizer_seller">Fertilizer Seller</option>
          <option value="delivery_partner">Delivery Partner</option>
        </select>

        <button className="login-btn" onClick={handleRegister} disabled={loading}>
          {loading ? "Registering..." : "Create Account"}
        </button>

        {error && <p className="form-error">{error}</p>}

        <p className="signup-text">
          Already have an account? <span onClick={() => navigate("/login")}>Login here</span>
        </p>
      </div>
    </div>
  );
};

export default Register;
