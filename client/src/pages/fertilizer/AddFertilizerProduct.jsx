import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useNotification } from "../../context/AppHooks.js";
import { productAPI, uploadAPI } from "../../services/api.js";
import LocationService from "../../services/LocationService.js";
import "./addfertilizerproduct.css";

const AddFertilizerProduct = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    category: "npk",
    description: "",
    price: "",
    quantity: "",
    unit: "kg",
    address: "",
    nitrogen: "",
    phosphorus: "",
    potassium: "",
  });

  useEffect(() => {
    if (user && user.role !== "fertilizer_seller") {
      addNotification?.("Only fertilizer seller accounts can add fertilizer products", "error");
      navigate("/", { replace: true });
    }
  }, [addNotification, navigate, user]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (file && !file.type.startsWith("image/")) {
      addNotification?.("Please choose an image file", "error");
      event.target.value = "";
      return;
    }
    if (file && file.size > 10 * 1024 * 1024) {
      addNotification?.("Product image must be 10 MB or smaller", "error");
      event.target.value = "";
      return;
    }

    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : "");
  };

  const handleUseCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const position = await LocationService.getCurrentLocation();
      setCurrentLocation(position);

      const address = await LocationService.reverseGeocode(
        position.latitude,
        position.longitude
      );

      const formattedAddress = address
        ? [
            address.road,
            address.village || address.town || address.city,
            address.state,
            address.postcode,
          ]
            .filter(Boolean)
            .join(", ")
        : LocationService.formatCoordinates(position.latitude, position.longitude);

      setFormData((prev) => ({ ...prev, address: formattedAddress }));
      addNotification?.("Store/product GPS location captured", "success");
    } catch (err) {
      addNotification?.(err.message || "Unable to get current location", "error");
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const price = Number(formData.price);
    const quantity = Number(formData.quantity);

    if (!formData.name.trim() || !formData.description.trim() || !formData.category) {
      addNotification?.("Name, category and description are required", "error");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      addNotification?.("Enter a valid price greater than zero", "error");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      addNotification?.("Enter a valid quantity greater than zero", "error");
      return;
    }

    if (!formData.address.trim()) {
      addNotification?.("Enter the seller/pickup address", "error");
      return;
    }

    setLoading(true);

    try {
      let images = [];
      if (imageFile) {
        const uploadForm = new FormData();
        uploadForm.append("image", imageFile);
        const uploaded = await uploadAPI.uploadImage(uploadForm);
        if (uploaded?.url) {
          images = [{ url: uploaded.url, publicId: uploaded.publicId }];
        }
      }

      const composition = {
        nitrogen: Number(formData.nitrogen) || 0,
        phosphorus: Number(formData.phosphorus) || 0,
        potassium: Number(formData.potassium) || 0,
      };

      const result = await productAPI.createProduct({
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: "fertilizer",
        category: formData.category,
        price,
        quantity,
        unit: formData.unit,
        images,
        address: formData.address.trim(),
        location: {
          type: "Point",
          coordinates: currentLocation
            ? [Number(currentLocation.longitude), Number(currentLocation.latitude)]
            : [0, 0],
          address: formData.address.trim(),
        },
        composition,
      });

      addNotification?.(
        result?.message ||
          (result?.isPublished === false
            ? "Fertilizer saved as draft"
            : "Fertilizer product added successfully"),
        result?.isPublished === false ? "info" : "success"
      );

      navigate("/fertilizer");
    } catch (err) {
      addNotification?.(err.message || "Failed to add fertilizer product", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-product-page">
      <div className="add-product-topbar">
        <div className="add-product-topbar-inner">
          <div className="add-product-brand">🌱 AgroConnect</div>
          <div className="add-product-title">Add Fertilizer Product</div>
          <button className="back-btn" onClick={() => navigate("/fertilizer")}>
            ← Back to Dashboard
          </button>
        </div>
      </div>

      <div className="add-product-container">
        <div className="add-product-form-container">
          <h2>Add Product</h2>

          <form onSubmit={handleSubmit} className="add-product-form">
            <div className="form-section">
              <h3>Basic Information</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Product Name *</label>
                  <input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. NPK 19-19-19"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="category">Category *</label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="npk">NPK Fertilizer</option>
                    <option value="organic">Organic / Bio Fertilizer</option>
                    <option value="pesticide">Pesticide</option>
                    <option value="seeds">Seeds</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="description">Description *</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe the product, recommended use, packaging and safety information"
                  rows="4"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="address">Pickup / Store Address *</label>
                <div className="location-field-wrapper">
                  <input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Enter store or pickup address"
                    required
                  />
                  <button
                    type="button"
                    className="location-btn"
                    onClick={handleUseCurrentLocation}
                    disabled={locationLoading}
                  >
                    {locationLoading ? "Locating..." : "📍 Use Current Location"}
                  </button>
                </div>
                {currentLocation && (
                  <small>
                    GPS: {Number(currentLocation.latitude).toFixed(6)},{" "}
                    {Number(currentLocation.longitude).toFixed(6)}
                  </small>
                )}
                {!currentLocation && formData.address && (
                  <small>No GPS captured. The product will be saved as a draft until valid GPS is added.</small>
                )}
              </div>
            </div>

            <div className="form-section">
              <h3>Pricing and Stock</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="price">Price (₹) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="quantity">Quantity *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    id="quantity"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="unit">Unit</label>
                  <select id="unit" name="unit" value={formData.unit} onChange={handleInputChange}>
                    <option value="kg">kg</option>
                    <option value="liter">liter</option>
                    <option value="bag">bag</option>
                    <option value="piece">piece</option>
                    <option value="box">box</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>NPK Composition</h3>
              <p>Enter percentages when applicable. Leave blank if not applicable.</p>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="nitrogen">Nitrogen (N)</label>
                  <input type="number" min="0" step="0.01" id="nitrogen" name="nitrogen" value={formData.nitrogen} onChange={handleInputChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="phosphorus">Phosphorus (P)</label>
                  <input type="number" min="0" step="0.01" id="phosphorus" name="phosphorus" value={formData.phosphorus} onChange={handleInputChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="potassium">Potassium (K)</label>
                  <input type="number" min="0" step="0.01" id="potassium" name="potassium" value={formData.potassium} onChange={handleInputChange} />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Product Image</h3>
              <div className="form-group">
                <input type="file" accept="image/*" onChange={handleImageChange} />
                {imagePreview && (
                  <div className="image-preview">
                    <img src={imagePreview} alt="Fertilizer product preview" />
                  </div>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="cancel-btn" onClick={() => navigate("/fertilizer")}>
                Cancel
              </button>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Adding Product..." : "Add Fertilizer Product"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddFertilizerProduct;
