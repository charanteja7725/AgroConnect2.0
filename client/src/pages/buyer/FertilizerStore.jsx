import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { productAPI } from "../../services/api.js";
import { LocationService } from "../../services/LocationService.js";
import { useCart, useNotification } from "../../context/AppHooks.js";
import "../buyer/buyerdashboard.css";

const FertilizerStore = () => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { addNotification } = useNotification();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locationInfo, setLocationInfo] = useState(null);
  const [locationAddress, setLocationAddress] = useState("");
  const [searchText, setSearchText] = useState("");

  const handleAddToCart = async (product) => {
    try {
      await addToCart(product, 1);
      if (addNotification) {
        addNotification(`${product.name} added to cart!`, "success");
      }
    } catch (err) {
      if (addNotification) {
        addNotification(err.message || "Failed to add item to cart", "error");
      }
    }
  };

  const loadFertilizers = async (location, search) => {
    setLoading(true);
    setError("");

    try {
      const filters = { type: "fertilizer" };
      if (search) filters.search = search;
      if (location?.latitude && location?.longitude) {
        filters.latitude = location.latitude;
        filters.longitude = location.longitude;
        filters.maxDistance = 50000;
      }

      const response = await productAPI.getAllProducts(filters);
      setProducts(response.products || []);
    } catch (err) {
      setError(err.message || "Unable to load fertilizer products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFertilizers(null, "");
  }, []);

  return (
    <div className="customer-dashboard-page">
      <div className="customer-topbar">
        <div className="customer-topbar-inner">
          <button className="back-button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div className="customer-brand">🌿 Fertilizer Store</div>
          <div className="customer-top-actions">
            <button className="logout-btn" onClick={() => navigate("/buyer")}>Home</button>
          </div>
        </div>
      </div>

      <div className="customer-dashboard-content">
        <div className="search-bar-wrapper">
          <div className="search-bar">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search fertilizers..."
            />
            <button
              className="search-btn"
              onClick={() => loadFertilizers(locationInfo, searchText)}
            >
              🔍 Search
            </button>
            <button
              className="store-btn"
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
                  loadFertilizers(location, searchText);
                } catch (err) {
                  setError(err.message || "Unable to access location");
                }
              }}
            >
              📍 Use My Location
            </button>
          </div>
          {locationInfo && (
            <div className="location-status">
              {locationAddress
                ? `Showing fertilizers near ${locationAddress}`
                : `Showing fertilizers near ${locationInfo.latitude.toFixed(3)}, ${locationInfo.longitude.toFixed(3)}`}
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
                  <img
                    src={product.mainImage || product.images?.[0]?.url || "https://via.placeholder.com/300"}
                    alt={product.name}
                  />
                  <div className="rating-badge">⭐ {product.rating || "4.5"}</div>
                </div>
                <div className="product-card-body">
                  <h4>{product.name}</h4>
                  <p className="farmer-line">🏷️ {product.category || "Fertilizer"}</p>
                  <p className="distance-line">📍 {product.address || "Nearby"}</p>
                  <div className="product-meta">
                    <span className="product-price">₹{product.price}</span>
                    <span className="product-stock">{product.quantity || "Available"} kg</span>
                  </div>
                  <button className="add-cart-btn" onClick={() => handleAddToCart(product)}>🛒 Add to Cart</button>
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
