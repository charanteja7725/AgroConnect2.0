import { useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import "./LanguageSwitcher.css";

export default function LanguageSwitcher() {
  const { language, changeLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div className="language-switcher">
      <button
        type="button"
        className="language-button"
        onClick={() => setOpen((p) => !p)}
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
  );
}
