import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { productAPI, orderAPI } from "../../services/api.js";
import { useAuth, useCart, useNotification } from "../../context/AppHooks.js";
import VoiceSearch from "../../components/VoiceSearch.jsx";
import { LocationService } from "../../services/LocationService.js";
import "./buyerdashboard.css";

const BuyerDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { cart, getTotalItems, addToCart } = useCart();
  const { addNotification } = useNotification();
  const [activeTab, setActiveTab] = useState("marketplace");
  const [searchText, setSearchText] = useState("");
  const [locationInfo, setLocationInfo] = useState(null);
  const [locationAddress, setLocationAddress] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [productType, setProductType] = useState("all");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");

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

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const res = await orderAPI.getOrders();
      setOrders(res.orders || []);
    } catch (err) {
      setOrdersError(err.message || "Unable to fetch orders");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts(null, searchText);
  }, [loadProducts, searchText]);

  useEffect(() => {
    if (activeTab === "orders") {
      loadOrders();
    }
  }, [activeTab, loadOrders]);

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

  const handleAddToCart = async (product) => {
    try {
      const productId = typeof product === "string" ? product : (product._id || product.id);
      await addToCart(productId, 1);
      if (addNotification) addNotification("Product added to cart! 🛒", "success");
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
          <div className="brand-logo" onClick={() => { setActiveTab("marketplace"); navigate("/buyer"); }}>
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
            className={`navbar-btn-market ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
            style={{ background: activeTab === "orders" ? "#16a34a" : undefined }}
          >
            📋 My Orders
          </button>

          <button
            className="navbar-cart-btn"
            onClick={() => navigate("/buyer/cart")}
            title="View Cart"
          >
            🛒 <span className="cart-count-badge">{getTotalItems() > 0 ? getTotalItems() : ""}</span> Cart
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
            {activeTab === "orders" ? (
              <><h2>My Orders 📋</h2><p>Track your placed orders and their current delivery status.</p></>
            ) : (
              <><h2>Fresh Farm Crops & Agriculture Market 🌾</h2><p>Directly purchase fresh produce and fertilizers from verified local sellers.</p></>
            )}
          </div>
          {activeTab === "marketplace" && (
            <button
              className="banner-primary-btn"
              onClick={() => navigate("/fertilizer-store")}
            >
              Browse Fertilizer Store →
            </button>
          )}
          {activeTab === "orders" && (
            <button
              className="banner-primary-btn"
              onClick={() => setActiveTab("marketplace")}
            >
              ← Back to Marketplace
            </button>
          )}
        </div>

        {/* My Orders Tab */}
        {activeTab === "orders" && (
          <div className="dashboard-section-card">
            <div className="section-card-header">
              <h3>Order History</h3>
              <p className="subtext">All orders you have placed on AgroConnect</p>
            </div>
            {ordersLoading ? (
              <div className="loading-state"><div className="spinner"></div><p>Loading your orders...</p></div>
            ) : ordersError ? (
              <div className="error-banner">{ordersError}</div>
            ) : orders.length === 0 ? (
              <div className="empty-state-box">
                <div className="empty-icon">📦</div>
                <h4>No Orders Yet</h4>
                <p>You haven't placed any orders. Start shopping in the marketplace!</p>
                <button className="btn-primary-action" onClick={() => setActiveTab("marketplace")}>Browse Products →</button>
              </div>
            ) : (
              <div className="orders-list">
                {orders.map((order) => (
                  <div key={order._id} className="farmer-order-card">
                    <div className="order-card-header">
                      <div>
                        <span className="order-id">Order #{order._id?.substring(0, 8)}</span>
                        <span className="order-date">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Recent"}
                        </span>
                      </div>
                      <span className={`status-pill status-${order.status || "pending"}`}>
                        {order.status || "pending"}
                      </span>
                    </div>
                    <div className="order-card-body">
                      {order.items?.map((item, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: "14px" }}>
                          <span>🌿 {item.productName || "Product"} × {item.quantity}</span>
                          <span style={{ fontWeight: 600, color: "#16a34a" }}>₹{item.totalPrice || (item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="order-card-footer">
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>Total: ₹{order.totalAmount}</span>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>Payment: {order.payment?.method?.replace(/_/g, " ") || "N/A"} — {order.payment?.status || "pending"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "marketplace" && (
          <>


        {/* Search & Filter Bar */}
        <div className="dashboard-section-card">
          <div className="search-bar-wrapper">
            {/* Main search row: VoiceSearch + Search button only */}
            <div className="buyer-search-controls">
              <div className="voice-search-container">
                <VoiceSearch
                  onSearch={(value) => setSearchText(value)}
                  placeholder="🔍 Search products, crops, fertilizers..."
                />
              </div>

              <button
                className="btn-primary-action"
                style={{ whiteSpace: "nowrap", padding: "12px 20px", borderRadius: "12px" }}
                onClick={() => loadProducts(locationInfo, searchText)}
              >
                Search
              </button>
            </div>

            {/* Secondary filter row */}
            <div className="location-actions-bar" style={{ flexWrap: "wrap", gap: "10px", marginTop: "10px" }}>
              <select
                className="filter-select"
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                style={{ flex: "none" }}
              >
                <option value="all">📦 All Types</option>
                <option value="produce">🥦 Fresh Produce</option>
                <option value="fertilizer">🧪 Fertilizers & Seeds</option>
              </select>

              <select
                className="filter-select"
                value={locationFilter}
                onChange={(e) => handleLocationFilterChange(e.target.value)}
                style={{ flex: "none" }}
              >
                <option value="all">🌍 All Locations</option>
                <option value="nearby">📍 Nearby Sellers</option>
                <option value="within5">📍 Within 5 km</option>
              </select>

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
                          onClick={() => handleAddToCart(product)}
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
          </>
        )}
      </div>
    </div>
  );
};

export default BuyerDashboard;