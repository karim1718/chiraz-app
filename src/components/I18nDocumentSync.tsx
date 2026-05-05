import { useEffect } from 'react';
import i18n from '../i18n';

export default function I18nDocumentSync() {
  useEffect(() => {
    const apply = (lng: string) => {
      document.documentElement.setAttribute('lang', lng);
      document.documentElement.setAttribute('dir', lng === 'ar' ? 'rtl' : 'ltr');
    };
    apply(i18n.language);
    i18n.on('languageChanged', apply);
    return () => {
      i18n.off('languageChanged', apply);
    };
  }, []);
  return null;
}
