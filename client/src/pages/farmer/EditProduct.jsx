import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { productAPI } from "../../services/api.js";
import { useNotification } from "../../context/AppHooks.js";
import "./addproduct.css";

const EditProduct = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [unit, setUnit] = useState("kg");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      setLoading(true);
      try {
        const response = await productAPI.getProduct(id);
        const product = response.product;
        setProductName(product.name || "");
        setCategory(product.category || "");
        setQuantity(product.quantity || "");
        setMarketPrice(product.price || "");
        setUnit(product.unit || "kg");
        setLocation(product.address || product.location?.name || "");
        setDescription(product.description || "");
        setImageUrl(product.images?.[0]?.url || "");
      } catch (error) {
        addNotification(error.message || "Unable to load product details", "error");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadProduct();
    }
  }, [id, addNotification]);

  const handleSubmit = async () => {
    if (!productName || !category || !quantity || !marketPrice || !location) {
      addNotification("Please fill in all required fields", "error");
      return;
    }

    setSubmitting(true);
    try {
      const images = imageUrl ? [{ url: imageUrl, alt: productName }] : [];
      await productAPI.updateProduct(id, {
        name: productName,
        description,
        category,
        price: Number(marketPrice),
        quantity: Number(quantity),
        unit,
        images,
        address: location,
        location: {
          type: "Point",
          coordinates: [0, 0],
        },
      });
      addNotification("Product updated successfully", "success");
      navigate("/farmer");
    } catch (error) {
      addNotification(error.message || "Unable to update product", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="add-product-page">
        <p>Loading product details...</p>
      </div>
    );
  }

  return (
    <div className="add-product-page">
      <div className="add-product-header">
        <h2>Edit Product</h2>
        <p>Update your listing and pricing details</p>
      </div>

      <div className="add-product-container">
        <div className="add-product-form-card">
          <div className="form-group">
            <label>Product Name</label>
            <input
              type="text"
              placeholder="Enter product name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select category</option>
              <option value="vegetables">Vegetables</option>
              <option value="fruits">Fruits</option>
              <option value="grains">Grains</option>
              <option value="pulses">Pulses</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Quantity ({unit})</label>
              <input
                type="number"
                placeholder="Enter quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Market Price (₹/{unit})</label>
              <input
                type="number"
                placeholder="Enter market price"
                value={marketPrice}
                onChange={(e) => setMarketPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Unit</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="kg">kg</option>
              <option value="quintal">quintal</option>
              <option value="ton">ton</option>
              <option value="piece">piece</option>
            </select>
          </div>

          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              placeholder="Enter farm location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Product Image URL</label>
            <input
              type="text"
              placeholder="Image URL"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              placeholder="Write short product description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <button
            className="submit-btn"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Updating..." : "Update Product"}
          </button>
        </div>

        <div className="ai-price-card">
          <h3>Update Notes</h3>
          <p>
            Keep product details up to date so buyers receive accurate pricing and stock information.
          </p>
          <div className="ai-note">
            <strong>Tip:</strong>
            <ul>
              <li>Use a real product image URL</li>
              <li>Update stock levels after harvest</li>
              <li>Keep description concise and clear</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProduct;
