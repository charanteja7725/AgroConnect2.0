import React from "react";
import { useNavigate } from "react-router-dom";
import { FaMicrophone, FaSearch, FaTruck } from "react-icons/fa";
import { MdOutlineAgriculture } from "react-icons/md";
import { FiShoppingCart } from "react-icons/fi";
import { useLanguage } from "../context/LanguageContext.jsx";
import "./home.css";

function Home() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="home">

      {/* NAVBAR */}
      <div className="navbar">
        <div className="logo">
          <MdOutlineAgriculture size={20} />
          <span>{t("appName")}</span>
        </div>

        <div className="nav-buttons">
          <button onClick={() => navigate("/login")}>{t("login")}</button>
          <button className="register" onClick={() => navigate("/roles")}>{t("register")}</button>
        </div>
      </div>

      {/* HERO */}
      <div className="hero">
        <div className="overlay">
          <div className="hero-content">

            <div className="mic">
              <FaMicrophone />
            </div>

            <h1>{t("heroTitle")}</h1>

            <p>
              {t("heroDescription")}
            </p>

            {/* SEARCH BAR */}
            <div className="search-box">
              <select>
                <option>All Areas</option>
              </select>

              <input placeholder={t("searchPlaceholder")} />

              <span className="mic-icon">
                <FaMicrophone />
              </span>

              <button className="search-btn">
                <FaSearch />
              </button>
            </div>

         <button 
  className="start-btn" 
  onClick={() => navigate("/roles")}
>
  {t("getStarted")}
</button>

          </div>
        </div>
      </div>

      {/* WHO WE SERVE */}
      <div className="serve">
        <h2>{t("whoWeServeTitle")}</h2>

        <div className="cards">

          {/* FARMERS */}
          <div className="card green">
            <div className="card-icon">
              <MdOutlineAgriculture size={24} />
            </div>
            <h3>{t("farmerCardTitle")}</h3>
            <ul>
              <li>{t("farmerCardBenefits")}</li>
            </ul>
          </div>

          {/* CUSTOMERS */}
          <div className="card orange">
            <div className="card-icon">
              <FiShoppingCart size={24} />
            </div>
            <h3>{t("customerCardTitle")}</h3>
            <ul>
              <li>{t("customerCardBenefits")}</li>
            </ul>
          </div>

          {/* DELIVERY */}
          <div className="card blue">
            <div className="card-icon">
              <FaTruck size={24} />
            </div>
            <h3>{t("deliveryCardTitle")}</h3>
            <ul>
              <li>{t("deliveryCardBenefits")}</li>
            </ul>
          </div>

        </div>
      </div>

      {/* STEPS SECTION */}
      <div className="steps">
        <h2>{t("simpleAccessible")}</h2>

        <div className="step-container">

          <div className="step">
            <div className="circle">1</div>
            <h4>{t("chooseRoleStep")}</h4>
            <p>{t("chooseRoleSubtitle")}</p>
          </div>

          <div className="step">
            <div className="circle">2</div>
            <h4>{t("voiceOrTextStep")}</h4>
            <p>{t("voiceOrTextStep")}</p>
          </div>

          <div className="step">
            <div className="circle">3</div>
            <h4>{t("startTradingStep")}</h4>
            <p>{t("startTradingStep")}</p>
          </div>

        </div>
      </div>

      {/* FOOTER */}
      <div className="footer">
        <p>{t("appName")}</p>
        <span>{t("footerTagline")}</span>
      </div>

    </div>
  );
}

export default Home;