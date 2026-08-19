import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cartAPI, orderAPI, productAPI } from "../../services/api.js";
import { useAuth, useNotification } from "../../context/AppHooks.js";
import VoiceSearch from "../../components/VoiceSearch.jsx";
import { LocationService } from "../../services/LocationService.js";
import "./buyerdashboard.css";

const BuyerDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
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
  const [cartCount, setCartCount] = useState(0);

  const loadCartCount = useCallback(async () => {
    try {
      const response = await cartAPI.getCart();
      const quantity = (response.cart?.items || []).reduce(
        (sum, item) => sum + (Number(item.quantity) || 0),
        0
      );
      setCartCount(quantity);
    } catch (err) {
      console.warn("Unable to load cart count:", err);
    }
  }, []);

  const loadProducts = useCallback(
    async (location = null, search = "") => {
      setLoading(true);
      setError("");

      try {
        const query = {};
        if (search.trim()) query.search = search.trim();
        if (productType !== "all") query.type = productType;

        const hasLocation =
          Number.isFinite(Number(location?.latitude)) &&
          Number.isFinite(Number(location?.longitude));

        if (hasLocation && locationFilter !== "all") {
          query.latitude = Number(location.latitude);
          query.longitude = Number(location.longitude);
          query.maxDistance = locationFilter === "within5" ? 5000 : 20000;
        }

        const data = await productAPI.getAllProducts(query);
        setProducts(data.products || []);
      } catch (err) {
        setError(err.message || "Unable to fetch products");
      } finally {
        setLoading(false);
      }
    },
    [locationFilter, productType]
  );

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const response = await orderAPI.getOrders();
      setOrders(response.orders || []);
    } catch (err) {
      setOrdersError(err.message || "Unable to fetch orders");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCartCount();
  }, [loadCartCount]);

  useEffect(() => {
    if (activeTab === "orders") loadOrders();
  }, [activeTab, loadOrders]);

  // One debounced marketplace fetch replaces the previous two overlapping
  // product-fetch effects, avoiding duplicate requests on each search change.
  useEffect(() => {
    if (activeTab !== "marketplace") return undefined;

    const timer = setTimeout(() => {
      loadProducts(locationInfo, searchText);
    }, 300);

    return () => clearTimeout(timer);
  }, [activeTab, loadProducts, locationInfo, searchText]);

  const filteredProducts = useMemo(() => products, [products]);

  const handleAddToCart = async (product) => {
    try {
      const productId = product?._id || product?.id;
      if (!productId) throw new Error("Invalid product");
      if (!product.isActive || !product.inStock || Number(product.quantity) <= 0) {
        throw new Error("This product is currently unavailable");
      }

      const response = await cartAPI.addToCart(productId, 1);
      const quantity = (response.cart?.items || []).reduce(
        (sum, item) => sum + (Number(item.quantity) || 0),
        0
      );
      setCartCount(quantity);
      addNotification?.(`${product.name} added to cart`, "success");
    } catch (err) {
      addNotification?.(err.message || "Unable to add item to cart", "error");
    }
  };

  const getDistanceLabel = (product) => {
    const coords = product.location?.coordinates;
    if (
      Number.isFinite(Number(locationInfo?.latitude)) &&
      Number.isFinite(Number(locationInfo?.longitude)) &&
      Array.isArray(coords) &&
      coords.length === 2 &&
      Number(coords[0]) !== 0 &&
      Number(coords[1]) !== 0
    ) {
      return `${LocationService.calculateDistance(
        Number(locationInfo.latitude),
        Number(locationInfo.longitude),
        Number(coords[1]),
        Number(coords[0])
      )} km away`;
    }
    return null;
  };

  const resolveLocationForSearch = async () => {
    if (
      Number.isFinite(Number(locationInfo?.latitude)) &&
      Number.isFinite(Number(locationInfo?.longitude))
    ) {
      return locationInfo;
    }

    const location = await LocationService.getCurrentLocation();
    setLocationInfo(location);

    const address = await LocationService.reverseGeocode(
      location.latitude,
      location.longitude
    );
    setLocationAddress(
      address
        ? [address.city || address.town || address.village, address.state]
            .filter(Boolean)
            .join(", ")
        : "Current location"
    );

    return location;
  };

  const handleLocationFilterChange = async (value) => {
    setLocationFilter(value);
    if (value === "all") return;

    try {
      await resolveLocationForSearch();
    } catch (err) {
      setError(err.message || "Unable to retrieve location");
    }
  };

  return (
    <div className="farmer-portal-container">
      <header className="farmer-navbar">
        <div className="navbar-left">
          <div
            className="brand-logo"
            onClick={() => {
              setActiveTab("marketplace");
              navigate("/buyer");
            }}
          >
            <span className="brand-leaf">🌱</span>
            <span className="brand-title">AgroConnect</span>
            <span className="portal-badge">Buyer Marketplace</span>
          </div>
        </div>

        <div className="navbar-right">
          <button className="navbar-btn-market" onClick={() => navigate("/fertilizer-store")}>
            🧪 Fertilizer Store
          </button>
          <button
            className={`navbar-btn-market ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            📋 My Orders
          </button>
          <button className="navbar-cart-btn" onClick={() => navigate("/buyer/cart")}>
            🛒 {cartCount > 0 && <span className="cart-count-badge">{cartCount}</span>} Cart
          </button>
          <div className="user-profile-menu">
            <div className="avatar-circle">{user?.firstName?.[0] || "B"}</div>
            <span className="user-name-display">{user?.firstName || "Buyer"}</span>
            <button
              className="btn-logout"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      <div className="farmer-main-content" style={{ margin: "0 auto" }}>
        <div className="welcome-banner-card">
          <div className="banner-text">
            {activeTab === "orders" ? (
              <>
                <h2>My Orders 📋</h2>
                <p>Track your orders, payments, and current fulfilment status.</p>
              </>
            ) : (
              <>
                <h2>Fresh Farm & Agriculture Marketplace 🌾</h2>
                <p>Buy produce from verified farmers and farm inputs from fertilizer sellers.</p>
              </>
            )}
          </div>
          {activeTab === "orders" ? (
            <button className="banner-primary-btn" onClick={() => setActiveTab("marketplace")}>
              ← Back to Marketplace
            </button>
          ) : (
            <button className="banner-primary-btn" onClick={() => navigate("/fertilizer-store")}>
              Browse Fertilizer Store →
            </button>
          )}
        </div>

        {activeTab === "orders" ? (
          <div className="dashboard-section-card">
            <div className="section-card-header">
              <div><h3>Order History</h3><p className="subtext">Orders placed from this buyer account</p></div>
            </div>

            {ordersLoading ? (
              <div className="loading-state"><div className="spinner"></div><p>Loading your orders...</p></div>
            ) : ordersError ? (
              <div className="error-banner">{ordersError}</div>
            ) : orders.length === 0 ? (
              <div className="empty-state-box">
                <div className="empty-icon">📦</div>
                <h4>No Orders Yet</h4>
                <p>Start shopping in the marketplace.</p>
                <button className="btn-primary-action" onClick={() => setActiveTab("marketplace")}>
                  Browse Products →
                </button>
              </div>
            ) : (
              <div className="orders-list">
                {orders.map((order) => (
                  <div key={order._id} className="farmer-order-card">
                    <div className="order-card-header">
                      <div>
                        <span className="order-id">Order #{order.orderNumber || order._id?.substring(0, 8)}</span>
                        <span className="order-date">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "Recent"}
                        </span>
                      </div>
                      <span className={`status-pill status-${order.status || "pending"}`}>
                        {order.status || "pending"}
                      </span>
                    </div>

                    <div className="order-card-body">
                      {order.items?.map((item, index) => (
                        <div
                          key={item._id || index}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "6px 0",
                            borderBottom: "1px solid #f1f5f9",
                            fontSize: "14px",
                          }}
                        >
                          <span>🌿 {item.productName || "Product"} × {item.quantity}</span>
                          <span style={{ fontWeight: 600, color: "#16a34a" }}>
                            ₹{item.totalPrice || item.price * item.quantity || 0}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="order-card-footer">
                      <span style={{ fontWeight: 700 }}>Total: ₹{order.totalAmount || 0}</span>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        Payment: {order.payment?.method?.replace(/_/g, " ") || "N/A"} —{" "}
                        {order.payment?.status || "pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="dashboard-section-card">
              <div className="search-bar-wrapper">
                <div className="buyer-search-controls">
                  <div className="voice-search-container">
                    <VoiceSearch
                      onSearch={(value) => setSearchText(value)}
                      placeholder="🔍 Search products, crops, fertilizers..."
                    />
                  </div>
                  <button
                    className="btn-primary-action"
                    onClick={() => loadProducts(locationInfo, searchText)}
                  >
                    Search
                  </button>
                </div>

                <div className="location-actions-bar" style={{ flexWrap: "wrap", gap: "10px", marginTop: "10px" }}>
                  <select
                    className="filter-select"
                    value={productType}
                    onChange={(event) => setProductType(event.target.value)}
                  >
                    <option value="all">📦 All Types</option>
                    <option value="produce">🥦 Fresh Produce</option>
                    <option value="fertilizer">🧪 Fertilizers & Seeds</option>
                  </select>

                  <select
                    className="filter-select"
                    value={locationFilter}
                    onChange={(event) => handleLocationFilterChange(event.target.value)}
                  >
                    <option value="all">🌍 All Locations</option>
                    <option value="nearby">📍 Within 20 km</option>
                    <option value="within5">📍 Within 5 km</option>
                  </select>

                  <button
                    className="location-btn"
                    onClick={async () => {
                      try {
                        await resolveLocationForSearch();
                      } catch (err) {
                        setError(err.message || "Unable to get current GPS location");
                      }
                    }}
                  >
                    📍 Use My GPS Location
                  </button>

                  {locationInfo && (
                    <span className="location-hint">
                      {locationAddress ||
                        `Near ${Number(locationInfo.latitude).toFixed(3)}, ${Number(locationInfo.longitude).toFixed(3)}`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="dashboard-section-card">
              <div className="section-card-header">
                <div><h3>Available Marketplace Listings</h3><p className="subtext">Active listings from farmers and fertilizer sellers</p></div>
              </div>

              {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>Loading marketplace listings...</p></div>
              ) : error ? (
                <div className="error-banner">{error}</div>
              ) : filteredProducts.length === 0 ? (
                <div className="empty-state-box"><div className="empty-icon">🌾</div><h4>No Products Found</h4><p>Try another search or location filter.</p></div>
              ) : (
                <div className="products-grid">
                  {filteredProducts.map((product) => {
                    const distance = getDistanceLabel(product);
                    return (
                      <div className="farmer-product-card" key={product._id}>
                        <div className="product-card-thumb">
                          {product.mainImage || product.images?.[0]?.url ? (
                            <img src={product.mainImage || product.images?.[0]?.url} alt={product.name} />
                          ) : (
                            <div className="no-image-fallback"><span>🌱</span></div>
                          )}
                          <span className="stock-badge in-stock">
                            {Number(product.rating) > 0 ? `⭐ ${Number(product.rating).toFixed(1)}` : "New"}
                          </span>
                        </div>

                        <div className="product-card-content">
                          <div className="product-category-tag">
                            {product.type === "fertilizer" ? "🧪 Fertilizer" : "🌱 Produce"}
                          </div>
                          <h4 className="product-title">{product.name}</h4>
                          <p className="subtext">
                            Seller: <strong>{product.sellerName || product.seller?.firstName || "Seller"}</strong>
                          </p>
                          <p className="subtext">📍 {product.address || "Location available from seller"}</p>
                          {distance && <p className="subtext" style={{ color: "#16a34a", fontWeight: 600 }}>📏 {distance}</p>}

                          <div style={{ marginTop: "12px" }}>
                            <span className="product-price-tag">₹{product.price}</span>
                            <span className="unit-text"> / {product.unit || "kg"}</span>
                            <span style={{ float: "right", fontSize: "12px", color: "#64748b" }}>
                              Stock: {product.quantity || 0} {product.unit || "kg"}
                            </span>
                          </div>

                          <div className="product-card-actions" style={{ marginTop: "14px" }}>
                            <button
                              className="btn-primary-action"
                              style={{ width: "100%", padding: "10px" }}
                              disabled={Number(product.quantity) <= 0 || !product.inStock}
                              onClick={() => handleAddToCart(product)}
                            >
                              🛒 {Number(product.quantity) > 0 ? "Add to Cart" : "Out of Stock"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
