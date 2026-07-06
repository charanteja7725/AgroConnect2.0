import React, { useEffect, useState, useCallback } from "react";
import { authAPI } from "../services/api.js";
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
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem("agroconnect_cart");
    return savedCart ? JSON.parse(savedCart) : [];
  });

  const addToCart = useCallback((product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);

      const updatedCart = existingItem
        ? prevCart.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + (product.quantity || 1) } : item
          )
        : [...prevCart, { ...product, quantity: product.quantity || 1 }];

      localStorage.setItem("agroconnect_cart", JSON.stringify(updatedCart));
      return updatedCart;
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart((prevCart) => {
      const updatedCart = prevCart.filter((item) => item.id !== productId);
      localStorage.setItem("agroconnect_cart", JSON.stringify(updatedCart));
      return updatedCart;
    });
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    setCart((prevCart) => {
      const updatedCart = prevCart.map((item) =>
        item.id === productId ? { ...item, quantity: Math.max(0, quantity) } : item
      );
      localStorage.setItem("agroconnect_cart", JSON.stringify(updatedCart));
      return updatedCart;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    localStorage.removeItem("agroconnect_cart");
  }, []);

  const getTotalPrice = useCallback(() => cart.reduce((total, item) => total + item.price * item.quantity, 0), [cart]);
  const getTotalItems = useCallback(() => cart.reduce((total, item) => total + item.quantity, 0), [cart]);

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, getTotalPrice, getTotalItems }}
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
