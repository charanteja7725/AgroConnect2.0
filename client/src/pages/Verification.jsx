import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useNotification } from "../context/AppHooks.js";
import { uploadAPI, userAPI } from "../services/api.js";
import LocationService from "../services/LocationService.js";
import "./verification.css";

const hasExistingMedia = (media) => Boolean(media?.publicId || media?.url);

const Verification = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { addNotification } = useNotification();

  const [aadhaarFrontFile, setAadhaarFrontFile] = useState(null);
  const [aadhaarBackFile, setAadhaarBackFile] = useState(null);
  const [farmPhotoFile, setFarmPhotoFile] = useState(null);
  const [farmingVideoFile, setFarmingVideoFile] = useState(null);

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [farmAddress, setFarmAddress] = useState("");
  const [village, setVillage] = useState("");
  const [district, setDistrict] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [consent, setConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const verificationStatus = user?.verificationStatus || "not_submitted";
  const isFarmer = user?.role === "farmer";

  useEffect(() => {
    if (!user) return;

    const location = user.verificationDocuments?.farmLocation || {};
    setLatitude(location.latitude ?? "");
    setLongitude(location.longitude ?? "");
    setFarmAddress(location.address || "");
    setVillage(location.village || "");
    setDistrict(location.district || "");
    setState(location.state || "");
    setPincode(location.pincode || "");
    setAdditionalNotes(user.verificationDocuments?.additionalNotes || "");
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

  const validateImage = (file, label) => {
    if (!file) return true;
    if (!file.type.startsWith("image/")) {
      setError(`${label} must be an image file.`);
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(`${label} must be 10 MB or smaller.`);
      return false;
    }
    return true;
  };

  const validateVideo = (file) => {
    if (!file) return true;
    if (!file.type.startsWith("video/")) {
      setError("Farming verification video must be a video file.");
      return false;
    }
    if (file.size > 60 * 1024 * 1024) {
      setError("Farming verification video must be 60 MB or smaller.");
      return false;
    }
    return true;
  };

  const useCurrentLocation = async () => {
    setError("");
    setLocationLoading(true);

    try {
      const position = await LocationService.getCurrentLocation();
      setLatitude(position.latitude);
      setLongitude(position.longitude);
      addNotification?.("Farm GPS location captured", "success");
    } catch (err) {
      setError(err.message || "Unable to get the farm location.");
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const docs = user?.verificationDocuments || {};

    if (!aadhaarFrontFile && !hasExistingMedia(docs.aadhaarFront)) {
      setError("Upload the front photo of the farmer's Aadhaar card.");
      return;
    }

    if (!aadhaarBackFile && !hasExistingMedia(docs.aadhaarBack)) {
      setError("Upload the back photo of the farmer's Aadhaar card.");
      return;
    }

    if (!farmPhotoFile && !hasExistingMedia(docs.farmPhoto)) {
      setError("Upload a current photo of the farm.");
      return;
    }

    if (!farmingVideoFile && !hasExistingMedia(docs.farmingVideo)) {
      setError("Upload a short farming verification video.");
      return;
    }

    if (!validateImage(aadhaarFrontFile, "Aadhaar front")) return;
    if (!validateImage(aadhaarBackFile, "Aadhaar back")) return;
    if (!validateImage(farmPhotoFile, "Farm photo")) return;
    if (!validateVideo(farmingVideoFile)) return;

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      latitude === "" ||
      longitude === "" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      setError("Capture a valid GPS location for the farm.");
      return;
    }

    if (!farmAddress.trim() || !district.trim() || !state.trim()) {
      setError("Farm address, district and state are required for local manual verification.");
      return;
    }

    if (!consent) {
      setError("Confirm that the submitted farm and identity evidence belongs to you.");
      return;
    }

    setSubmitting(true);

    try {
      const [aadhaarFront, aadhaarBack, farmPhoto, farmingVideo] =
        await Promise.all([
          aadhaarFrontFile
            ? uploadAPI.uploadAadhaarFront(aadhaarFrontFile)
            : Promise.resolve(null),
          aadhaarBackFile
            ? uploadAPI.uploadAadhaarBack(aadhaarBackFile)
            : Promise.resolve(null),
          farmPhotoFile
            ? uploadAPI.uploadFarmPhoto(farmPhotoFile)
            : Promise.resolve(null),
          farmingVideoFile
            ? uploadAPI.uploadFarmingVideo(farmingVideoFile)
            : Promise.resolve(null),
        ]);

      const payload = {
        aadhaarFront,
        aadhaarBack,
        farmPhoto,
        farmingVideo,
        farmLocation: {
          latitude: lat,
          longitude: lng,
          address: farmAddress.trim(),
          village: village.trim(),
          district: district.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
        },
        additionalNotes: additionalNotes.trim(),
      };

      const result = await userAPI.submitVerification(payload);

      setSuccess(
        result.message ||
          "Verification submitted. A local AgroConnect employee will review it manually."
      );
      addNotification?.("Farmer verification submitted", "success");

      setAadhaarFrontFile(null);
      setAadhaarBackFile(null);
      setFarmPhotoFile(null);
      setFarmingVideoFile(null);
      setConsent(false);

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
            <h2>Farmer Verification</h2>
            <p>This manual verification form is available only for farmer accounts.</p>
          </div>
          <div className="verification-actions standalone-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate(-1)}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (verificationStatus === "verified") {
    return (
      <div className="verification-page">
        <div className="verification-card">
          <div className="verification-header verified-header">
            <h2>✅ Verified Farmer</h2>
            <p>
              Your identity and farm evidence were manually reviewed and approved by AgroConnect.
            </p>
          </div>

          <div className="verification-summary-box success-summary">
            <strong>Manual verification complete</strong>
            <span>You can publish products and sell through the farmer marketplace.</span>
          </div>

          <div className="verification-actions standalone-actions">
            <button type="button" className="submit-btn" onClick={() => navigate("/farmer")}>
              Back to Farmer Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (verificationStatus === "pending") {
    return (
      <div className="verification-page">
        <div className="verification-card">
          <div className="verification-header">
            <h2>⏳ Verification Under Manual Review</h2>
            <p>
              Your Aadhaar photos, farm photo, farming video and farm location have been submitted.
              A local AgroConnect verification employee will review the evidence.
            </p>
            <div className="verification-status pending">
              Current status: <strong>pending</strong>
            </div>
          </div>

          <div className="verification-summary-box">
            <strong>No API or automatic government-registry approval is used.</strong>
            <span>The final decision is made manually by an authorised AgroConnect reviewer.</span>
          </div>

          <div className="verification-actions standalone-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate("/farmer")}>
              Back to Farmer Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (verificationStatus === "suspended") {
    return (
      <div className="verification-page">
        <div className="verification-card">
          <div className="verification-header">
            <h2>🚫 Farmer Verification Suspended</h2>
            <p>Please contact AgroConnect support or the local verification team for assistance.</p>
          </div>
          <div className="verification-actions standalone-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate("/farmer")}>
              Back
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
          <div className="verification-eyebrow">MANUAL FARMER VERIFICATION</div>
          <h2>Verify Your Farmer Account</h2>
          <p>
            Submit identity and farm evidence. AgroConnect employees responsible for your area will
            manually review the submission before your seller account is approved.
          </p>
          <div className={`verification-status ${verificationStatus}`}>
            Current status: <strong>{verificationStatus.replace(/_/g, " ")}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="verification-form">
          <section className="verification-form-section">
            <div className="section-number">1</div>
            <div>
              <h3>Identity Evidence</h3>
              <p className="section-help">
                Upload clear Aadhaar front and back photos. A masked Aadhaar is preferred when it
                still gives the reviewer enough information to confirm your identity.
              </p>
            </div>
          </section>

          <div className="document-grid">
            <div className="upload-field">
              <label>Aadhaar Front Photo *</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setAadhaarFrontFile(e.target.files?.[0] || null)}
                disabled={submitting}
              />
              <small>
                {hasExistingMedia(user.verificationDocuments?.aadhaarFront) && !aadhaarFrontFile
                  ? "Already uploaded. Choose a file only to replace it."
                  : "JPG, PNG or WebP • maximum 10 MB"}
              </small>
            </div>

            <div className="upload-field">
              <label>Aadhaar Back Photo *</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setAadhaarBackFile(e.target.files?.[0] || null)}
                disabled={submitting}
              />
              <small>
                {hasExistingMedia(user.verificationDocuments?.aadhaarBack) && !aadhaarBackFile
                  ? "Already uploaded. Choose a file only to replace it."
                  : "JPG, PNG or WebP • maximum 10 MB"}
              </small>
            </div>
          </div>

          <section className="verification-form-section">
            <div className="section-number">2</div>
            <div>
              <h3>Farm Evidence</h3>
              <p className="section-help">
                The farm photo and video should be current and clearly show the farming activity and
                surrounding land.
              </p>
            </div>
          </section>

          <div className="document-grid">
            <div className="upload-field">
              <label>Current Farm Photo *</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFarmPhotoFile(e.target.files?.[0] || null)}
                disabled={submitting}
              />
              <small>
                {hasExistingMedia(user.verificationDocuments?.farmPhoto) && !farmPhotoFile
                  ? "Already uploaded. Choose a file only to replace it."
                  : "Use a clear wide photo of the farm • maximum 10 MB"}
              </small>
            </div>

            <div className="upload-field">
              <label>Farming Verification Video *</label>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(e) => setFarmingVideoFile(e.target.files?.[0] || null)}
                disabled={submitting}
              />
              <small>
                {hasExistingMedia(user.verificationDocuments?.farmingVideo) && !farmingVideoFile
                  ? "Already uploaded. Choose a file only to replace it."
                  : "Show the farm and farming activity • maximum 60 MB"}
              </small>
            </div>
          </div>

          <section className="verification-form-section">
            <div className="section-number">3</div>
            <div>
              <h3>Farm Location</h3>
              <p className="section-help">
                Capture GPS while you are at the farm and provide the address so the local verification
                employee can locate the farm if an on-site check is required.
              </p>
            </div>
          </section>

          <div className="form-group">
            <label>Farm Address *</label>
            <input
              type="text"
              value={farmAddress}
              onChange={(e) => setFarmAddress(e.target.value)}
              placeholder="Survey/door number, road or farm name"
              disabled={submitting}
            />
          </div>

          <div className="address-grid">
            <div className="form-group">
              <label>Village / Town</label>
              <input
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="Village or town"
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label>District *</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="District"
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label>State *</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label>PIN Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength="6"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit PIN code"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="location-capture-card">
            <div className="location-values">
              <div>
                <span>Latitude</span>
                <strong>{latitude === "" ? "Not captured" : latitude}</strong>
              </div>
              <div>
                <span>Longitude</span>
                <strong>{longitude === "" ? "Not captured" : longitude}</strong>
              </div>
            </div>
            <button
              type="button"
              className="location-btn"
              onClick={useCurrentLocation}
              disabled={submitting || locationLoading}
            >
              {locationLoading ? "Getting GPS..." : "📍 Capture Farm GPS Location"}
            </button>
          </div>

          <div className="form-group">
            <label>Additional Notes</label>
            <textarea
              rows="4"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Farm size, crops grown, local landmark, best time for a verification visit, etc."
              disabled={submitting}
            />
          </div>

          {user.adminReview?.moreInfoRequest && (
            <div className="form-warning">
              <strong>Reviewer requested more information:</strong>{" "}
              {user.adminReview.moreInfoRequest}
            </div>
          )}

          {user.adminReview?.rejectionReason && verificationStatus === "rejected" && (
            <div className="form-error">
              <strong>Previous rejection reason:</strong> {user.adminReview.rejectionReason}
            </div>
          )}

          <label className="consent-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={submitting}
            />
            <span>
              I confirm that the identity documents and farm evidence belong to me and I consent to
              manual review by authorised AgroConnect verification staff.
            </span>
          </label>

          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">{success}</div>}

          <div className="verification-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate("/farmer")}>
              Back
            </button>
            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? "Uploading evidence..." : "Submit for Manual Verification"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Verification;
