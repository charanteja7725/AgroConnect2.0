import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useNotification } from "./context/AppHooks.js";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import Home from "./pages/Home";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import RoleSelection from "./pages/auth/RoleSelection";
import FarmerDashboard from "./pages/farmer/FarmerDashboard";
import AddProduct from "./pages/farmer/AddProduct";
import EditProduct from "./pages/farmer/EditProduct";
import BuyerDashboard from "./pages/buyer/BuyerDashboard";
import FertilizerStore from "./pages/buyer/FertilizerStore";
import Cart from "./pages/buyer/Cart";
import FertilizerDashboard from "./pages/fertilizer/FertilizerDashboard";
import AddFertilizerProduct from "./pages/fertilizer/AddFertilizerProduct";
import Verification from "./pages/Verification";
import DeliveryDashboard from "./pages/delivery/DeliveryDashboard";
import DeliveryDetail from "./pages/delivery/DeliveryDetail";
import AdminDashboard from "./pages/admin/AdminDashboard";
import NotFound from "./pages/NotFound.jsx";

function NotificationList() {
  const { notifications } = useNotification();

  if (!notifications.length) return null;

  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <div key={notification.id} className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      ))}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <NotificationList />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/role" element={<RoleSelection />} />
        <Route path="/roles" element={<RoleSelection />} />
        
        {/* Buyer Routes */}
        <Route
          path="/buyer"
          element={
            <ProtectedRoute allowedRoles={["buyer"]}>
              <BuyerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/buyer/cart"
          element={
            <ProtectedRoute allowedRoles={["buyer"]}>
              <Cart />
            </ProtectedRoute>
          }
        />

        {/* Farmer Routes */}
        <Route
          path="/farmer"
          element={
            <ProtectedRoute allowedRoles={["farmer"]}>
              <FarmerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/farmer/add-product"
          element={
            <ProtectedRoute allowedRoles={["farmer"]}>
              <AddProduct />
            </ProtectedRoute>
          }
        />
        <Route
          path="/farmer/edit-product/:id"
          element={
            <ProtectedRoute allowedRoles={["farmer", "fertilizer_seller"]}>
              <EditProduct />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fertilizer/add-product"
          element={
            <ProtectedRoute allowedRoles={["farmer", "fertilizer_seller"]}>
              <AddProduct />
            </ProtectedRoute>
          }
        />

        {/* Fertilizer Routes */}
        <Route
          path="/fertilizer"
          element={
            <ProtectedRoute allowedRoles={["fertilizer_seller"]}>
              <FertilizerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fertilizer/add-product"
          element={
            <ProtectedRoute allowedRoles={["fertilizer_seller"]}>
              <AddFertilizerProduct />
            </ProtectedRoute>
          }
        />
        <Route
          path="/verification"
          element={
            <ProtectedRoute allowedRoles={["farmer", "fertilizer_seller"]}>
              <Verification />
            </ProtectedRoute>
          }
        />

        {/* Delivery Routes */}
        <Route
          path="/delivery"
          element={
            <ProtectedRoute allowedRoles={["delivery_partner"]}>
              <DeliveryDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/delivery/:id"
          element={
            <ProtectedRoute allowedRoles={["delivery_partner"]}>
              <DeliveryDetail />
            </ProtectedRoute>
          }
        />

        {/* Fertilizer Store */}
        <Route
          path="/fertilizer-store"
          element={
            <ProtectedRoute allowedRoles={["buyer", "farmer"]}>
              <FertilizerStore />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
