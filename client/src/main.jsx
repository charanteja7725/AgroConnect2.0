import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import {
  AuthProvider,
  CartProvider,
  LocationProvider,
  NotificationProvider,
} from "./context/AppContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <LocationProvider>
        <CartProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </CartProvider>
      </LocationProvider>
    </AuthProvider>
  </React.StrictMode>
);