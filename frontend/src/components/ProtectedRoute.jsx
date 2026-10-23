
import { Navigate, Outlet } from "react-router-dom";

export default function ProtectedRoute({ adminOnly = false }) {
  const token = localStorage.getItem("krishiToken");

  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("krishiUser") || "null");
  } catch {
    user = null;
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
