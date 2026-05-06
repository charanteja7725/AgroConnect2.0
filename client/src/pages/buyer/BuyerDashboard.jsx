import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { productAPI, cartAPI } from "../../services/api.js";
import { useAuth, useNotification } from "../../context/AppContext.jsx";
import VoiceSearch from "../../components/VoiceSearch.jsx";
import { LocationService } from "../../services/LocationService.js";
import "./buyerdashboard.css";

const BuyerDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { addNotification } = useNotification();
  const [searchText, setSearchText] = useState("");
  const [locationInfo, setLocationInfo] = useState(null);
  const [locationAddress, setLocationAddress] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadProducts = async (location = null, search = "") => {
    setLoading(true);
    setError("");
    try {
      const query = {};
      if (search) {
        query.search = search;
      }
      if (location?.latitude && location?.longitude) {
        query.latitude = location.latitude;
        query.longitude = location.longitude;
        query.maxDistance = 20000;
      }
      const data = await productAPI.getAllProducts(query);
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message || "Unable to fetch products");
    } finally {
      setLoading(false);
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

  const nearbyFarmers = [
    { id: 1, name: "Ramesh Kumar", distance: "2.5 km away", products: 8 },
    { id: 2, name: "Suresh Patel", distance: "3.2 km away", products: 12 },
    { id: 3, name: "Anil Sharma", distance: "1.8 km away", products: 6 },
  ];

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
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="customer-dashboard-content">
        {/* Search */}
        <div className="search-bar-wrapper">
          <div className="search-bar">
            <select>
              <option>All Areas</option>
              <option>Nearby</option>
              <option>Within 5 km</option>
            </select>

            <VoiceSearch
              onSearch={(value) => setSearchText(value)}
              placeholder="Search for fresh vegetables, fruits, grains..."
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
                      : "Current location"
                  );
                  loadProducts(location, searchText);
                } catch (error) {
                  setLocationInfo({ error: error.message });
                }
              }}
            >
              Use My Location
            </button>
            {locationInfo && (
              <div className="location-status">
                {locationInfo.error ? (
                  `Location error: ${locationInfo.error}`
                ) : (
                  <>
                    <span>{`Current location: ${locationInfo.latitude.toFixed(3)}, ${locationInfo.longitude.toFixed(3)}`}</span>
                    {locationAddress && <span> · {locationAddress}</span>}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Nearby Farmers */}
        <div className="section-title">📍 Nearby Farmers</div>
        <div className="farmer-strip">
          {nearbyFarmers.map((farmer) => (
            <div className="farmer-mini-card" key={farmer.id}>
              <div className="farmer-mini-icon">🌱</div>

              <div className="farmer-mini-info">
                <h4>{farmer.name}</h4>
                <p>{farmer.distance}</p>
              </div>

              <span className="mini-badge">{farmer.products} products</span>
            </div>
          ))}
        </div>

        {/* Products */}
        <div className="products-header">
          <h3>Fresh Products Available</h3>
          <button className="filter-btn">Filter</button>
        </div>

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

        {/* Price comparison */}
        <div className="comparison-box">
          <h3>Price Comparison</h3>

          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Farmer 1</th>
                <th>Farmer 2</th>
                <th>Best Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Tomatoes</td>
                <td>₹40/kg</td>
                <td>₹45/kg</td>
                <td className="best-price">₹40/kg</td>
              </tr>
              <tr>
                <td>Potatoes</td>
                <td>₹30/kg</td>
                <td>₹32/kg</td>
                <td className="best-price">₹30/kg</td>
              </tr>
              <tr>
                <td>Onions</td>
                <td>₹35/kg</td>
                <td>₹33/kg</td>
                <td className="best-price">₹33/kg</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BuyerDashboard;