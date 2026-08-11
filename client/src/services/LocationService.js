// Location utilities for AgroConnect
export const LocationService = {
  // Get current user location
  getCurrentLocation: () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          resolve({ latitude, longitude, accuracy });
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  },

  // Watch location changes in real-time
  watchLocation: (callback, onError) => {
    if (!navigator.geolocation) {
      onError(new Error("Geolocation not supported"));
      return null;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        callback({ latitude, longitude, accuracy });
      },
      (error) => {
        onError(error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return watchId;
  },

  // Stop watching location
  stopWatching: (watchId) => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
  },

  // Calculate distance between two coordinates (in km)
  calculateDistance: (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
  },

  // Get location permissions status
  getPermissionStatus: async () => {
    if (!navigator.permissions || !navigator.permissions.query) {
      return "unknown";
    }

    try {
      const result = await navigator.permissions.query({ name: "geolocation" });
      return result.state;
    } catch (err) {
      return "unknown";
    }
  },

  // Format coordinates for display
  formatCoordinates: (lat, lon) => {
    return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  },

  // Reverse geocoding using OpenStreetMap (free)
  reverseGeocode: async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      const data = await response.json();
      return data.address || null;
    } catch (err) {
      console.error("Reverse geocoding error:", err);
      return null;
    }
  },
};

export default LocationService;
