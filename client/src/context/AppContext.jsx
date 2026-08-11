import React, { useEffect, useState, useCallback } from "react";
import { authAPI, cartAPI } from "../services/api.js";
import {
  AuthContext,
  CartContext,
  LocationContext,
  NotificationContext,
} from "./ContextDefinitions.js";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("agroconnect_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(false);

  const login = useCallback((userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem("token", authToken);
    localStorage.setItem("agroconnect_user", JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("agroconnect_user");
  }, []);

  const updateUser = useCallback((updatedData) => {
    setUser((prev) => ({ ...prev, ...updatedData }));
  }, []);

  useEffect(() => {
    const loadCurrentUser = async () => {
      if (token && !user) {
        try {
          const data = await authAPI.getMe();
          if (data.success) {
            setUser(data.user);
            localStorage.setItem("agroconnect_user", JSON.stringify(data.user));
          }
        } catch {
          logout();
        }
      }
    };
    loadCurrentUser();
  }, [token, user, logout]);

  return (
    <AuthContext.Provider value={{ user, token, loading, setLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [backendCart, setBackendCart] = useState(null);
  const { token } = React.useContext(AuthContext) || {};

  const fetchCart = useCallback(async () => {
    if (!token) {
      setCart([]);
      setBackendCart(null);
      return;
    }
    try {
      const data = await cartAPI.getCart();
      if (data.success && data.cart) {
        setBackendCart(data.cart);
        setCart(data.cart.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch cart:", err);
    }
  }, [token]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = useCallback(async (product, quantity = 1) => {
    const productId = typeof product === "string" ? product : (product._id || product.id);
    try {
      const data = await cartAPI.addToCart(productId, quantity);
      if (data.success && data.cart) {
        setBackendCart(data.cart);
        setCart(data.cart.items || []);
      }
      return data;
    } catch (err) {
      console.error("Failed to add to cart:", err);
      throw err;
    }
  }, []);

  const removeFromCart = useCallback(async (productId) => {
    if (!backendCart?.items) return;
    const item = backendCart.items.find(
      (i) => i.product?._id === productId || i.product === productId || i.product?.id === productId
    );
    if (!item) return;

    try {
      const data = await cartAPI.removeFromCart(item._id);
      if (data.success && data.cart) {
        setBackendCart(data.cart);
        setCart(data.cart.items || []);
      }
      return data;
    } catch (err) {
      console.error("Failed to remove from cart:", err);
      throw err;
    }
  }, [backendCart]);

  const updateQuantity = useCallback(async (productId, quantity) => {
    if (!backendCart?.items) return;
    const item = backendCart.items.find(
      (i) => i.product?._id === productId || i.product === productId || i.product?.id === productId
    );
    if (!item) return;

    try {
      const data = await cartAPI.updateCartItem(item._id, quantity);
      if (data.success && data.cart) {
        setBackendCart(data.cart);
        setCart(data.cart.items || []);
      }
      return data;
    } catch (err) {
      console.error("Failed to update cart quantity:", err);
      throw err;
    }
  }, [backendCart]);

  const clearCart = useCallback(async () => {
    try {
      const data = await cartAPI.clearCart();
      if (data.success) {
        setBackendCart(null);
        setCart([]);
      }
      return data;
    } catch (err) {
      console.error("Failed to clear cart:", err);
      throw err;
    }
  }, []);

  const getTotalPrice = useCallback(() => {
    return backendCart ? backendCart.totalPrice : 0;
  }, [backendCart]);

  const getTotalItems = useCallback(() => {
    return backendCart ? backendCart.totalQuantity : 0;
  }, [backendCart]);

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, getTotalPrice, getTotalItems, refreshCart: fetchCart }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(null);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        setLoading(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setLocation({ latitude, longitude });
            setLoading(false);
            resolve({ latitude, longitude });
          },
          (error) => {
            setLoading(false);
            reject(error);
          }
        );
      } else {
        reject(new Error("Geolocation not supported"));
      }
    });
  }, []);

  return (
    <LocationContext.Provider value={{ location, nearbyUsers, setNearbyUsers, loading, getLocation }}>
      {children}
    </LocationContext.Provider>
  );
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((message, type = "info", duration = 3000) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, duration);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};
