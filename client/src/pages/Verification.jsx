import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useNotification } from "../context/AppContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { userAPI } from "../services/api.js";
import LocationService from "../services/LocationService.js";
import "./verification.css";

const Verification = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, updateUser } = useAuth();
  const { addNotification } = useNotification();
  const [formData, setFormData] = useState({
    farmerId: "",
    farmLocationLat: "",
    farmLocationLng: "",
    sellerId: "",
    shopName: "",
    shopLocationLat: "",
    shopLocationLng: "",
    reviewNotes: "",
  });
  const [fileInputs, setFileInputs] = useState({
    identityDocument: null,
    farmingProof: null,
    farmPhoto: null,
    shopCertificate: null,
    shopPhoto: null,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("not_submitted");

  useEffect(() => {
    if (!user) return;

    setVerificationStatus(
      user.role === "farmer"
        ? user.farmerVerification?.status || "not_submitted"
        : user.sellerVerification?.status || "not_submitted"
    );

    if (user.role === "farmer") {
      setFormData((prev) => ({
        ...prev,
        farmerId: user.farmerVerification?.farmerId || "",
        farmLocationLat: user.farmerVerification?.farmLocation?.latitude || "",
        farmLocationLng: user.farmerVerification?.farmLocation?.longitude || "",
        reviewNotes: user.farmerVerification?.reviewNotes || "",
      }));
    } else if (user.role === "fertilizer_seller") {
      setFormData((prev) => ({
        ...prev,
        sellerId: user.sellerVerification?.sellerId || "",
        shopName: user.sellerVerification?.shopName || "",
        shopLocationLat: user.sellerVerification?.shopLocation?.latitude || "",
        shopLocationLng: user.sellerVerification?.shopLocation?.longitude || "",
        reviewNotes: user.sellerVerification?.reviewNotes || "",
      }));
    }

    setFileInputs((prev) => ({
      ...prev,
      identityDocument: null,
      farmingProof: null,
      farmPhoto: null,
      shopCertificate: null,
      shopPhoto: null,
    }));
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    setFileInputs((prev) => ({
      ...prev,
      [name]: files?.[0] || null,
    }));
  };

  const useCurrentLocation = async () => {
    try {
      const position = await LocationService.getCurrentLocation();
      setFormData((prev) => {
        if (user.role === "farmer") {
          return {
            ...prev,
            farmLocationLat: position.latitude,
            farmLocationLng: position.longitude,
          };
        }

        return {
          ...prev,
          shopLocationLat: position.latitude,
          shopLocationLng: position.longitude,
        };
      });
      addNotification("Location captured successfully", "success");
    } catch (err) {
      addNotification(err.message || "Unable to get current location", "error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const form = new FormData();
      const {
        farmerId,
        farmLocationLat,
        farmLocationLng,
        sellerId,
        shopName,
        shopLocationLat,
        shopLocationLng,
        reviewNotes,
      } = formData;

      if (user.role === "farmer") {
        if (!fileInputs.identityDocument || !fileInputs.farmingProof || !fileInputs.farmPhoto || !farmerId) {
          throw new Error(t("pleaseCompleteVerificationFields"));
        }

        form.append("identityDocument", fileInputs.identityDocument);
        form.append("farmingProof", fileInputs.farmingProof);
        form.append("farmPhoto", fileInputs.farmPhoto);
        form.append("farmerId", farmerId);
        form.append(
          "farmLocation",
          JSON.stringify({ latitude: Number(farmLocationLat) || null, longitude: Number(farmLocationLng) || null })
        );
        form.append("reviewNotes", reviewNotes || "");
      } else {
        if (!fileInputs.identityDocument || !fileInputs.shopCertificate || !fileInputs.shopPhoto || !sellerId || !shopName) {
          throw new Error(t("pleaseCompleteVerificationFields"));
        }

        form.append("identityDocument", fileInputs.identityDocument);
        form.append("shopCertificate", fileInputs.shopCertificate);
        form.append("shopPhoto", fileInputs.shopPhoto);
        form.append("sellerId", sellerId);
        form.append("shopName", shopName);
        form.append(
          "shopLocation",
          JSON.stringify({ latitude: Number(shopLocationLat) || null, longitude: Number(shopLocationLng) || null })
        );
        form.append("reviewNotes", reviewNotes || "");
      }

      const data = await userAPI.submitVerification(form, true);
      setSuccess(data.message || "Verification request submitted.");
      setVerificationStatus("pending");
      if (data.user) {
        updateUser(data.user);
      }
    } catch (err) {
      setError(err.message || "Unable to submit verification request.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="verification-page">{t("pleaseLoginSubmitVerification")}</div>;
  }

  const isFarmer = user.role === "farmer";
  const headerText = isFarmer ? t("farmerVerification") : t("sellerVerification");
  const descriptionText = isFarmer
    ? t("submitIdentity")
    : t("submitIdentity");

  return (
    <div className="verification-page">
      <div className="verification-card">
        <div className="verification-header">
          <h2>{headerText}</h2>
          <p>{descriptionText}</p>
          <div className={`verification-status ${verificationStatus}`}>
            {t("currentStatus")} <strong>{verificationStatus.replace(/_/g, " ")}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="verification-form">
          <div className="form-group">
            <label>{t("identityDocument")} *</label>
            <input
              type="file"
              name="identityDocument"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
            />
          </div>

          {isFarmer ? (
            <>
              <div className="form-group">
                <label>{t("farmingProof")} *</label>
                <input
                  type="file"
                  name="farmingProof"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                />
              </div>
              <div className="form-group">
                <label>{t("farmPhoto")} *</label>
                <input
                  type="file"
                  name="farmPhoto"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                />
              </div>
              <div className="form-group">
                <label>{t("farmerId")} *</label>
                <input
                  type="text"
                  name="farmerId"
                  value={formData.farmerId}
                  onChange={handleInputChange}
                  placeholder={t("enterFarmerIdPlaceholder")}
                />
              </div>
              <div className="form-group location-grid">
                <div>
                  <label>{t("farmLocationLatitude")}</label>
                  <input
                    type="number"
                    name="farmLocationLat"
                    value={formData.farmLocationLat}
                    onChange={handleInputChange}
                    placeholder={t("latitudePlaceholder")}
                  />
                </div>
                <div>
                  <label>{t("farmLocationLongitude")}</label>
                  <input
                    type="number"
                    name="farmLocationLng"
                    value={formData.farmLocationLng}
                    onChange={handleInputChange}
                    placeholder={t("longitudePlaceholder")}
                  />
                </div>
                <button type="button" className="location-btn" onClick={useCurrentLocation}>
                  📍 {t("useCurrentLocation")}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>{t("shopCertificate")} *</label>
                <input
                  type="file"
                  name="shopCertificate"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                />
              </div>
              <div className="form-group">
                <label>{t("shopPhoto")} *</label>
                <input
                  type="file"
                  name="shopPhoto"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                />
              </div>
              <div className="form-group">
                <label>{t("sellerId")} *</label>
                <input
                  type="text"
                  name="sellerId"
                  value={formData.sellerId}
                  onChange={handleInputChange}
                  placeholder={t("enterSellerIdPlaceholder")}
                />
              </div>
              <div className="form-group">
                <label>{t("shopName")} *</label>
                <input
                  type="text"
                  name="shopName"
                  value={formData.shopName}
                  onChange={handleInputChange}
                  placeholder={t("enterShopNamePlaceholder")}
                />
              </div>
              <div className="form-group location-grid">
                <div>
                  <label>{t("shopLocationLatitude")}</label>
                  <input
                    type="number"
                    name="shopLocationLat"
                    value={formData.shopLocationLat}
                    onChange={handleInputChange}
                    placeholder={t("latitudePlaceholder")}
                  />
                </div>
                <div>
                  <label>{t("shopLocationLongitude")}</label>
                  <input
                    type="number"
                    name="shopLocationLng"
                    value={formData.shopLocationLng}
                    onChange={handleInputChange}
                    placeholder={t("longitudePlaceholder")}
                  />
                </div>
                <button type="button" className="location-btn" onClick={useCurrentLocation}>
                  📍 {t("useCurrentLocation")}
                </button>
              </div>
            </>
          )}

          <div className="form-group">
            <label>{t("additionalNotes")}</label>
            <textarea
              name="reviewNotes"
              value={formData.reviewNotes}
              onChange={handleInputChange}
              placeholder={t("optionalNotesForVerifier")}
              rows="4"
            />
          </div>

          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">{success}</div>}

          <div className="verification-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate(-1)}>
              {t("back")}
            </button>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? t("submitting") : t("submitVerification")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Verification;
