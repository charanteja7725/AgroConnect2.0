import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext.jsx";
import "./role.css";

const RoleSelection = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="ag-role-page">
      
      {/* Top Green Bar */}
      <div className="ag-role-topbar">
        <div className="ag-role-brand">🌱 AgroConnect</div>
      </div>

      {/* Main Content */}
      <div className="ag-role-content">
        <h2 className="ag-role-title">{t("chooseYourRole")}</h2>
        <p className="ag-role-subtitle">
          {t("chooseRoleSubtitle")}
        </p>

        <div className="ag-role-grid">

          {/* Farmer */}
          <div
            className="ag-role-card farmer-card"
            onClick={() => navigate("/register?role=farmer")}
          >
            <div className="ag-role-icon farmer-icon">🌱</div>
            <h3>{t("farmer")}</h3>
            <p>
              {t("farmerCardBenefits")}
            </p>
            <span className="ag-role-btn farmer-link">{t("getStartedArrow")}</span>
          </div>

          {/* Customer */}
          <div
            className="ag-role-card customer-card"
            onClick={() => navigate("/register?role=buyer")}
          >
            <div className="ag-role-icon customer-icon">🛒</div>
            <h3>{t("customer")}</h3>
            <p>
              {t("customerCardBenefits")}
            </p>
            <span className="ag-role-btn customer-link">{t("getStartedArrow")}</span>
          </div>

          {/* Fertilizer Seller */}
          <div
            className="ag-role-card seller-card"
            onClick={() => navigate("/register?role=fertilizer_seller")}
          >
            <div className="ag-role-icon seller-icon">🏪</div>
            <h3>{t("fertilizerSeller")}</h3>
            <p>
              {t("manageProductsDesc")}
            </p>
            <span className="ag-role-btn seller-link">{t("getStartedArrow")}</span>
          </div>

          {/* Delivery Partner */}
          <div
            className="ag-role-card delivery-card"
            onClick={() => navigate("/register?role=delivery_partner")}
          >
            <div className="ag-role-icon delivery-icon">🚚</div>
            <h3>{t("deliveryPartner")}</h3>
            <p>
              {t("deliveryCardBenefits")}
            </p>
            <span className="ag-role-btn delivery-link">{t("getStartedArrow")}</span>
          </div>

          {/* Admin */}
          <div
            className="ag-role-card admin-card"
            onClick={() => navigate("/login")}
          >
            <div className="ag-role-icon admin-icon">🛡️</div>
            <h3>{t("admin")}</h3>
            <p>
              {t("adminSubtitle")}
            </p>
            <span className="ag-role-btn admin-link">{t("getStartedArrow")}</span>
          </div>

        </div>

        {/* Login Link */}
        <p className="ag-role-login-text">
          {t("alreadyHaveAccount")} <span onClick={() => navigate("/login")}>{t("loginHere")}</span>
        </p>
      </div>

    </div>
  );
};

export default RoleSelection;