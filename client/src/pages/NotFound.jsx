import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AppHooks.js";

const roleHomeMap = {
  farmer: "/farmer",
  buyer: "/buyer",
  fertilizer_seller: "/fertilizer",
  delivery_partner: "/delivery",
  admin: "/admin",
};

export default function NotFound() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const homePath = user ? (roleHomeMap[user.role] || "/") : "/";

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
      padding: "2rem",
      textAlign: "center",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      <div style={{ fontSize: "5rem", marginBottom: "1rem" }}>🌾</div>
      <h1 style={{ fontSize: "3rem", fontWeight: 800, color: "#166534", margin: "0 0 0.5rem" }}>404</h1>
      <h2 style={{ fontSize: "1.5rem", color: "#15803d", margin: "0 0 1rem" }}>Page Not Found</h2>
      <p style={{ color: "#374151", maxWidth: "400px", lineHeight: 1.6, marginBottom: "2rem" }}>
        This field is empty — the page you're looking for doesn't exist or has been moved.
      </p>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "#fff",
            color: "#16a34a",
            border: "2px solid #16a34a",
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.95rem",
          }}
        >
          ← Go Back
        </button>
        <button
          onClick={() => navigate(homePath)}
          style={{
            background: "#16a34a",
            color: "#fff",
            border: "none",
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.95rem",
          }}
        >
          🏠 Go to Dashboard
        </button>
      </div>
    </div>
  );
}
