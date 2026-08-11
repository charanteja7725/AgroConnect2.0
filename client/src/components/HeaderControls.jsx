import { useState } from "react";
import NotificationBell from "./NotificationBell.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import "./HeaderControls.css";

export default function HeaderControls() {
  const { language, changeLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div className="header-controls">
      <NotificationBell />
      <div className="language-switcher">
        <button
          type="button"
          className="language-button"
          onClick={() => setOpen((prev) => !prev)}
        >
          {language === "en" ? t("english") : t("telugu")} ▼
        </button>
        {open && (
          <div className="language-menu">
            <button
              type="button"
              className={language === "en" ? "language-option active" : "language-option"}
              onClick={() => {
                changeLanguage("en");
                setOpen(false);
              }}
            >
              {t("english")}
            </button>
            <button
              type="button"
              className={language === "te" ? "language-option active" : "language-option"}
              onClick={() => {
                changeLanguage("te");
                setOpen(false);
              }}
            >
              {t("telugu")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
