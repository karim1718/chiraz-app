import { useTranslation } from 'react-i18next';
import { LOCALE_STORAGE_KEY } from '../i18n';

const LANGS = ['fr', 'en', 'ar'] as const;

type Props = {
  className?: string;
  compact?: boolean;
};

export default function LanguageSwitcher({ className = '', compact }: Props) {
  const { t, i18n } = useTranslation();

  const setLang = (code: (typeof LANGS)[number]) => {
    void i18n.changeLanguage(code);
    localStorage.setItem(LOCALE_STORAGE_KEY, code);
  };

  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      role="group"
      aria-label={t('languageSwitcher.aria')}
    >
      {LANGS.map((code) => {
        const active = i18n.language === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className={
              compact
                ? `min-h-[36px] min-w-[36px] rounded px-2 text-[11px] font-semibold tracking-wide transition-colors ${
                    active
                      ? 'bg-[#E4E1D5] text-[#0a0a0a]'
                      : 'text-[#E4E1D5]/70 hover:text-[#E4E1D5]'
                  }`
                : `min-h-[40px] px-3 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                    active
                      ? 'text-[#E4E1D5] underline underline-offset-4'
                      : 'text-[#E4E1D5]/55 hover:text-[#E4E1D5]'
                  }`
            }
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
