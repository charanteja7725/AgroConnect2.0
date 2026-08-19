import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { productAPI, uploadAPI } from "../../services/api.js";
import { useAuth, useNotification } from "../../context/AppHooks.js";
import { LocationService } from "../../services/LocationService.js";
import "./addproduct.css";

const AddProduct = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotification();

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
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isVerifiedFarmer =
    user?.role === "farmer" && user?.verificationStatus === "verified";

  useEffect(() => {
    if (!user) return;

    if (user.role !== "farmer") {
      addNotification?.("Only farmer accounts can use the produce listing page", "error");
      navigate("/", { replace: true });
      return;
    }

    if (user.verificationStatus !== "verified") {
      addNotification?.("Complete farmer verification before adding products", "info");
      navigate("/verification", { replace: true });
    }
  }, [addNotification, navigate, user]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  if (user && !isVerifiedFarmer) return null;

  const suggestedPrice = marketPrice
    ? (Number(marketPrice) * 0.95).toFixed(2)
    : "";

  const captureLocation = async () => {
    setLocationLoading(true);
    try {
      const userLocation = await LocationService.getCurrentLocation();
      setLocationCoords(userLocation);

      const address = await LocationService.reverseGeocode(
        userLocation.latitude,
        userLocation.longitude
      );

      const formattedAddress = address
        ? `${address.road || ""} ${
            address.city || address.town || address.village || ""
          } ${address.state || ""}`.trim()
        : LocationService.formatCoordinates(
            userLocation.latitude,
            userLocation.longitude
          );

      setLocationText(formattedAddress);
      setLocationHint("Using current GPS location");
      addNotification?.("Product GPS location captured", "success");
    } catch (err) {
      addNotification?.(err.message || "Unable to get current location", "error");
    } finally {
      setLocationLoading(false);
    }
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

  const handleSubmit = async () => {
    if (!isVerifiedFarmer) {
      navigate("/verification", { replace: true });
      return;
    }

    const numericQuantity = Number(quantity);
    const numericPrice = Number(marketPrice);

    if (!productName.trim() || !category || !description.trim()) {
      addNotification?.("Product name, category and description are required", "error");
      return;
    }

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      addNotification?.("Enter a valid quantity greater than zero", "error");
      return;
    }

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      addNotification?.("Enter a valid price greater than zero", "error");
      return;
    }

    if (!locationText.trim()) {
      addNotification?.("Enter the product/farm address", "error");
      return;
    }

    setSubmitting(true);

    try {
      let imagePayload = [];

      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        const uploadResult = await uploadAPI.uploadImage(formData);

        if (uploadResult?.url) {
          imagePayload = [
            {
              url: uploadResult.url,
              publicId: uploadResult.publicId,
              alt: productName.trim(),
            },
          ];
        }
      }

      const result = await productAPI.createProduct({
        name: productName.trim(),
        description: description.trim(),
        type: "produce",
        category,
        price: numericPrice,
        quantity: numericQuantity,
        unit: "kg",
        images: imagePayload,
        address: locationText.trim(),
        location: {
          type: "Point",
          coordinates: locationCoords
            ? [Number(locationCoords.longitude), Number(locationCoords.latitude)]
            : [0, 0],
          address: locationText.trim(),
        },
      });

      addNotification?.(
        result?.message ||
          (result?.isPublished
            ? "Product published successfully"
            : "Product saved as draft"),
        result?.isPublished === false ? "info" : "success"
      );

      navigate("/farmer");
    } catch (error) {
      const message = error?.message || "Unable to add product";
      addNotification?.(message, "error");

      if (/verified|verification|approved/i.test(message)) {
        navigate("/verification", { replace: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="add-product-page">
      <div className="add-product-header">
        <h2>Add New Produce</h2>
        <p>List fresh farm produce from your verified farmer account.</p>
      </div>

      <div className="add-product-container">
        <div className="add-product-form-card">
          <div className="form-group">
            <label>Product Type</label>
            <input type="text" value="Produce" readOnly />
          </div>

          <div className="form-group">
            <label>Product Name</label>
            <input
              type="text"
              placeholder="Enter product name"
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Category</label>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Select category</option>
              <option value="vegetables">Vegetables</option>
              <option value="fruits">Fruits</option>
              <option value="grains">Grains</option>
              <option value="seeds">Seeds</option>
              <option value="other">Other Produce</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Quantity (kg)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Enter quantity"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Price (₹ / kg)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Enter price"
                value={marketPrice}
                onChange={(event) => setMarketPrice(event.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Farm / Product Location</label>
            <input
              type="text"
              placeholder="Enter farm or pickup address"
              value={locationText}
              onChange={(event) => setLocationText(event.target.value)}
            />

            <div className="location-actions">
              <button
                type="button"
                className="location-btn"
                disabled={locationLoading}
                onClick={captureLocation}
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
              <p className="location-hint">
                GPS: {Number(locationCoords.latitude).toFixed(6)},{" "}
                {Number(locationCoords.longitude).toFixed(6)}
              </p>
            )}
            {!locationCoords && locationText && (
              <p className="location-hint">
                No GPS captured. The backend may save this listing as a draft until GPS is added.
              </p>
            )}
          </div>

          <div className="form-group">
            <label>Upload Product Image</label>
            <input type="file" accept="image/*" onChange={handleImageChange} />
            {imagePreview && (
              <div className="image-preview">
                <img src={imagePreview} alt="Product preview" />
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              placeholder="Describe freshness, variety, harvest details, quality, etc."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <button className="submit-btn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Adding..." : "Add Product"}
          </button>
        </div>

        <div className="ai-price-card">
          <h3>AI Price Suggestion</h3>
          <p>
            This quick estimate is shown as guidance. The final selling price remains your choice.
          </p>
          <div className="price-box">
            {suggestedPrice ? `₹${suggestedPrice} / kg` : "Enter a price first"}
          </div>
          <div className="ai-note">
            <strong>Before publishing:</strong>
            <ul>
              <li>Your farmer account must be manually verified.</li>
              <li>Use your real farm/pickup location.</li>
              <li>Use accurate quantity and product information.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddProduct;
