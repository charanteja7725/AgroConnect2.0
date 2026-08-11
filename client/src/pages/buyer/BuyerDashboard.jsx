import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { productAPI, cartAPI } from "../../services/api.js";
import { useAuth, useCart, useNotification } from "../../context/AppHooks.js";
import VoiceSearch from "../../components/VoiceSearch.jsx";
import { LocationService } from "../../services/LocationService.js";
import "./buyerdashboard.css";

const BuyerDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { cart, getTotalItems } = useCart();
  const { addNotification } = useNotification();
  const [searchText, setSearchText] = useState("");
  const [locationInfo, setLocationInfo] = useState(null);
  const [locationAddress, setLocationAddress] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [productType, setProductType] = useState("all");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadProducts = useCallback(async (location = null, search = "") => {
    setLoading(true);
    setError("");
    try {
      const query = {};
      if (search) {
        query.search = search;
      }
      if (productType && productType !== "all") {
        query.type = productType;
      }
      if (location?.latitude && location?.longitude && locationFilter !== "all") {
        query.latitude = location.latitude;
        query.longitude = location.longitude;
        query.maxDistance = locationFilter === "within5" ? 5000 : 20000;
      }
      const data = await productAPI.getAllProducts(query);
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message || "Unable to fetch products");
    } finally {
      setLoading(false);
    }
  }, [locationFilter, productType]);

  useEffect(() => {
    loadProducts(null, searchText);
  }, [loadProducts, searchText]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchText.trim() || locationInfo) {
        loadProducts(locationInfo, searchText);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [loadProducts, searchText, locationInfo, productType, locationFilter]);

  const filteredProducts = useMemo(() => {
    if (!searchText) return products;
    const lowerSearch = searchText.toLowerCase();
    return products.filter(
      (product) =>
        product.name?.toLowerCase().includes(lowerSearch) ||
        product.category?.toLowerCase().includes(lowerSearch) ||
        product.sellerName?.toLowerCase().includes(lowerSearch)
    );
  }, [products, searchText]);

  const handleAddToCart = async (productId) => {
    try {
      await cartAPI.addToCart(productId, 1);
      if (addNotification) addNotification("Product added to cart", "success");
    } catch (err) {
      if (addNotification) addNotification(err.message || "Unable to add item to cart", "error");
    }
  };

  const getDistanceLabel = (product) => {
    const coords = product.location?.coordinates;
    if (
      locationInfo?.latitude &&
      locationInfo?.longitude &&
      Array.isArray(coords) &&
      coords.length === 2 &&
      coords[0] !== 0 &&
      coords[1] !== 0
    ) {
      return `${LocationService.calculateDistance(
        locationInfo.latitude,
        locationInfo.longitude,
        coords[1],
        coords[0]
      )} km away`;
    }
    return null;
  };

  const resolveLocationForSearch = async () => {
    if (locationInfo?.latitude && locationInfo?.longitude) {
      return locationInfo;
    }

    const location = await LocationService.getCurrentLocation();
    setLocationInfo(location);

    const address = await LocationService.reverseGeocode(location.latitude, location.longitude);
    setLocationAddress(
      address
        ? `${address.city || address.town || address.village || ""}, ${address.state || ""}`.trim()
        : "Current location"
    );

    return location;
  };

  const handleLocationFilterChange = async (value) => {
    setLocationFilter(value);
    if (value === "all") {
      loadProducts(locationInfo, searchText);
      return;
    }

    try {
      const location = await resolveLocationForSearch();
      loadProducts(location, searchText);
    } catch (error) {
      setError(error.message || "Unable to retrieve location");
    }
  };

  const cartCount = getTotalItems ? getTotalItems() : cart.length;

  return (
    <div className="farmer-portal-container">
      {/* Topbar */}
      <header className="farmer-navbar">
        <div className="navbar-left">
          <div className="brand-logo" onClick={() => navigate("/buyer")}>
            <span className="brand-leaf">🌱</span>
            <span className="brand-title">AgroConnect</span>
            <span className="portal-badge">Buyer Marketplace</span>
          </div>
        </div>

        <div className="navbar-right">
          <button
            className="navbar-btn-market"
            onClick={() => navigate("/fertilizer-store")}
          >
            🧪 Fertilizer Store
          </button>

          <button
            className="navbar-btn-add"
            onClick={() => navigate("/buyer/cart")}
          >
            🛒 Cart ({cartCount})
          </button>

          <div className="user-profile-menu">
            <div className="avatar-circle">
              {user?.firstName?.[0] || "B"}
            </div>
            <span className="user-name-display">{user?.firstName || "Buyer"}</span>
            <button
              className="btn-logout"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              title="Logout"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      <div className="farmer-main-content" style={{ margin: "0 auto" }}>
        {/* Banner */}
        <div className="welcome-banner-card">
          <div className="banner-text">
            <h2>Fresh Farm Crops & Agriculture Market 🌾</h2>
            <p>Directly purchase fresh produce and fertilizers from verified local sellers.</p>
          </div>
          <button
            className="banner-primary-btn"
            onClick={() => navigate("/fertilizer-store")}
          >
            Browse Fertilizer Store →
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="dashboard-section-card">
          <div className="search-bar-wrapper">
            <div className="buyer-search-controls">
              <select
                className="filter-select"
                value={locationFilter}
                onChange={(e) => handleLocationFilterChange(e.target.value)}
              >
                <option value="all">📍 All Locations</option>
                <option value="nearby">📍 Nearby Sellers</option>
                <option value="within5">📍 Within 5 km</option>
              </select>

              <select
                className="filter-select"
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
              >
                <option value="all">📦 All Product Types</option>
                <option value="produce">🥦 Fresh Produce</option>
                <option value="fertilizer">🧪 Fertilizers & Seeds</option>
              </select>

              <div className="voice-search-container">
                <VoiceSearch
                  onSearch={(value) => setSearchText(value)}
                  placeholder="Search products, crops, fertilizers..."
                />
              </div>

              <button
                className="btn-primary-action"
                onClick={() => loadProducts(locationInfo, searchText)}
              >
                🔍 Search
              </button>
            </div>

            <div className="location-actions-bar">
              <button
                className="location-btn"
                onClick={async () => {
                  try {
                    const location = await LocationService.getCurrentLocation();
                    setLocationInfo(location);
                    const address = await LocationService.reverseGeocode(location.latitude, location.longitude);
                    setLocationAddress(
                      address
                        ? `${address.city || address.town || address.village || ""}, ${address.state || ""}`.trim()
                        : "Current location"
                    );
                    loadProducts(location, searchText);
                  } catch (err) {
                    setError(err.message || "Unable to get current GPS location");
                  }
                }}
              >
                📍 Use My GPS Location
              </button>
              {locationInfo && (
                <span className="location-hint">
                  {locationAddress
                    ? `Showing items near ${locationAddress}`
                    : `Near ${locationInfo.latitude?.toFixed(3)}, ${locationInfo.longitude?.toFixed(3)}`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="dashboard-section-card">
          <div className="section-card-header">
            <div>
              <h3>Available Marketplace Listings</h3>
              <p className="subtext">Direct listings from farmers & authorized sellers</p>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading fresh marketplace listings...</p>
            </div>
          ) : error ? (
            <div className="error-banner">{error}</div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state-box">
              <div className="empty-icon">🌾</div>
              <h4>No Products Found</h4>
              <p>Try searching for a different crop name or clearing location filters.</p>
            </div>
          ) : (
            <div className="products-grid">
              {filteredProducts.map((product) => (
                <div className="farmer-product-card" key={product._id}>
                  <div className="product-card-thumb">
                    <img
                      src={product.mainImage || product.images?.[0]?.url || "https://via.placeholder.com/300"}
                      alt={product.name}
                    />
                    <span className="stock-badge in-stock">
                      ⭐ {product.rating || "4.8"}
                    </span>
                  </div>

                  <div className="product-card-content">
                    <div className="product-category-tag">{product.type === "fertilizer" ? "🧪 Fertilizer" : "🌱 Produce"}</div>
                    <h4 className="product-title">{product.name}</h4>
                    <p className="subtext">
                      Seller: <strong>{product.sellerName || product.seller?.firstName || "Local Seller"}</strong>
                    </p>
                    <p className="subtext">📍 {product.address || "Local Farm"}</p>
                    {getDistanceLabel(product) && (
                      <p className="subtext" style={{ color: "#16a34a", fontWeight: 600 }}>📏 {getDistanceLabel(product)}</p>
                    )}

                    <div style={{ marginTop: "12px" }}>
                      <span className="product-price-tag">₹{product.price}</span>
                      <span className="unit-text"> / {product.unit || "kg"}</span>
                      <span style={{ float: "right", fontSize: "12px", color: "#64748b" }}>Stock: {product.quantity || 0} {product.unit || "kg"}</span>
                    </div>

                    <div className="product-card-actions" style={{ marginTop: "14px" }}>
                      <button
                        className="btn-primary-action"
                        style={{ width: "100%", padding: "10px" }}
                        onClick={() => handleAddToCart(product._id)}
                      >
                        🛒 Add to Cart
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuyerDashboard;