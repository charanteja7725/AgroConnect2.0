import { createContext, useContext, useEffect, useMemo, useState } from "react";
import translations from "../utils/translations.js";

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const initialLanguage = localStorage.getItem("agroconnect_language") || "en";
  const [language, setLanguage] = useState(initialLanguage);

  useEffect(() => {
    localStorage.setItem("agroconnect_language", language);
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = (lang) => {
    if (!translations[lang]) return;
    setLanguage(lang);
  };

  const t = (key, fallback) => {
    return translations[language]?.[key] || translations.en[key] || fallback || key;
  };

  const value = useMemo(
    () => ({ language, changeLanguage, t }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};
