import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useNotification } from "../context/AppHooks.js";
import { uploadAPI, userAPI } from "../services/api.js";
import LocationService from "../services/LocationService.js";
import "./verification.css";

const Verification = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { addNotification } = useNotification();

  const [idType, setIdType] = useState("centralid");
  const [farmerId, setFarmerId] = useState("");
  const [farmerIdFile, setFarmerIdFile] = useState(null);
  const [farmPhotoFile, setFarmPhotoFile] = useState(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryResult, setRegistryResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const verificationStatus = user?.verificationStatus || "not_submitted";
  const isFarmer = user?.role === "farmer";

  useEffect(() => {
    if (!user) return;

    setFarmerId(user.farmerVerification?.farmerId || "");
    setIdType(user.farmerVerification?.idType || "centralid");
    setLatitude(user.verificationDocuments?.gpsCoordinates?.latitude ?? "");
    setLongitude(user.verificationDocuments?.gpsCoordinates?.longitude ?? "");
    setAdditionalNotes(user.verificationDocuments?.additionalNotes || "");

    if (user.farmerVerification?.apiVerified) {
      setRegistryResult({
        verified: true,
        farmer: {
          farmerName: user.farmerVerification?.farmerName || "",
          centralId: user.farmerVerification?.centralId || "",
          farmerNumber: user.farmerVerification?.farmerNumber || "",
          approvalStatus: user.farmerVerification?.approvalStatus || "",
          registrationStatus: user.farmerVerification?.registrationStatus || "",
        },
        message: "Farmer registration previously verified.",
      });
    }
  }, [user]);

  const refreshUser = async () => {
    if (!user?._id || !updateUser) return;
    try {
      const response = await userAPI.getUser(user._id);
      if (response?.user) updateUser(response.user);
    } catch (err) {
      console.warn("Unable to refresh user after verification update:", err);
    }
  };

  const handleRegistryCheck = async () => {
    setError("");
    setSuccess("");
    setRegistryResult(null);

    if (!farmerId.trim()) {
      setError("Enter your Farmer ID or enrollment number first.");
      return;
    }

    setRegistryLoading(true);
    try {
      const result = await userAPI.checkFarmerRegistry(idType, farmerId.trim());
      setRegistryResult(result);

      if (result.verified) {
        setSuccess(result.message || "Farmer registration verified successfully.");
        addNotification?.("Farmer registration verified", "success");
      } else {
        setError(
          result.message ||
            "The supplied ID could not be confirmed as an approved active farmer registration."
        );
      }

      await refreshUser();
    } catch (err) {
      setError(err.message || "Unable to verify Farmer ID.");
    } finally {
      setRegistryLoading(false);
    }
  };

  const useCurrentLocation = async () => {
    try {
      const position = await LocationService.getCurrentLocation();
      setLatitude(position.latitude);
      setLongitude(position.longitude);
      addNotification?.("Farm location captured", "success");
    } catch (err) {
      setError(err.message || "Unable to get current location.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!registryResult?.verified && !user?.farmerVerification?.apiVerified) {
      setError("Verify your Farmer ID with the registry before submitting documents.");
      return;
    }

    const hasExistingFarmerId = Boolean(user?.verificationDocuments?.farmerId?.url);
    const hasExistingFarmPhoto = Boolean(user?.verificationDocuments?.farmPhoto?.url);

    if (!farmerIdFile && !hasExistingFarmerId) {
      setError("Upload a clear image of your government-certified Farmer ID.");
      return;
    }

    if (!farmPhotoFile && !hasExistingFarmPhoto) {
      setError("Upload a current photo of your farm.");
      return;
    }

    setSubmitting(true);

    try {
      let farmerIdUpload = null;
      let farmPhotoUpload = null;

      if (farmerIdFile) {
        farmerIdUpload = await uploadAPI.uploadFarmerId(farmerIdFile);
      }

      if (farmPhotoFile) {
        farmPhotoUpload = await uploadAPI.uploadFarmPhoto(farmPhotoFile);
      }

      const payload = {
        additionalNotes,
        gpsLatitude: latitude === "" ? undefined : Number(latitude),
        gpsLongitude: longitude === "" ? undefined : Number(longitude),
        farmerIdUrl: farmerIdUpload?.url,
        farmerIdPublicId: farmerIdUpload?.publicId,
        farmPhotoUrl: farmPhotoUpload?.url,
        farmPhotoPublicId: farmPhotoUpload?.publicId,
      };

      const result = await userAPI.submitVerification(payload);
      setSuccess(result.message || "Verification submitted for admin review.");
      addNotification?.("Verification submitted for review", "success");
      setFarmerIdFile(null);
      setFarmPhotoFile(null);
      await refreshUser();
    } catch (err) {
      setError(err.message || "Unable to submit farmer verification.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return <div className="verification-page">Please log in to continue.</div>;
  }

  if (!isFarmer) {
    return (
      <div className="verification-page">
        <div className="verification-card">
          <div className="verification-header">
            <h2>Seller Verification</h2>
            <p>This verification flow is currently configured for registered farmers.</p>
          </div>
          <button type="button" className="cancel-btn" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (verificationStatus === "verified") {
    return (
      <div className="verification-page">
        <div className="verification-card">
          <div className="verification-header">
            <h2>✅ Verified Farmer</h2>
            <p>Your AgroConnect farmer account has completed registry and admin verification.</p>
          </div>

          <div className="form-success">
            Farmer ID: {user.farmerVerification?.centralId || user.farmerVerification?.farmerId || "Verified"}
          </div>

          <div className="verification-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate("/farmer")}>
              Back to Farmer Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="verification-page">
      <div className="verification-card">
        <div className="verification-header">
          <h2>Farmer Verification</h2>
          <p>
            Confirm your government farmer registration, upload your Farmer ID, and provide a current farm photo.
          </p>
          <div className={`verification-status ${verificationStatus}`}>
            Current status: <strong>{verificationStatus.replace(/_/g, " ")}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="verification-form">
          <div className="form-group">
            <label>Government Farmer ID Type *</label>
            <select
              value={idType}
              onChange={(e) => {
                setIdType(e.target.value);
                setRegistryResult(null);
              }}
              disabled={submitting || registryLoading}
            >
              <option value="centralid">Farmer ID / Central ID</option>
              <option value="enrollmentnumber">Enrollment Number</option>
            </select>
          </div>

          <div className="form-group">
            <label>Farmer ID / Enrollment Number *</label>
            <input
              type="text"
              value={farmerId}
              onChange={(e) => {
                setFarmerId(e.target.value);
                setRegistryResult(null);
              }}
              placeholder="Enter the number exactly as registered"
              autoComplete="off"
              disabled={submitting || registryLoading}
            />
          </div>

          <button
            type="button"
            className="location-btn"
            onClick={handleRegistryCheck}
            disabled={registryLoading || submitting || !farmerId.trim()}
          >
            {registryLoading ? "Checking registry..." : "🔎 Verify Farmer Registration"}
          </button>

          {(registryResult?.verified || user.farmerVerification?.apiVerified) && (
            <div className="form-success">
              <strong>✅ Registry Match Found</strong>
              <div>
                Name: {registryResult?.farmer?.farmerName || user.farmerVerification?.farmerName || "Registered farmer"}
              </div>
              <div>
                Approval: {registryResult?.farmer?.approvalStatus || user.farmerVerification?.approvalStatus || "Approved"}
              </div>
              <div>
                Registration: {registryResult?.farmer?.registrationStatus || user.farmerVerification?.registrationStatus || "Active"}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Government-Certified Farmer ID Photo *</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFarmerIdFile(e.target.files?.[0] || null)}
              disabled={submitting}
            />
            {user.verificationDocuments?.farmerId?.url && !farmerIdFile && (
              <small>An ID document is already uploaded. Select a file only to replace it.</small>
            )}
          </div>

          <div className="form-group">
            <label>Current Farm Photo *</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFarmPhotoFile(e.target.files?.[0] || null)}
              disabled={submitting}
            />
            {user.verificationDocuments?.farmPhoto?.url && !farmPhotoFile && (
              <small>A farm photo is already uploaded. Select a file only to replace it.</small>
            )}
          </div>

          <div className="form-group location-grid">
            <div>
              <label>Farm Latitude</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="Latitude"
              />
            </div>
            <div>
              <label>Farm Longitude</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="Longitude"
              />
            </div>
            <button type="button" className="location-btn" onClick={useCurrentLocation}>
              📍 Use Current Location
            </button>
          </div>

          <div className="form-group">
            <label>Additional Notes</label>
            <textarea
              rows="4"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Farm size, crops grown, village, or any information useful to the reviewer"
            />
          </div>

          {user.adminReview?.moreInfoRequest && (
            <div className="form-error">
              Admin requested more information: {user.adminReview.moreInfoRequest}
            </div>
          )}

          {user.adminReview?.rejectionReason && verificationStatus === "rejected" && (
            <div className="form-error">
              Previous rejection reason: {user.adminReview.rejectionReason}
            </div>
          )}

          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">{success}</div>}

          <div className="verification-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate("/farmer")}>
              Back
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={submitting || registryLoading}
            >
              {submitting ? "Uploading and submitting..." : "Submit for Final Verification"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Verification;
