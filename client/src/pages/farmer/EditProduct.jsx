import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { productAPI } from "../../services/api.js";
import { useAuth, useNotification } from "../../context/AppHooks.js";
import LocationService from "../../services/LocationService.js";
import "./addproduct.css";

const CATEGORY_OPTIONS = {
  produce: [
    ["vegetables", "Vegetables"],
    ["fruits", "Fruits"],
    ["grains", "Grains"],
    ["seeds", "Seeds"],
  ],
  fertilizer: [
    ["npk", "NPK Fertilizer"],
    ["organic", "Organic / Bio Fertilizer"],
    ["pesticide", "Pesticide"],
    ["seeds", "Seeds"],
  ],
};

const VALID_UNITS = ["kg", "liter", "bag", "piece", "box"];

const EditProduct = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const [productType, setProductType] = useState("produce");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [unit, setUnit] = useState("kg");
  const [location, setLocation] = useState("");
  const [locationCoords, setLocationCoords] = useState(null);
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const returnPath = user?.role === "fertilizer_seller" ? "/fertilizer" : "/farmer";
  const categoryOptions = useMemo(
    () => CATEGORY_OPTIONS[productType] || CATEGORY_OPTIONS.produce,
    [productType]
  );

  useEffect(() => {
    const loadProduct = async () => {
      setLoading(true);
      try {
        const response = await productAPI.getProduct(id);
        const product = response.product;
        if (!product) throw new Error("Product not found");

        const sellerId = product.seller?._id || product.seller;
        if (user?._id && sellerId?.toString() !== user._id.toString()) {
          addNotification?.("You can edit only your own products", "error");
          navigate(returnPath, { replace: true });
          return;
        }

        if (user?.role === "farmer" && product.type !== "produce") {
          addNotification?.("Farmer accounts can edit produce listings only", "error");
          navigate("/farmer", { replace: true });
          return;
        }

        if (user?.role === "fertilizer_seller" && product.type !== "fertilizer") {
          addNotification?.("Fertilizer sellers can edit fertilizer listings only", "error");
          navigate("/fertilizer", { replace: true });
          return;
        }

        setProductType(product.type || "produce");
        setProductName(product.name || "");
        setCategory(product.category || "");
        setQuantity(product.quantity ?? "");
        setMarketPrice(product.price ?? "");
        setUnit(VALID_UNITS.includes(product.unit) ? product.unit : "kg");
        setLocation(product.address || "");
        setLocationCoords(
          Array.isArray(product.location?.coordinates) && product.location.coordinates.length === 2
            ? {
                longitude: Number(product.location.coordinates[0]),
                latitude: Number(product.location.coordinates[1]),
              }
            : null
        );
        setDescription(product.description || "");
        setImageUrl(product.images?.[0]?.url || product.mainImage || "");
      } catch (error) {
        addNotification?.(error.message || "Unable to load product details", "error");
      } finally {
        setLoading(false);
      }
    };

    if (id && user) loadProduct();
  }, [addNotification, id, navigate, returnPath, user]);

  const captureLocation = async () => {
    setLocationLoading(true);
    try {
      const current = await LocationService.getCurrentLocation();
      setLocationCoords(current);

      const address = await LocationService.reverseGeocode(current.latitude, current.longitude);
      const formatted = address
        ? [
            address.road,
            address.village || address.town || address.city,
            address.state,
            address.postcode,
          ]
            .filter(Boolean)
            .join(", ")
        : LocationService.formatCoordinates(current.latitude, current.longitude);
      setLocation(formatted);
      addNotification?.("Product location updated", "success");
    } catch (error) {
      addNotification?.(error.message || "Unable to capture location", "error");
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSubmit = async () => {
    const numericQuantity = Number(quantity);
    const numericPrice = Number(marketPrice);

    if (!productName.trim() || !category || !description.trim() || !location.trim()) {
      addNotification?.("Name, category, description and location are required", "error");
      return;
    }

    if (!Number.isFinite(numericQuantity) || numericQuantity < 0) {
      addNotification?.("Enter a valid quantity", "error");
      return;
    }

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      addNotification?.("Enter a valid price greater than zero", "error");
      return;
    }

    setSubmitting(true);
    try {
      const images = imageUrl.trim() ? [{ url: imageUrl.trim() }] : [];
      await productAPI.updateProduct(id, {
        name: productName.trim(),
        description: description.trim(),
        category,
        price: numericPrice,
        quantity: numericQuantity,
        unit,
        images,
        address: location.trim(),
        location: {
          type: "Point",
          coordinates: locationCoords
            ? [Number(locationCoords.longitude), Number(locationCoords.latitude)]
            : [0, 0],
        },
      });

      addNotification?.("Product updated successfully", "success");
      navigate(returnPath);
    } catch (error) {
      addNotification?.(error.message || "Unable to update product", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="add-product-page"><p>Loading product details...</p></div>;
  }

  return (
    <div className="add-product-page">
      <div className="add-product-header">
        <h2>Edit {productType === "fertilizer" ? "Fertilizer" : "Produce"}</h2>
        <p>Update listing, stock, price, and location details.</p>
      </div>

      <div className="add-product-container">
        <div className="add-product-form-card">
          <div className="form-group">
            <label>Product Type</label>
            <input value={productType === "fertilizer" ? "Fertilizer" : "Produce"} readOnly />
          </div>

          <div className="form-group">
            <label>Product Name</label>
            <input value={productName} onChange={(event) => setProductName(event.target.value)} />
          </div>

          <div className="form-group">
            <label>Category</label>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Select category</option>
              {categoryOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Quantity ({unit})</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Price (₹/{unit})</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={marketPrice}
                onChange={(event) => setMarketPrice(event.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Unit</label>
            <select value={unit} onChange={(event) => setUnit(event.target.value)}>
              {VALID_UNITS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Location</label>
            <input value={location} onChange={(event) => setLocation(event.target.value)} />
            <button
              type="button"
              className="location-btn"
              onClick={captureLocation}
              disabled={locationLoading}
            >
              {locationLoading ? "Locating..." : "📍 Update GPS Location"}
            </button>
            {locationCoords && (
              <p className="location-hint">
                GPS: {Number(locationCoords.latitude).toFixed(6)},{" "}
                {Number(locationCoords.longitude).toFixed(6)}
              </p>
            )}
          </div>

          <div className="form-group">
            <label>Product Image URL</label>
            <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>

          <div className="form-row">
            <button className="cancel-btn" type="button" onClick={() => navigate(returnPath)}>
              Cancel
            </button>
            <button className="submit-btn" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Updating..." : "Update Product"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProduct;
