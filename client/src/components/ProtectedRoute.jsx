import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AppHooks.js";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, token, loading, authReady } = useAuth();
  const location = useLocation();

  // A cached user may contain an old verification status or role. Wait until
  // AuthProvider has refreshed /auth/me before rendering or redirecting.
  if (token && (loading || authReady === false)) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div>Loading your AgroConnect account...</div>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
