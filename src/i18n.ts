import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { TRANSLATIONS } from './translations'; // O la ruta que tinguis

const resources = {
  ca: { translation: TRANSLATIONS?.ca || {} },
  es: { translation: TRANSLATIONS?.es || {} },
  en: { translation: TRANSLATIONS?.en || {} },
  fr: { translation: TRANSLATIONS?.fr || {} },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ca',
    interpolation: { escapeValue: false },
  });

export default i18n;