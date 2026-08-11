import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { productAPI } from "../../services/api.js";
import LocationService from "../../services/LocationService.js";
import "./addfertilizerproduct.css";

const AddFertilizerProduct = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    category: "Chemical",
    description: "",
    price: "",
    quantity: "",
    unit: "kg",
    brand: "",
    composition: "",
    recommendedFor: "",
    usageInstructions: "",
    safetyInfo: "",
    expiryDate: "",
    address: "",
    images: [],
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUseCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError("");

    try {
      const position = await LocationService.getCurrentLocation();
      setCurrentLocation(position);
      const address = await LocationService.reverseGeocode(position.latitude, position.longitude);
      setFormData((prev) => ({
        ...prev,
        address: address?.display_name || LocationService.formatCoordinates(position.latitude, position.longitude),
      }));
    } catch (err) {
      setLocationError(err.message || "Unable to get current location");
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Validate required fields
      if (!formData.name || !formData.price || !formData.quantity) {
        throw new Error("Please fill in all required fields");
      }

      const productData = {
        ...formData,
        seller: user._id,
        sellerName: `${user.firstName} ${user.lastName}`,
        price: parseFloat(formData.price),
        quantity: parseInt(formData.quantity),
        type: "fertilizer",
        isActive: true,
        address: formData.address,
        location: currentLocation
          ? {
              type: "Point",
              coordinates: [currentLocation.longitude, currentLocation.latitude],
            }
          : {
              type: "Point",
              coordinates: [0, 0],
            },
      };

      await productAPI.createProduct(productData);

      setSuccess("Fertilizer product added successfully!");
      setTimeout(() => {
        navigate("/fertilizer");
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-product-page">
      {/* Topbar */}
      <div className="add-product-topbar">
        <div className="add-product-topbar-inner">
          <div className="add-product-brand">🌱 AgroConnect</div>
          <div className="add-product-title">{t("addFertilizerProductTitle")}</div>
          <button className="back-btn" onClick={() => navigate("/fertilizer")}>
            ← {t("backToDashboard")}
          </button>
        </div>
      </div>

      <div className="add-product-container">
        <div className="add-product-form-container">
          <h2>{t("addProductTitle")}</h2>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <form onSubmit={handleSubmit} className="add-product-form">
            <div className="form-section">
              <h3>{t("basicInformation")}</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">{t("productNameLabel")} *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder={t("productNamePlaceholder")}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="category">{t("categoryLabel")} *</label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="Chemical">Chemical</option>
                    <option value="Organic">Organic</option>
                    <option value="Bio-fertilizer">Bio-fertilizer</option>
                    <option value="Micronutrients">Micronutrients</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="description">{t("descriptionLabel")}</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder={t("descriptionPlaceholder")}
                  rows="4"
                />
              </div>

              <div className="form-group">
                <label htmlFor="address">{t("locationLabel")} / {t("addressLabel")}</label>
                <div className="location-field-wrapper">
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder={t("enterLocationPlaceholder")}
                  />
                  <button
                    type="button"
                    className="location-btn"
                    onClick={handleUseCurrentLocation}
                    disabled={locationLoading}
                  >
                    {locationLoading ? t("locating") : `📍 ${t("useCurrentLocation")}`}
                  </button>
                </div>
                {locationError && <p className="location-error">{locationError}</p>}
              </div>
            </div>

            <div className="form-section">
              <h3>{t("pricingAndQuantity")}</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="price">{t("marketPriceLabel")} *</label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder={t("marketPricePlaceholder")}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="quantity">{t("quantityLabel")} *</label>
                  <input
                    type="number"
                    id="quantity"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    placeholder={t("quantityPlaceholder")}
                    min="0"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="unit">{t("unitLabel")}</label>
                  <select
                    id="unit"
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                  >
                    <option value="kg">kg</option>
                    <option value="bags">bags</option>
                    <option value="liters">liters</option>
                    <option value="tons">tons</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>{t("productDetails")}</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="brand">{t("shopName")}</label>
                  <input
                    type="text"
                    id="brand"
                    name="brand"
                    value={formData.brand}
                    onChange={handleInputChange}
                    placeholder={t("shopName")}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="expiryDate">{t("expiryDate")}</label>
                  <input
                    type="date"
                    id="expiryDate"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="composition">{t("compositionLabel")}</label>
                <input
                  type="text"
                  id="composition"
                  name="composition"
                  value={formData.composition}
                  onChange={handleInputChange}
                  placeholder={t("compositionPlaceholder")}
                />
              </div>

              <div className="form-group">
                <label htmlFor="address">{t("locationLabel")} / {t("addressLabel")}</label>
                <div className="location-field-wrapper">
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder={t("enterLocationPlaceholder")}
                  />
                  <button
                    type="button"
                    className="location-btn"
                    onClick={handleUseCurrentLocation}
                    disabled={locationLoading}
                  >
                    {locationLoading ? t("locating") : `📍 ${t("useCurrentLocation")}`}
                  </button>
                </div>
                {locationError && <p className="location-error">{locationError}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="recommendedFor">{t("recommendedForLabel")}</label>
                <input
                  type="text"
                  id="recommendedFor"
                  name="recommendedFor"
                  value={formData.recommendedFor}
                  onChange={handleInputChange}
                  placeholder={t("recommendedForPlaceholder")}
                />
              </div>

              <div className="form-group">
                <label htmlFor="usageInstructions">{t("usageInstructionsLabel")}</label>
                <textarea
                  id="usageInstructions"
                  name="usageInstructions"
                  value={formData.usageInstructions}
                  onChange={handleInputChange}
                  placeholder={t("usageInstructionsPlaceholder")}
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label htmlFor="safetyInfo">{t("safetyInformationLabel")}</label>
                <textarea
                  id="safetyInfo"
                  name="safetyInfo"
                  value={formData.safetyInfo}
                  onChange={handleInputChange}
                  placeholder={t("safetyInformationPlaceholder")}
                  rows="3"
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="cancel-btn" onClick={() => navigate("/fertilizer")}>{t("cancel")}</button>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? t("addingProduct") : t("addProductButton")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddFertilizerProduct;