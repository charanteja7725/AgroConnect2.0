import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { authAPI } from "../../services/api.js";
import "./login.css";

function Login() {
  const { t } = useLanguage();
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
        <h1>{t("appName")} 🌾</h1>
        <p>{t("heroDescription")}</p>
      </div>

      <div className="login-right">
        <h2>{t("login")}</h2>

        <input
          type="email"
          placeholder={t("email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder={t("password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="login-btn" onClick={handleLogin} disabled={loading}>
          {loading ? t("loggingIn") : t("loginButton")}
        </button>

        {error && <p className="form-error">{error}</p>}

        <p className="signup-text">
          {t("alreadyHaveAccount")} <span onClick={() => navigate("/role")}>{t("loginHere")}</span>
        </p>
      </div>
    </div>
  );
}

export default Login;
