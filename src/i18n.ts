import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import en from './locales/en.json';
import ar from './locales/ar.json';

export const LOCALE_STORAGE_KEY = 'chiraz-locale';

const saved =
  typeof window !== 'undefined' ? localStorage.getItem(LOCALE_STORAGE_KEY) : null;
const lng = saved === 'en' || saved === 'ar' || saved === 'fr' ? saved : 'fr';

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    ar: { translation: ar },
  },
  lng,
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

export default i18n;
