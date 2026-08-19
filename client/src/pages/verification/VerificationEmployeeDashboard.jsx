import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppHooks.js";
import { userAPI } from "../../services/api.js";
import "./verificationEmployeeDashboard.css";

const hasMedia = (media) => Boolean(media?.previewUrl || media?.url || media?.publicId);

export default function VerificationEmployeeDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [status, setStatus] = useState("pending");
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState({});
  const [working, setWorking] = useState({});

  const loadFarmers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await userAPI.getPendingVerifications(status);
      setFarmers(response.farmers || []);
    } catch (err) {
      setError(err.message || "Unable to load farmers assigned to your area.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadFarmers();
  }, [loadFarmers]);

  const review = async (farmerId, action) => {
    setWorking((prev) => ({ ...prev, [farmerId]: true }));
    setMessage("");
    setError("");
    const note = notes[farmerId] || "";

    try {
      if (action === "verified") {
        await userAPI.reviewVerification(
          farmerId,
          "verified",
          note || "Manual identity, farm media and location evidence reviewed and approved."
        );
      } else if (action === "rejected") {
        await userAPI.reviewVerification(
          farmerId,
          "rejected",
          "",
          note || "Manual verification requirements were not satisfied."
        );
      } else {
        await userAPI.reviewVerification(
          farmerId,
          "more_information_required",
          "",
          "",
          note || "Please provide clearer or additional verification evidence."
        );
      }

      setMessage("Verification decision saved successfully.");
      setNotes((prev) => ({ ...prev, [farmerId]: "" }));
      await loadFarmers();
    } catch (err) {
      setError(err.message || "Unable to save verification decision.");
    } finally {
      setWorking((prev) => ({ ...prev, [farmerId]: false }));
    }
  };

  const areaLabel = [
    user?.verificationArea?.districts?.length
      ? user.verificationArea.districts.join(", ")
      : "All districts",
    user?.verificationArea?.state,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="employee-verification-page">
      <header className="employee-verification-header">
        <div>
          <h1>🌱 AgroConnect Area Verification</h1>
          <p>{areaLabel || "No area assigned"}</p>
        </div>
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Logout
        </button>
      </header>

      <main className="employee-verification-main">
        <section className="employee-intro">
          <h2>Farmer Manual Verification Queue</h2>
          <p>
            Only farmers whose submitted farm location is inside your assigned area appear here.
            Review the identity evidence, farm evidence and GPS location before making a decision.
          </p>
        </section>

        <div className="employee-filter-row">
          {["pending", "more_information_required", "verified", "rejected"].map((item) => (
            <button
              key={item}
              className={status === item ? "active" : ""}
              onClick={() => setStatus(item)}
            >
              {item.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {error && <div className="employee-alert error">{error}</div>}
        {message && <div className="employee-alert success">{message}</div>}

        {loading ? (
          <div className="employee-empty">Loading assigned farmers...</div>
        ) : farmers.length === 0 ? (
          <div className="employee-empty">No farmers found for this status in your assigned area.</div>
        ) : (
          <div className="employee-farmer-list">
            {farmers.map((farmer) => {
              const docs = farmer.verificationDocuments || {};
              const location = docs.farmLocation || {};
              const lat = Number(location.latitude);
              const lng = Number(location.longitude);
              const hasGps = Number.isFinite(lat) && Number.isFinite(lng);

              return (
                <article className="employee-farmer-card" key={farmer._id}>
                  <div className="employee-farmer-title">
                    <div>
                      <h3>{farmer.firstName} {farmer.lastName}</h3>
                      <p>{farmer.email} • {farmer.phone}</p>
                    </div>
                    <span>{farmer.verificationStatus?.replace(/_/g, " ")}</span>
                  </div>

                  <div className="employee-evidence-grid">
                    {[
                      ["Aadhaar Front", docs.aadhaarFront, "image"],
                      ["Aadhaar Back", docs.aadhaarBack, "image"],
                      ["Farm Photo", docs.farmPhoto, "image"],
                      ["Farming Video", docs.farmingVideo, "video"],
                    ].map(([label, media, type]) => (
                      <div className="employee-evidence-card" key={label}>
                        <strong>{label}</strong>
                        {media?.previewUrl ? (
                          type === "video" ? (
                            <video controls preload="metadata" src={media.previewUrl} />
                          ) : (
                            <a href={media.previewUrl} target="_blank" rel="noreferrer">
                              <img src={media.previewUrl} alt={label} />
                            </a>
                          )
                        ) : (
                          <div className="employee-missing">
                            {hasMedia(media) ? "Secure preview unavailable" : "Missing"}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="employee-location-card">
                    <div><b>Farm:</b> {location.address || "Not provided"}</div>
                    <div><b>Village/Town:</b> {location.village || "Not provided"}</div>
                    <div><b>District:</b> {location.district || "Not provided"}</div>
                    <div><b>State:</b> {location.state || "Not provided"}</div>
                    <div><b>PIN:</b> {location.pincode || "Not provided"}</div>
                    <div><b>GPS:</b> {hasGps ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Not captured"}</div>
                    {hasGps && (
                      <a
                        href={`https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open farm location in Google Maps ↗
                      </a>
                    )}
                  </div>

                  {docs.additionalNotes && (
                    <div className="employee-farmer-note"><b>Farmer note:</b> {docs.additionalNotes}</div>
                  )}

                  {!["verified", "rejected"].includes(farmer.verificationStatus) && (
                    <>
                      <textarea
                        value={notes[farmer._id] || ""}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [farmer._id]: e.target.value }))
                        }
                        placeholder="Reviewer notes, rejection reason, or information request"
                        rows={3}
                      />
                      <div className="employee-review-actions">
                        <button
                          className="approve"
                          disabled={working[farmer._id]}
                          onClick={() => review(farmer._id, "verified")}
                        >
                          ✅ Approve
                        </button>
                        <button
                          className="info"
                          disabled={working[farmer._id]}
                          onClick={() => review(farmer._id, "more_information_required")}
                        >
                          🔵 Request More Info
                        </button>
                        <button
                          className="reject"
                          disabled={working[farmer._id]}
                          onClick={() => review(farmer._id, "rejected")}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
