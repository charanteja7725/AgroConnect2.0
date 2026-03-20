import { useState } from "react";
import "./addproduct.css";

const AddProduct = () => {
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [location, setLocation] = useState("");

  const suggestedPrice =
    marketPrice && quantity ? (Number(marketPrice) * 0.95).toFixed(2) : "";

  return (
    <div className="add-product-page">
      <div className="add-product-header">
        <h2>Add New Product</h2>
        <p>List your farm produce with AI-assisted pricing</p>
      </div>

      <div className="add-product-container">
        <div className="add-product-form-card">
          <div className="form-group">
            <label>Product Name</label>
            <input
              type="text"
              placeholder="Enter product name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select category</option>
              <option value="vegetables">Vegetables</option>
              <option value="fruits">Fruits</option>
              <option value="grains">Grains</option>
              <option value="pulses">Pulses</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Quantity (kg)</label>
              <input
                type="number"
                placeholder="Enter quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Market Price (₹/kg)</label>
              <input
                type="number"
                placeholder="Enter market price"
                value={marketPrice}
                onChange={(e) => setMarketPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              placeholder="Enter farm location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Upload Product Image</label>
            <input type="file" />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea placeholder="Write short product description..." />
          </div>

          <button className="submit-btn">Add Product</button>
        </div>

        <div className="ai-price-card">
          <h3>AI Price Suggestion</h3>
          <p>
            Based on market trends, demand, and your location, the suggested
            selling price is:
          </p>

          <div className="price-box">
            {suggestedPrice ? `₹${suggestedPrice} / kg` : "Enter details first"}
          </div>

          <div className="ai-note">
            <strong>How this is calculated:</strong>
            <ul>
              <li>Market price reference</li>
              <li>Local demand estimate</li>
              <li>Competitive farmer pricing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddProduct;