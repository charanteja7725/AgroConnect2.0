import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { productAPI, uploadAPI } from "../../services/api.js";
import { useNotification } from "../../context/AppHooks.js";
import { LocationService } from "../../services/LocationService.js";
import "./addproduct.css";

const AddProduct = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const [productType, setProductType] = useState(
    window.location.pathname.includes("/fertilizer") ? "fertilizer" : "produce"
  );
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [locationText, setLocationText] = useState("");
  const [locationCoords, setLocationCoords] = useState(null);
  const [locationHint, setLocationHint] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [description, setDescription] = useState("");
  const [compositionN, setCompositionN] = useState("");
  const [compositionP, setCompositionP] = useState("");
  const [compositionK, setCompositionK] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
            <label>Product Type</label>
            <select value={productType} onChange={(e) => setProductType(e.target.value)}>
              <option value="produce">Produce</option>
              <option value="fertilizer">Fertilizer</option>
            </select>
          </div>

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
              {productType === "fertilizer" ? (
                <>
                  <option value="npk">NPK Fertilizer</option>
                  <option value="organic">Organic Fertilizer</option>
                  <option value="pesticide">Pesticide</option>
                  <option value="seeds">Seeds</option>
                </>
              ) : (
                <>
                  <option value="vegetables">Vegetables</option>
                  <option value="fruits">Fruits</option>
                  <option value="grains">Grains</option>
                  <option value="pulses">Pulses</option>
                </>
              )}
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
              placeholder="Enter product location"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
            />
            <div className="location-actions">
              <button
                type="button"
                className="location-btn"
                disabled={locationLoading}
                onClick={async () => {
                  setLocationLoading(true);
                  try {
                    const userLocation = await LocationService.getCurrentLocation();
                    setLocationCoords(userLocation);
                    const address = await LocationService.reverseGeocode(
                      userLocation.latitude,
                      userLocation.longitude
                    );
                    const formattedAddress = address
                      ? `${address.road || ""} ${address.city || address.town || address.village || ""} ${address.state || ""}`.trim()
                      : LocationService.formatCoordinates(userLocation.latitude, userLocation.longitude);
                    setLocationText(formattedAddress);
                    setLocationHint("Using current GPS location");
                  } catch (err) {
                    addNotification(err.message || "Unable to get current location", "error");
                  } finally {
                    setLocationLoading(false);
                  }
                }}
              >
                {locationLoading ? "Locating..." : "📍 Use My Current Location"}
              </button>
              <button
                type="button"
                className="location-btn"
                onClick={() => {
                  setLocationText("");
                  setLocationCoords(null);
                  setLocationHint("");
                }}
              >
                Clear
              </button>
            </div>
            {locationHint && <p className="location-hint">{locationHint}</p>}
            {locationCoords && (
              <p className="location-hint">Selected location: {locationText || LocationService.formatCoordinates(locationCoords.latitude, locationCoords.longitude)}</p>
            )}
          </div>

          <div className="form-group">
            <label>Upload Product Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setImageFile(file);
                setImagePreview(file ? URL.createObjectURL(file) : "");
              }}
            />
            {imagePreview && (
              <div className="image-preview">
                <img src={imagePreview} alt="Preview" />
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              placeholder="Write short product description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {productType === "fertilizer" && (
            <div className="fertilizer-details">
              <h4>Fertilizer Composition</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Nitrogen (N)</label>
                  <input
                    type="number"
                    placeholder="N%"
                    value={compositionN}
                    onChange={(e) => setCompositionN(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Phosphorus (P)</label>
                  <input
                    type="number"
                    placeholder="P%"
                    value={compositionP}
                    onChange={(e) => setCompositionP(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Potassium (K)</label>
                  <input
                    type="number"
                    placeholder="K%"
                    value={compositionK}
                    onChange={(e) => setCompositionK(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <button
            className="submit-btn"
            onClick={async () => {
              if (!productName || !category || !quantity || !marketPrice) {
                addNotification("Please fill in all required fields", "error");
                return;
              }

              if (!locationCoords || !locationCoords.latitude || !locationCoords.longitude) {
                addNotification("Product location is required. Please use current location.", "error");
                return;
              }

              setSubmitting(true);
              try {
                let imagePayload = [];
                if (imageFile) {
                  const formData = new FormData();
                  formData.append("image", imageFile);
                  const uploadResult = await uploadAPI.uploadImage(formData);
                  imagePayload = uploadResult?.url
                    ? [
                        {
                          url: uploadResult.url,
                          publicId: uploadResult.publicId,
                          alt: productName,
                        },
                      ]
                    : [];
                  
                }

                await productAPI.createProduct({
                  name: productName,
                  description,
                  type: productType,
                  category,
                  price: Number(marketPrice),
                  quantity: Number(quantity),
                  unit: "kg",
                  images: imagePayload,
                  address: locationText,
                  location: {
                    type: "Point",
                    coordinates: [locationCoords.longitude, locationCoords.latitude],
                    address: locationText || "",
                  },
                  composition:
                    productType === "fertilizer"
                      ? {
                          nitrogen: Number(compositionN) || 0,
                          phosphorus: Number(compositionP) || 0,
                          potassium: Number(compositionK) || 0,
                        }
                      : undefined,
                });

                addNotification("Product added successfully", "success");
                setProductName("");
                setCategory("");
                setQuantity("");
                setMarketPrice("");
                setLocationText("");
                setDescription("");
                setCompositionN("");
                setCompositionP("");
                setCompositionK("");
                setImageFile(null);
                navigate(productType === "fertilizer" ? "/fertilizer" : "/farmer");
              } catch (error) {
                addNotification(error.message || "Unable to add product", "error");
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
          >
            {submitting ? "Adding..." : productType === "fertilizer" ? "Add Fertilizer" : "Add Product"}
          </button>
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