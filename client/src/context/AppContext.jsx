import React, { useCallback, useContext, useEffect, useState } from "react";
import { authAPI } from "../services/api.js";
import {
  AuthContext,
  CartContext,
  LocationContext,
  NotificationContext,
} from "./ContextDefinitions.js";

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) throw new Error("useLocation must be used inside LocationProvider");
  return context;
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotification must be used inside NotificationProvider");
  return context;
};

const readStoredUser = () => {
  try {
    const savedUser = localStorage.getItem("agroconnect_user");
    return savedUser ? JSON.parse(savedUser) : null;
  } catch (error) {
    console.error("Failed to parse saved user:", error);
    localStorage.removeItem("agroconnect_user");
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [user, setUser] = useState(readStoredUser);
  // If a token exists, do not trust a cached role/status until /auth/me has
  // synchronised it with MongoDB. This prevents stale verification/suspension
  // state after an admin or area reviewer changes the account.
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem("token")));
  const [authReady, setAuthReady] = useState(() => !localStorage.getItem("token"));

  const persistUser = useCallback((nextUser) => {
    setUser(nextUser || null);
    if (nextUser) {
      localStorage.setItem("agroconnect_user", JSON.stringify(nextUser));
    } else {
      localStorage.removeItem("agroconnect_user");
    }
  }, []);

  const login = useCallback(
    (userData, authToken) => {
      setToken(authToken || null);
      persistUser(userData || null);

      if (authToken) localStorage.setItem("token", authToken);
      else localStorage.removeItem("token");

      setAuthReady(true);
    },
    [persistUser]
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setLoading(false);
    setAuthReady(true);
    localStorage.removeItem("token");
    localStorage.removeItem("agroconnect_user");
  }, []);

  const updateUser = useCallback(
    (updatedData) => {
      setUser((previousUser) => {
        const updatedUser = {
          ...(previousUser || {}),
          ...(updatedData || {}),
        };
        localStorage.setItem("agroconnect_user", JSON.stringify(updatedUser));
        return updatedUser;
      });
    },
    []
  );

  const refreshUser = useCallback(
    async ({ silent = false } = {}) => {
      const currentToken = localStorage.getItem("token");
      if (!currentToken) {
        logout();
        return null;
      }

      if (!silent) setLoading(true);

      try {
        const data = await authAPI.getMe();
        const freshUser = data?.user || null;

        if (!freshUser) {
          logout();
          return null;
        }

        persistUser(freshUser);
        return freshUser;
      } catch (error) {
        console.error("Failed to refresh authenticated user:", error);
        // A 401/403 here includes expired tokens and accounts that were
        // suspended/deactivated after the token was issued.
        logout();
        return null;
      } finally {
        if (!silent) setLoading(false);
        setAuthReady(true);
      }
    },
    [logout, persistUser]
  );

  useEffect(() => {
    if (!token) {
      setAuthReady(true);
      setLoading(false);
      return;
    }

    // Always validate the cached user against the backend once per app load
    // or token change. Previously a cached farmer could remain "pending" even
    // after an employee approved the account until localStorage was cleared.
    refreshUser();
  }, [token, refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        authReady,
        setLoading,
        login,
        logout,
        updateUser,
        refreshUser,
        isAuthenticated: Boolean(token && user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem("agroconnect_cart");
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      console.error("Failed to parse saved cart:", error);
      localStorage.removeItem("agroconnect_cart");
      return [];
    }
  });

  const addToCart = useCallback((product) => {
    setCart((previousCart) => {
      const productId = product?._id || product?.id;
      const existingItem = previousCart.find(
        (item) => (item?._id || item?.id) === productId
      );

      const updatedCart = existingItem
        ? previousCart.map((item) =>
            (item?._id || item?.id) === productId
              ? {
                  ...item,
                  quantity: (item.quantity || 1) + (product.quantity || 1),
                }
              : item
          )
        : [...previousCart, { ...product, quantity: product.quantity || 1 }];

      localStorage.setItem("agroconnect_cart", JSON.stringify(updatedCart));
      return updatedCart;
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart((previousCart) => {
      const updatedCart = previousCart.filter(
        (item) => (item?._id || item?.id) !== productId
      );
      localStorage.setItem("agroconnect_cart", JSON.stringify(updatedCart));
      return updatedCart;
    });
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    const newQuantity = Number(quantity);

    setCart((previousCart) => {
      const updatedCart =
        newQuantity <= 0
          ? previousCart.filter((item) => (item?._id || item?.id) !== productId)
          : previousCart.map((item) =>
              (item?._id || item?.id) === productId
                ? { ...item, quantity: newQuantity }
                : item
            );

      localStorage.setItem("agroconnect_cart", JSON.stringify(updatedCart));
      return updatedCart;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    localStorage.removeItem("agroconnect_cart");
  }, []);

  const getTotalPrice = useCallback(
    () =>
      cart.reduce(
        (total, item) => total + (Number(item.price) || 0) * (Number(item.quantity) || 0),
        0
      ),
    [cart]
  );

  const getTotalItems = useCallback(
    () => cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0),
    [cart]
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        setCart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotalPrice,
        getTotalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(null);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);

  const getLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = new Error("Geolocation is not supported by this browser.");
        setLocationError(error.message);
        reject(error);
        return;
      }

      setLoading(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const currentLocation = { latitude, longitude };
          setLocation(currentLocation);
          setLoading(false);
          resolve(currentLocation);
        },
        (error) => {
          console.error("Failed to get location:", error);
          setLoading(false);
          setLocationError(error.message || "Unable to get your location.");
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, []);

  return (
    <LocationContext.Provider
      value={{
        location,
        setLocation,
        nearbyUsers,
        setNearbyUsers,
        loading,
        locationError,
        getLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((message, type = "info", duration = 3000) => {
    const id = Date.now() + Math.random().toString(36).slice(2);
    const notification = { id, message, type };

    setNotifications((previous) => [...previous, notification]);

    if (duration > 0) {
      setTimeout(() => {
        setNotifications((previous) =>
          previous.filter((notificationItem) => notificationItem.id !== id)
        );
      }, duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((previous) =>
      previous.filter((notification) => notification.id !== id)
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const showNotification = addNotification;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        showNotification,
        removeNotification,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
