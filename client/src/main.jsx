import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import {
  AuthProvider,
  CartProvider,
  LocationProvider,
  NotificationProvider,
} from "./context/AppContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <LanguageProvider>
        <LocationProvider>
          <CartProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </CartProvider>
        </LocationProvider>
      </LanguageProvider>
    </AuthProvider>
  </React.StrictMode>
);