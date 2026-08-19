import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cartAPI, productAPI } from "../../services/api.js";
import { LocationService } from "../../services/LocationService.js";
import { useAuth, useNotification } from "../../context/AppHooks.js";
import "../buyer/buyerdashboard.css";

const FertilizerStore = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locationInfo, setLocationInfo] = useState(null);
  const [locationAddress, setLocationAddress] = useState("");
  const [searchText, setSearchText] = useState("");
  const [cartCount, setCartCount] = useState(0);

  const homePath = user?.role === "farmer" ? "/farmer" : "/buyer";

  const refreshCartCount = useCallback(async () => {
    try {
      const response = await cartAPI.getCart();
      setCartCount(
        (response.cart?.items || []).reduce(
          (sum, item) => sum + (Number(item.quantity) || 0),
          0
        )
      );
    } catch (err) {
      console.warn("Unable to load cart count:", err);
    }
  }, []);

  const loadFertilizers = useCallback(async (location, search) => {
    setLoading(true);
    setError("");

    try {
      const filters = { type: "fertilizer" };
      if (String(search || "").trim()) filters.search = String(search).trim();

      if (
        Number.isFinite(Number(location?.latitude)) &&
        Number.isFinite(Number(location?.longitude))
      ) {
        filters.latitude = Number(location.latitude);
        filters.longitude = Number(location.longitude);
        filters.maxDistance = 50000;
      }

      const response = await productAPI.getAllProducts(filters);
      setProducts(response.products || []);
    } catch (err) {
      setError(err.message || "Unable to load fertilizer products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFertilizers(null, "");
    refreshCartCount();
  }, [loadFertilizers, refreshCartCount]);

  const handleAddToCart = async (product) => {
    try {
      if (!product?._id) throw new Error("Invalid product");
      if (!product.isActive || !product.inStock || Number(product.quantity) <= 0) {
        throw new Error("This product is currently unavailable");
      }

      const response = await cartAPI.addToCart(product._id, 1);
      setCartCount(
        (response.cart?.items || []).reduce(
          (sum, item) => sum + (Number(item.quantity) || 0),
          0
        )
      );
      addNotification?.(`${product.name} added to cart`, "success");
    } catch (err) {
      addNotification?.(err.message || "Failed to add item to cart", "error");
    }
  };

  const useLocation = async () => {
    try {
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

      await loadFertilizers(location, searchText);
    } catch (err) {
      setError(err.message || "Unable to access location");
    }
  };

  return (
    <div className="customer-dashboard-page">
      <div className="customer-topbar">
        <div className="customer-topbar-inner">
          <button className="back-button" onClick={() => navigate(-1)}>← Back</button>
          <div className="customer-brand">🌿 Fertilizer Store</div>
          <div className="customer-top-actions">
            <button className="logout-btn" onClick={() => navigate("/buyer/cart")}>
              🛒 Cart {cartCount > 0 ? `(${cartCount})` : ""}
            </button>
            <button className="logout-btn" onClick={() => navigate(homePath)}>Home</button>
          </div>
        </div>
      </div>

      <div className="customer-dashboard-content">
        <div className="search-bar-wrapper">
          <div className="search-bar">
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") loadFertilizers(locationInfo, searchText);
              }}
              placeholder="Search fertilizers..."
            />
            <button className="search-btn" onClick={() => loadFertilizers(locationInfo, searchText)}>
              🔍 Search
            </button>
            <button className="store-btn" onClick={useLocation}>📍 Use My Location</button>
          </div>

          {locationInfo && (
            <div className="location-status">
              {locationAddress ||
                `Showing fertilizers near ${Number(locationInfo.latitude).toFixed(3)}, ${Number(locationInfo.longitude).toFixed(3)}`}
            </div>
          )}
        </div>

        <div className="products-header">
          <h3>Fertilizers Near You</h3>
          <button className="filter-btn" onClick={() => loadFertilizers(locationInfo, searchText)}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="loading-state">Loading fertilizers...</div>
        ) : error ? (
          <div className="error-state">{error}</div>
        ) : products.length === 0 ? (
          <div className="placeholder-text">No fertilizers available right now.</div>
        ) : (
          <div className="product-grid">
            {products.map((product) => (
              <div className="product-card" key={product._id}>
                <div className="product-image-wrapper">
                  {product.mainImage || product.images?.[0]?.url ? (
                    <img
                      src={product.mainImage || product.images?.[0]?.url}
                      alt={product.name}
                    />
                  ) : (
                    <div className="no-image-fallback">🧪</div>
                  )}
                  <div className="rating-badge">
                    {Number(product.rating) > 0
                      ? `⭐ ${Number(product.rating).toFixed(1)}`
                      : "New"}
                  </div>
                </div>

                <div className="product-card-body">
                  <h4>{product.name}</h4>
                  <p className="farmer-line">🏷️ {product.category || "Fertilizer"}</p>
                  <p className="distance-line">📍 {product.address || "Seller location"}</p>
                  <div className="product-meta">
                    <span className="product-price">₹{product.price} / {product.unit || "unit"}</span>
                    <span className="product-stock">
                      {Number(product.quantity) || 0} {product.unit || "unit"}
                    </span>
                  </div>
                  <button
                    className="add-cart-btn"
                    disabled={!product.inStock || Number(product.quantity) <= 0}
                    onClick={() => handleAddToCart(product)}
                  >
                    🛒 {Number(product.quantity) > 0 ? "Add to Cart" : "Out of Stock"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FertilizerStore;
