import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { productAPI, cartAPI, userAPI } from "../../services/api.js";
import { useAuth, useNotification } from "../../context/AppContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import VoiceSearch from "../../components/VoiceSearch.jsx";
import { LocationService } from "../../services/LocationService.js";
import "./buyerdashboard.css";

const BuyerDashboard = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { addNotification } = useNotification();
  const [searchText, setSearchText] = useState("");
  const [locationInfo, setLocationInfo] = useState(null);
  const [locationAddress, setLocationAddress] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nearbyFarmers, setNearbyFarmers] = useState([]);
  const [filters, setFilters] = useState({
    category: "",
    minPrice: "",
    maxPrice: "",
    sortBy: "newest"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadProducts = async (location = null, search = "", page = 1) => {
    setLoading(true);
    setError("");
    try {
      const query = { page, limit: 20 };
      if (search) {
        query.search = search;
      }
      if (location?.latitude && location?.longitude) {
        query.latitude = location.latitude;
        query.longitude = location.longitude;
        query.maxDistance = 20000;
      }
      if (filters.category) query.category = filters.category;
      if (filters.minPrice) query.minPrice = filters.minPrice;
      if (filters.maxPrice) query.maxPrice = filters.maxPrice;
      if (filters.sortBy) query.sortBy = filters.sortBy;

      const data = await productAPI.getAllProducts(query);
      setProducts(data.products || []);
      setTotalPages(data.pages || 1);
      setCurrentPage(data.page || 1);
    } catch (err) {
      setError(err.message || "Unable to fetch products");
    } finally {
      setLoading(false);
    }
  };

  const loadNearbyFarmers = async (location) => {
    if (!location?.latitude || !location?.longitude) return;
    try {
      const farmers = await userAPI.getNearby(location.longitude, location.latitude, 20000, "farmer");
      setNearbyFarmers(farmers.users || []);
    } catch (err) {
      console.error("Unable to fetch nearby farmers:", err);
    }
  };

  useEffect(() => {
    loadProducts(null, searchText);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchText.trim() || locationInfo) {
        loadProducts(locationInfo, searchText);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [searchText, locationInfo]);

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
      addNotification("Product added to cart", "success");
    } catch (err) {
      addNotification(err.message || "Unable to add item to cart", "error");
    }
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
    setCurrentPage(1);
    loadProducts(locationInfo, searchText, 1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    loadProducts(locationInfo, searchText, page);
  };

  return (
    <div className="customer-dashboard-page">
      {/* Top bar */}
      <div className="customer-topbar">
        <div className="customer-topbar-inner">
          <div className="customer-brand">🌱 AgroConnect</div>

          <div className="customer-user-info">
            <span className="customer-greeting">Hi, {user?.firstName || "there"}! 👋</span>
          </div>

          <div className="customer-top-actions">
            <button
              className="icon-btn"
              onClick={() => navigate("/buyer/cart")}
            >
              🛒
            </button>
            <button
              className="logout-btn"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              {t("logout")}
            </button>
          </div>
        </div>
      </div>

      <div className="customer-dashboard-content">
        {/* Search */}
        <div className="search-bar-wrapper">
          <div className="search-bar">
            <select>
              <option>{t("allAreas")}</option>
              <option>{t("nearby")}</option>
              <option>{t("within5km")}</option>
            </select>

            <VoiceSearch
              onSearch={(value) => setSearchText(value)}
              placeholder={t("searchPlaceholder")}
            />
            <button
              className="search-btn"
              onClick={() => loadProducts(locationInfo, searchText)}
            >
              🔍
            </button>
          </div>
          <div className="location-actions">
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
                      : t("currentLocation")
                  );
                  loadProducts(location, searchText);
                  loadNearbyFarmers(location);
                } catch (error) {
                  setLocationInfo({ error: error.message });
                }
              }}
            >
              {t("useMyLocation")}
            </button>
            {locationInfo && (
              <div className="location-status">
                {locationInfo.error ? (
                  `Location error: ${locationInfo.error}`
                ) : (
                  <>
                    <span>{`${t("currentLocation")}: ${locationInfo.latitude.toFixed(3)}, ${locationInfo.longitude.toFixed(3)}`}</span>
                    {locationAddress && <span> · {locationAddress}</span>}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Nearby Farmers */}
        <div className="section-title">📍 {t("nearbyFarmers")}</div>
        <div className="farmer-strip">
          {nearbyFarmers.length > 0 ? (
            nearbyFarmers.slice(0, 5).map((farmer) => (
              <div className="farmer-mini-card" key={farmer._id}>
                <div className="farmer-mini-icon">🌱</div>
                <div className="farmer-mini-info">
                  <h4>{farmer.firstName} {farmer.lastName}</h4>
                  <p>{farmer.address || "Nearby"}</p>
                </div>
                <span className="mini-badge">{farmer.totalProducts || 0} products</span>
              </div>
            ))
          ) : (
            <p className="no-farmers">{t("noNearbyFarmers")}</p>
          )}
        </div>

        {/* Products */}
        <div className="products-header">
          <h3>{t("freshProductsAvailable")}</h3>
          <div className="header-controls">
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange("sortBy", e.target.value)}
              className="sort-select"
            >
              <option value="newest">{t("newestFirst")}</option>
              <option value="price_low">{t("priceLowToHigh")}</option>
              <option value="price_high">{t("priceHighToLow")}</option>
              <option value="rating">{t("highestRated")}</option>
            </select>
            <button className="filter-btn" onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? t("hideFilters") : t("showFilters")}
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="filters-section">
            <div className="filter-row">
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange("category", e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="vegetables">Vegetables</option>
                <option value="fruits">Fruits</option>
                <option value="grains">Grains</option>
                <option value="dairy">Dairy</option>
                <option value="spices">Spices</option>
              </select>
              <input
                type="number"
                placeholder="Min Price"
                value={filters.minPrice}
                onChange={(e) => handleFilterChange("minPrice", e.target.value)}
              />
              <input
                type="number"
                placeholder="Max Price"
                value={filters.maxPrice}
                onChange={(e) => handleFilterChange("maxPrice", e.target.value)}
              />
              <button onClick={() => {
                setFilters({ category: "", minPrice: "", maxPrice: "", sortBy: "newest" });
                setCurrentPage(1);
                loadProducts(locationInfo, searchText, 1);
              }}>Clear Filters</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-state">Loading products...</div>
        ) : error ? (
          <div className="error-state">{error}</div>
        ) : (
          <div className="product-grid">
            {filteredProducts.map((product) => (
              <div className="product-card" key={product._id}>
                <div className="product-image-wrapper">
                  <img
                    src={product.mainImage || product.images?.[0]?.url || "https://via.placeholder.com/300"}
                    alt={product.name}
                  />
                  <div className="rating-badge">⭐ {product.rating || "4.5"}</div>
                </div>

                <div className="product-card-body">
                  <h4>{product.name}</h4>
                  <p className="farmer-line">🌱 {product.sellerName || product.seller?.firstName || "Local Farmer"}</p>
                  <p className="distance-line">📍 {product.address || "Nearby"}</p>

                  <div className="product-meta">
                    <span className="product-price">₹{product.price}/kg</span>
                    <span className="product-stock">{product.quantity || "In Stock"} kg</span>
                  </div>

                  <button className="add-cart-btn" onClick={() => handleAddToCart(product._id)}>
                    🛒 Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}

        {/* Price comparison - remove hardcoded table */}
        {products.length > 0 && (
          <div className="comparison-box">
            <h3>Market Insights</h3>
            <p>Compare prices across different farmers and find the best deals!</p>
            <div className="market-stats">
              <div className="stat-item">
                <span className="stat-label">Products Available:</span>
                <span className="stat-value">{products.length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Average Price:</span>
                <span className="stat-value">
                  ₹{Math.round(products.reduce((sum, p) => sum + p.price, 0) / products.length) || 0}/kg
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyerDashboard;