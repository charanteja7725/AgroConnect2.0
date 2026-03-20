import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/auth/Login";
import RoleSelection from "./pages/auth/RoleSelection";
import FarmerDashboard from "./pages/farmer/FarmerDashboard";
import AddProduct from "./pages/farmer/AddProduct";
import BuyerDashboard from "./pages/buyer/BuyerDashboard";
import Cart from "./pages/buyer/Cart";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/role" element={<RoleSelection />} />
        <Route path="/roles" element={<RoleSelection />} />
        <Route path="/buyer" element={<BuyerDashboard />} />
        <Route path="/farmer" element={<FarmerDashboard />} />
        <Route path="/farmer/add-product" element={<AddProduct />} />
        <Route path="/buyer/cart" element={<Cart />} />

        <Route path="/buyer" element={<h1>Buyer Dashboard</h1>} />
        <Route path="/fertilizer" element={<h1>Fertilizer Seller Dashboard</h1>} />
        <Route path="/delivery" element={<h1>Delivery Dashboard</h1>} />
        <Route path="/admin" element={<h1>Admin Dashboard</h1>} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;