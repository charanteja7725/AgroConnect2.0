import { useNavigate } from "react-router-dom";
import "./buyerdashboard.css";

const BuyerDashboard = () => {
  const navigate = useNavigate();

  const nearbyFarmers = [
    { id: 1, name: "Ramesh Kumar", distance: "2.5 km away", products: 8 },
    { id: 2, name: "Suresh Patel", distance: "3.2 km away", products: 12 },
    { id: 3, name: "Anil Sharma", distance: "1.8 km away", products: 6 },
  ];

  const products = [
    {
      id: 1,
      name: "Fresh Tomatoes",
      farmer: "Ramesh Kumar",
      distance: "2.5 km",
      price: 40,
      stock: "50 kg available",
      rating: 4.5,
      image:
        "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: 2,
      name: "Organic Potatoes",
      farmer: "Suresh Patel",
      distance: "3.2 km",
      price: 30,
      stock: "100 kg available",
      rating: 4.8,
      image:
        "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: 3,
      name: "Red Onions",
      farmer: "Anil Sharma",
      distance: "1.8 km",
      price: 35,
      stock: "80 kg available",
      rating: 4.3,
      image:
        "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: 4,
      name: "Fresh Carrots",
      farmer: "Vijay Kumar",
      distance: "4.1 km",
      price: 45,
      stock: "60 kg available",
      rating: 4.6,
      image:
        "https://images.unsplash.com/photo-1447175008436-054170c2e979?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: 5,
      name: "Green Cabbage",
      farmer: "Prakash Reddy",
      distance: "2.9 km",
      price: 25,
      stock: "70 kg available",
      rating: 4.4,
      image:
        "https://images.unsplash.com/photo-1611105637889-3afd7295bdbf?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: 6,
      name: "Cauliflower",
      farmer: "Mohan Singh",
      distance: "3.5 km",
      price: 50,
      stock: "40 kg available",
      rating: 4.7,
      image:
        "https://images.unsplash.com/photo-1510627498534-cf7e9002facc?auto=format&fit=crop&w=800&q=80",
    },
  ];

  return (
    <div className="customer-dashboard-page">
      {/* Top bar */}
      <div className="customer-topbar">
        <div className="customer-topbar-inner">
          <div className="customer-brand">🌱 AgroConnect</div>

          <div className="customer-user-info">
            <span className="customer-greeting">Hi, Priya! 👋</span>
          </div>

          <div className="customer-top-actions">
            <button
              className="icon-btn"
              onClick={() => navigate("/buyer/cart")}
            >
              🛒
            </button>
            <button className="logout-btn">Logout</button>
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

            <input
              type="text"
              placeholder="Search for fresh vegetables, fruits, grains..."
            />

            <button className="voice-btn">🎤</button>
            <button className="search-btn">🔍</button>
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

        <div className="product-grid">
          {products.map((product) => (
            <div className="product-card" key={product.id}>
              <div className="product-image-wrapper">
                <img src={product.image} alt={product.name} />
                <div className="rating-badge">⭐ {product.rating}</div>
              </div>

              <div className="product-card-body">
                <h4>{product.name}</h4>
                <p className="farmer-line">🌱 {product.farmer}</p>
                <p className="distance-line">📍 {product.distance}</p>

                <div className="product-meta">
                  <span className="product-price">₹{product.price}/kg</span>
                  <span className="product-stock">{product.stock}</span>
                </div>

                <button
                  className="add-cart-btn"
                  onClick={() => navigate("/buyer/cart")}
                >
                  🛒 Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>

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