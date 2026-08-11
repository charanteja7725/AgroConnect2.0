import { useEffect, useState } from "react";
import "./farmerdashboard.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AppContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { orderAPI, productAPI, userAPI } from "../../services/api.js";
const FarmerDashboard = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [verificationStatus, setVerificationStatus] = useState("not_submitted");
  const [profile, setProfile] = useState(user);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user?._id) return;

      setLoadingDashboard(true);
      setDashboardError("");

      try {
        const [productResponse, orderResponse, profileResponse] = await Promise.all([
          productAPI.getSellerProducts(user._id),
          orderAPI.getOrders(),
          userAPI.getUser(user._id),
        ]);

        setProducts(productResponse.products || []);
        setOrders(orderResponse.orders || []);
        setProfile(profileResponse.user || user);
        setVerificationStatus(profileResponse.user?.farmerVerification?.status || "not_submitted");
      } catch (err) {
        setDashboardError("Failed to load farmer dashboard. Please refresh the page.");
        console.error(err);
      } finally {
        setLoadingDashboard(false);
      }
    };

    loadDashboardData();
  }, [user?._id, user]);

  const sectionTitle = {
    dashboard: t("farmerWelcome"),
    "my-products": t("myProducts"),
    orders: t("orders"),
    "price-suggestions": t("priceSuggestions"),
    payments: t("payments"),
    profile: t("profile"),
  };

  const sectionDescription = {
    dashboard: t("manageYourProducts"),
    "my-products": t("noProductsYet"),
    orders: t("yourOrders"),
    "price-suggestions": t("priceSuggestions"),
    payments: t("revenueTitle"),
    profile: t("profile"),
  };

  const totalProducts = products.length;
  const activeOrders = orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
  const completedOrders = orders.filter((order) => order.status === "delivered");
  const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || order.totalPrice || 0), 0);
  const recentProducts = products.slice(0, 3);
  const recentOrders = orders.slice(0, 3);

  const renderSectionContent = () => {
    switch (activeSection) {
      case "my-products":
        return (
          <div className="dashboard-section">
            <h3>{t("myProducts")}</h3>
            {products.length ? (
              <div className="product-table">
                <div className="product-row header">
                  <span>{t("product")}</span>
                  <span>{t("category")}</span>
                  <span>{t("price")}</span>
                  <span>{t("quantity")}</span>
                </div>
                {products.map((product) => (
                  <div className="product-row" key={product._id || product.id}>
                    <span>{product.name}</span>
                    <span>{product.category || product.type}</span>
                    <span>₹{product.price}</span>
                    <span>{product.quantity} {product.unit || "kg"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>{t("noProductsYet")}</p>
                <button className="section-action" onClick={() => navigate("/farmer/add-product")}>{t("addYourFirstProduct")}</button>
              </div>
            )}
          </div>
        );

      case "orders":
        return (
          <div className="dashboard-section">
            <h3>{t("orders")}</h3>
            {orders.length ? (
              <>
                <div className="order-summary-card">
                  <p>{t("pendingOrders")}: {activeOrders.length}</p>
                  <p>{t("completed")}: {completedOrders.length}</p>
                </div>
                <div className="product-table">
                  <div className="product-row header">
                    <span>{t("orderId")}</span>
                    <span>{t("buyer")}</span>
                    <span>{t("total")}</span>
                    <span>{t("status")}</span>
                  </div>
                  {recentOrders.map((order) => (
                    <div className="product-row" key={order._id || order.id}>
                      <span>#{order._id?.slice(-6) || order.id}</span>
                      <span>{order.buyer?.firstName} {order.buyer?.lastName}</span>
                      <span>₹{order.totalAmount || order.totalPrice || 0}</span>
                      <span>{order.status}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>{t("noOrdersYet")}</p>
                <p>{t("listProductsHint")}</p>
              </div>
            )}
          </div>
        );
      case "price-suggestions":
        return (
          <div className="dashboard-section">
            <h3>{t("priceSuggestions")}</h3>
            {products.length ? (
              <div className="suggestion-box">
                <p>
                  {t("priceSuggestionDescription")} ₹{Math.round(totalRevenue / Math.max(products.length, 1))}.
                </p>
                <p>
                  {t("priceSuggestionHint")}
                </p>
              </div>
            ) : (
              <div className="empty-state">
                <p>{t("addProductsForPriceSuggestions")}</p>
              </div>
            )}
          </div>
        );
      case "payments":
        return (
          <div className="dashboard-section">
            <h3>{t("payments")}</h3>
            <div className="payment-summary-card">
              <p>{t("totalRevenue")}: ₹{totalRevenue}</p>
              <p>{t("ordersReceived")}: {orders.length}</p>
            </div>
            {orders.length === 0 && (
              <div className="empty-state">
                <p>{t("noSalesYet")}</p>
                <p>{t("listProductsHintShort")}</p>
              </div>
            )}
          </div>
        );

      case "profile":
        return (
          <div className="dashboard-section">
            <h3>{t("profile")}</h3>
            <div className="profile-card">
              <p>{t("fullName")}: {profile?.firstName} {profile?.lastName}</p>
              <p>{t("email")}: {profile?.email}</p>
              <p>{t("phoneLabel")}: {profile?.phone}</p>
              <p>{t("role")}: {profile?.role}</p>
              {profile?.address?.city && <p>{t("location")}: {profile.address.city}, {profile.address.state}</p>}
            </div>
          </div>
        );

      default:
        return (
          <>
            <div className="summary-grid">
              <div className="summary-card">
                <h4>{t("totalProducts")}</h4>
                <p>{totalProducts}</p>
              </div>
              <div className="summary-card">
                <h4>{t("activeOrders")}</h4>
                <p>{activeOrders.length}</p>
              </div>
              <div className="summary-card">
                <h4>{t("revenue")}</h4>
                <p>₹{totalRevenue}</p>
              </div>
              <div className="summary-card">
                <h4>{t("pendingOrders")}</h4>
                <p>{orders.length - completedOrders.length}</p>
              </div>
            </div>

            <div className="dashboard-section">
              <h3>{t("verificationStatus")}</h3>
              <p className="placeholder-text">
                {t("currentStatus")} <strong>{verificationStatus.replace(/_/g, " ")}</strong>
              </p>
              <p className="placeholder-text">
                {verificationStatus === "verified"
                  ? t("verificationSaved")
                  : t("submitVerification")}
              </p>
              {verificationStatus !== "verified" && (
                <button className="section-action" onClick={() => navigate("/verification")}>{t("submitVerification")}</button>
              )}
            </div>

            <div className="dashboard-section">
              <h3>{t("quickActions")}</h3>

              <div className="action-grid">
                <div className="action-card">
                  <h4>{t("addNewProduct")}</h4>
                  <p>{t("addProductDescription")}</p>
                  <button onClick={() => navigate("/farmer/add-product")}>{t("addProductButton")}</button>
                </div>
                <div className="action-card">
                  <h4>{t("buyFertilizers")}</h4>
                  <p>{t("buyFertilizersDesc")}</p>
                  <button onClick={() => navigate("/fertilizer")}>{t("openMarket")}</button>
                </div>

                <div className="action-card">
                  <h4>{t("viewOrders")}</h4>
                  <p>{t("viewOrdersHint")}</p>
                  <button onClick={() => setActiveSection("orders")}>{t("checkOrders")}</button>
                </div>
              </div>
            </div>

            <div className="dashboard-section">
              <h3>{t("recentProducts")}</h3>
              {recentProducts.length ? (
                <div className="product-table">
                  <div className="product-row header">
                    <span>{t("product")}</span>
                    <span>{t("quantity")}</span>
                    <span>{t("price")}</span>
                    <span>{t("status")}</span>
                  </div>
                  {recentProducts.map((product) => (
                    <div className="product-row" key={product._id || product.id}>
                      <span>{product.name}</span>
                      <span>{product.quantity} {product.unit || "kg"}</span>
                      <span>₹{product.price}/{product.unit || "kg"}</span>
                      <span className={`status active-status ${product.isActive ? 'active' : 'inactive'}`}>
                  {product.isActive ? t("active") : t("inactive")}
                </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>{t("noProductsAddedYet")}</p>
                </div>
              )}
            </div>

            <div className="dashboard-section">
              <h3>{t("recentOrders")}</h3>
              {recentOrders.length ? (
                <div className="product-table">
                  <div className="product-row header">
                    <span>{t("order")}</span>
                    <span>{t("buyer")}</span>
                    <span>{t("total")}</span>
                    <span>{t("status")}</span>
                  </div>
                  {recentOrders.map((order) => (
                    <div className="product-row" key={order._id || order.id}>
                      <span>#{order._id?.slice(-6) || order.id}</span>
                      <span>{order.buyer?.firstName} {order.buyer?.lastName}</span>
                      <span>₹{order.totalAmount || order.totalPrice || 0}</span>
                      <span>{order.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>{t("noOrdersHaveBeenPlacedYet")}</p>
                </div>
              )}
            </div>
          </>
        );
    }
  };

  return (
    <div className="farmer-dashboard-page">
      {/* Topbar */}
      <div className="farmer-topbar">
        <div className="farmer-brand">🌱 {t("appName")}</div>

        <div className="farmer-topbar-right">
          <LanguageSwitcher />
          <button className="logout-btn" onClick={() => { logout(); navigate("/login"); }}>
            {t("logout")}
          </button>
        </div>
      </div>

      <div className="farmer-layout">
        {/* Sidebar */}
        <div className="farmer-sidebar">
          <h3 className="sidebar-title">{t("farmerWelcome")}</h3>

          <div className={`sidebar-item ${activeSection === "dashboard" ? "active" : ""}`} onClick={() => setActiveSection("dashboard")}>{t("dashboard")}</div>
          <div className={`sidebar-item ${activeSection === "add-product" ? "active" : ""}`} onClick={() => navigate("/farmer/add-product")}>{t("addNewProduct")}</div>
          <div className={`sidebar-item ${activeSection === "my-products" ? "active" : ""}`} onClick={() => setActiveSection("my-products")}>{t("myProducts")}</div>
          <div className={`sidebar-item ${activeSection === "orders" ? "active" : ""}`} onClick={() => setActiveSection("orders")}>{t("orders")}</div>
          <div className="sidebar-item" onClick={() => navigate("/fertilizer")}>{t("buyFertilizers")}</div>
          <div className={`sidebar-item ${activeSection === "price-suggestions" ? "active" : ""}`} onClick={() => setActiveSection("price-suggestions")}>{t("priceSuggestions")}</div>
          <div className={`sidebar-item ${activeSection === "payments" ? "active" : ""}`} onClick={() => setActiveSection("payments")}>{t("payments")}</div>
          <div className={`sidebar-item ${activeSection === "profile" ? "active" : ""}`} onClick={() => setActiveSection("profile")}>{t("profile")}</div>
        </div>

        {/* Main Content */}
        <div className="farmer-main">
          {error && <div className="error-message">{error}</div>}
          <div className="welcome-card">
            <h2>{sectionTitle[activeSection]}</h2>
            <p>{sectionDescription[activeSection]}</p>
          </div>

          {dashboardError && <div className="error-message">{dashboardError}</div>}
          {loadingDashboard ? (
            <div className="loading">{t("loadingDashboard")}</div>
          ) : (
            renderSectionContent()
          )}
        </div>
      </div>
    </div>
  );
};

export default FarmerDashboard;