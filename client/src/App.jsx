import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useNotification } from "./context/AppContext.jsx";

import Home from "./pages/Home";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import RoleSelection from "./pages/auth/RoleSelection";
import FarmerDashboard from "./pages/farmer/FarmerDashboard";
import AddProduct from "./pages/farmer/AddProduct";
import BuyerDashboard from "./pages/buyer/BuyerDashboard";
import Cart from "./pages/buyer/Cart";
import FertilizerDashboard from "./pages/fertilizer/FertilizerDashboard";
import DeliveryDashboard from "./pages/delivery/DeliveryDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";

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
        <Route path="/buyer" element={<BuyerDashboard />} />
        <Route path="/buyer/cart" element={<Cart />} />

        {/* Farmer Routes */}
        <Route path="/farmer" element={<FarmerDashboard />} />
        <Route path="/farmer/add-product" element={<AddProduct />} />

        {/* Fertilizer Routes */}
        <Route path="/fertilizer" element={<FertilizerDashboard />} />

        {/* Delivery Routes */}
        <Route path="/delivery" element={<DeliveryDashboard />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
