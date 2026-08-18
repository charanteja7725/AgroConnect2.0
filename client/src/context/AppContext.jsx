import React, {
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { authAPI } from "../services/api.js";

import {
  AuthContext,
  CartContext,
  LocationContext,
  NotificationContext,
} from "./ContextDefinitions.js";

// ======================================================
// CUSTOM HOOKS
// ======================================================

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};

export const useCart = () => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
};

export const useLocation = () => {
  const context = useContext(LocationContext);

  if (!context) {
    throw new Error("useLocation must be used inside LocationProvider");
  }

  return context;
};

export const useNotification = () => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotification must be used inside NotificationProvider"
    );
  }

  return context;
};

// ======================================================
// AUTH PROVIDER
// ======================================================

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("agroconnect_user");

      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      console.error("Failed to parse saved user:", error);

      localStorage.removeItem("agroconnect_user");

      return null;
    }
  });

  const [token, setToken] = useState(
    () => localStorage.getItem("token") || null
  );

  const [loading, setLoading] = useState(false);

  // ----------------------------------------------------
  // Login
  // ----------------------------------------------------

  const login = useCallback((userData, authToken) => {
    setUser(userData);
    setToken(authToken);

    if (authToken) {
      localStorage.setItem("token", authToken);
    }

    if (userData) {
      localStorage.setItem(
        "agroconnect_user",
        JSON.stringify(userData)
      );
    }
  }, []);

  // ----------------------------------------------------
  // Logout
  // ----------------------------------------------------

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);

    localStorage.removeItem("token");
    localStorage.removeItem("agroconnect_user");
  }, []);

  // ----------------------------------------------------
  // Update user
  // ----------------------------------------------------

  const updateUser = useCallback((updatedData) => {
    setUser((previousUser) => {
      const updatedUser = {
        ...(previousUser || {}),
        ...updatedData,
      };

      localStorage.setItem(
        "agroconnect_user",
        JSON.stringify(updatedUser)
      );

      return updatedUser;
    });
  }, []);

  // ----------------------------------------------------
  // Load current logged-in user
  // ----------------------------------------------------

  useEffect(() => {
    const loadCurrentUser = async () => {
      if (!token || user) {
        return;
      }

      setLoading(true);

      try {
        const data = await authAPI.getMe();

        if (data?.success && data?.user) {
          setUser(data.user);

          localStorage.setItem(
            "agroconnect_user",
            JSON.stringify(data.user)
          );
        } else if (data?.user) {
          // Supports APIs that return { user: ... }
          // without a success property
          setUser(data.user);

          localStorage.setItem(
            "agroconnect_user",
            JSON.stringify(data.user)
          );
        } else {
          logout();
        }
      } catch (error) {
        console.error("Failed to load current user:", error);

        logout();
      } finally {
        setLoading(false);
      }
    };

    loadCurrentUser();
  }, [token, user, logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        setLoading,
        login,
        logout,
        updateUser,
        isAuthenticated: Boolean(token && user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ======================================================
// CART PROVIDER
// ======================================================

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

  // ----------------------------------------------------
  // Add item to cart
  // ----------------------------------------------------

  const addToCart = useCallback((product) => {
    setCart((previousCart) => {
      // Support both MongoDB _id and normal id
      const productId = product?._id || product?.id;

      const existingItem = previousCart.find(
        (item) => (item?._id || item?.id) === productId
      );

      let updatedCart;

      if (existingItem) {
        updatedCart = previousCart.map((item) => {
          const itemId = item?._id || item?.id;

          if (itemId === productId) {
            return {
              ...item,
              quantity:
                (item.quantity || 1) +
                (product.quantity || 1),
            };
          }

          return item;
        });
      } else {
        updatedCart = [
          ...previousCart,
          {
            ...product,
            quantity: product.quantity || 1,
          },
        ];
      }

      localStorage.setItem(
        "agroconnect_cart",
        JSON.stringify(updatedCart)
      );

      return updatedCart;
    });
  }, []);

  // ----------------------------------------------------
  // Remove item
  // ----------------------------------------------------

  const removeFromCart = useCallback((productId) => {
    setCart((previousCart) => {
      const updatedCart = previousCart.filter(
        (item) =>
          (item?._id || item?.id) !== productId
      );

      localStorage.setItem(
        "agroconnect_cart",
        JSON.stringify(updatedCart)
      );

      return updatedCart;
    });
  }, []);

  // ----------------------------------------------------
  // Update quantity
  // ----------------------------------------------------

  const updateQuantity = useCallback(
    (productId, quantity) => {
      const newQuantity = Number(quantity);

      setCart((previousCart) => {
        let updatedCart;

        // Remove product if quantity <= 0
        if (newQuantity <= 0) {
          updatedCart = previousCart.filter(
            (item) =>
              (item?._id || item?.id) !== productId
          );
        } else {
          updatedCart = previousCart.map((item) =>
            (item?._id || item?.id) === productId
              ? {
                  ...item,
                  quantity: newQuantity,
                }
              : item
          );
        }

        localStorage.setItem(
          "agroconnect_cart",
          JSON.stringify(updatedCart)
        );

        return updatedCart;
      });
    },
    []
  );

  // ----------------------------------------------------
  // Clear cart
  // ----------------------------------------------------

  const clearCart = useCallback(() => {
    setCart([]);

    localStorage.removeItem("agroconnect_cart");
  }, []);

  // ----------------------------------------------------
  // Total price
  // ----------------------------------------------------

  const getTotalPrice = useCallback(() => {
    return cart.reduce((total, item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;

      return total + price * quantity;
    }, 0);
  }, [cart]);

  // ----------------------------------------------------
  // Total item count
  // ----------------------------------------------------

  const getTotalItems = useCallback(() => {
    return cart.reduce((total, item) => {
      return total + (Number(item.quantity) || 0);
    }, 0);
  }, [cart]);

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

// ======================================================
// LOCATION PROVIDER
// ======================================================

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(null);

  const [nearbyUsers, setNearbyUsers] = useState([]);

  const [loading, setLoading] = useState(false);

  const [locationError, setLocationError] =
    useState(null);

  // ----------------------------------------------------
  // Get browser location
  // ----------------------------------------------------

  const getLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = new Error(
          "Geolocation is not supported by this browser."
        );

        setLocationError(error.message);

        reject(error);

        return;
      }

      setLoading(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const {
            latitude,
            longitude,
          } = position.coords;

          const currentLocation = {
            latitude,
            longitude,
          };

          setLocation(currentLocation);
          setLoading(false);

          resolve(currentLocation);
        },

        (error) => {
          console.error(
            "Failed to get location:",
            error
          );

          setLoading(false);
          setLocationError(
            error.message ||
              "Unable to get your location."
          );

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

// ======================================================
// NOTIFICATION PROVIDER
// ======================================================

export const NotificationProvider = ({
  children,
}) => {
  const [notifications, setNotifications] =
    useState([]);

  // ----------------------------------------------------
  // Add notification
  // ----------------------------------------------------

  const addNotification = useCallback(
    (
      message,
      type = "info",
      duration = 3000
    ) => {
      const id =
        Date.now() +
        Math.random().toString(36).slice(2);

      const notification = {
        id,
        message,
        type,
      };

      setNotifications((previous) => [
        ...previous,
        notification,
      ]);

      if (duration > 0) {
        setTimeout(() => {
          setNotifications((previous) =>
            previous.filter(
              (notificationItem) =>
                notificationItem.id !== id
            )
          );
        }, duration);
      }

      return id;
    },
    []
  );

  // ----------------------------------------------------
  // Remove notification manually
  // ----------------------------------------------------

  const removeNotification = useCallback(
    (id) => {
      setNotifications((previous) =>
        previous.filter(
          (notification) =>
            notification.id !== id
        )
      );
    },
    []
  );

  // ----------------------------------------------------
  // Clear notifications
  // ----------------------------------------------------

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Alias for pages that might use showNotification()
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