import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authAPI } from "../../services/api.js";
import { useAuth } from "../../context/AppContext.jsx";
import { useNotification } from "../../context/AppContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import "./login.css";

const Register = () => {
  const { t } = useLanguage();
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
        <h1>{t("appName")} 🌾</h1>
        <p>{t("heroDescription")}</p>
      </div>

      <div className="login-right">
        <h2>{t("createAccount")}</h2>

        <div className="register-grid">
          <input
            type="text"
            placeholder={t("firstName")}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            type="text"
            placeholder={t("lastName")}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <input
          type="email"
          placeholder={t("email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="text"
          placeholder={t("phone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          type="password"
          placeholder={t("password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="buyer">{t("customer")}</option>
          <option value="farmer">{t("farmer")}</option>
          <option value="fertilizer_seller">{t("fertilizerSeller")}</option>
          <option value="delivery_partner">{t("deliveryPartner")}</option>
        </select>

        <button className="login-btn" onClick={handleRegister} disabled={loading}>
          {loading ? t("registering") : t("registerButton")}
        </button>

        {error && <p className="form-error">{error}</p>}

        <p className="signup-text">
          {t("alreadyHaveAccount")} <span onClick={() => navigate("/login")}>{t("loginHere")}</span>
        </p>
      </div>
    </div>
  );
};

export default Register;
