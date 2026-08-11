import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { productAPI, userAPI } from "../../services/api.js";
import { useAuth, useNotification } from "../../context/AppContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import LocationService from "../../services/LocationService.js";
import "./addproduct.css";

const AddProduct = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [location, setLocation] = useState("");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState("not_submitted");
  const [loadingVerification, setLoadingVerification] = useState(true);

  useEffect(() => {
    const loadVerification = async () => {
      try {
        const data = await userAPI.getUser(user?._id);
        setVerificationStatus(data?.user?.farmerVerification?.status || "not_submitted");
      } catch (err) {
        setVerificationStatus("not_submitted");
      } finally {
        setLoadingVerification(false);
      }
    };

    if (user?._id) {
      loadVerification();
    }
  }, [user?._id]);

  const suggestedPrice =
    marketPrice && quantity ? (Number(marketPrice) * 0.95).toFixed(2) : "";

  const handleUseCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError("");

    try {
      const position = await LocationService.getCurrentLocation();
      setCurrentLocation(position);
      const address = await LocationService.reverseGeocode(position.latitude, position.longitude);
      setLocation(address?.display_name || LocationService.formatCoordinates(position.latitude, position.longitude));
    } catch (error) {
      setLocationError(error.message || "Unable to get current location");
    } finally {
      setLocationLoading(false);
    }
  };

  return (
    <div className="add-product-page">
      <div className="add-product-header">
        <h2>{t("addProductTitle")}</h2>
        <p>{t("addProductDescription")}</p>
      </div>

      <div className="add-product-container">
        <div className="add-product-form-card">
          {loadingVerification ? (
            <div className="verification-banner">{t("checkingVerificationStatus")}</div>
          ) : verificationStatus !== "verified" ? (
            <div className="verification-banner warning">
              {verificationStatus === "pending" && t("verificationStatusPendingReview")}
              {verificationStatus === "more_information_required" && t("verificationStatusWaitingInfo")}
              {verificationStatus === "not_submitted" && t("verificationStatusNotApproved")}
              {t("cannotPublishUntilApproved")}
            </div>
          ) : null}
          <div className="form-group">
            <label>{t("productNameLabel")}</label>
            <input
              type="text"
              placeholder={t("productNamePlaceholder")}
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>{t("categoryLabel")}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">{t("selectCategory")}</option>
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
            <label>{t("locationLabel")}</label>
            <div className="location-field-wrapper">
              <input
                type="text"
                placeholder={t("enterLocationPlaceholder")}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <button
                type="button"
                className="location-btn"
                onClick={handleUseCurrentLocation}
                disabled={locationLoading}
              >
                {locationLoading ? t("locating") : `${t("useCurrentLocation")}`}
              </button>
            </div>
            {locationError && <p className="location-error">{locationError}</p>}
          </div>

          <div className="form-group">
            <label>{t("uploadProductImage")}</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="form-group">
            <label>{t("descriptionLabel")}</label>
            <textarea
              placeholder={t("descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <button
            className="submit-btn"
            onClick={async () => {
              if (!productName || !category || !quantity || !marketPrice || !location) {
                addNotification("Please fill in all required fields", "error");
                return;
              }

              setSubmitting(true);
              try {
                const imageUrl = imageFile ? URL.createObjectURL(imageFile) : null;
                await productAPI.createProduct({
                  name: productName,
                  description,
                  type: "produce",
                  category,
                  price: Number(marketPrice),
                  quantity: Number(quantity),
                  unit: "kg",
                  images: imageUrl ? [{ url: imageUrl, alt: productName }] : [],
                  address: location,
                  location: currentLocation
                    ? {
                        type: "Point",
                        coordinates: [currentLocation.longitude, currentLocation.latitude],
                      }
                    : {
                        type: "Point",
                        coordinates: [0, 0],
                      },
                });

                addNotification("Product added successfully", "success");
                setProductName("");
                setCategory("");
                setQuantity("");
                setMarketPrice("");
                setLocation("");
                setDescription("");
                setImageFile(null);
                navigate("/farmer");
              } catch (error) {
                addNotification(error.message || "Unable to add product", "error");
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting || verificationStatus !== "verified"}
          >
            {submitting ? t("adding") : verificationStatus === "verified" ? t("addProductButton") : t("verificationRequired")}
          </button>
        </div>

        <div className="ai-price-card">
            <h3>{t("aiPriceSuggestion")}</h3>
            <p>{t("priceSuggestionDescription")}</p>

            <div className="price-box">
              {suggestedPrice ? `₹${suggestedPrice} / kg` : t("enterDetailsFirst")}
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