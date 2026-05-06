import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AppContext.jsx";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, token } = useAuth();
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

