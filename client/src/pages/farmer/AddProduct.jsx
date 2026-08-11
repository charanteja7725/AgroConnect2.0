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
  const [productType, setProductType] = useState(
    window.location.pathname.includes("/fertilizer") ? "fertilizer" : "produce"
  );
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [location, setLocation] = useState("");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [description, setDescription] = useState("");
  const [compositionN, setCompositionN] = useState("");
  const [compositionP, setCompositionP] = useState("");
  const [compositionK, setCompositionK] = useState("");
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
            <label>{t("descriptionLabel")}</label>
            <textarea
              placeholder={t("descriptionPlaceholder")}
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