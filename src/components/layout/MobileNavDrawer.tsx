import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useBodyScrollLock } from '../../hooks';
import { useSearchStore } from '../../store/searchStore';
import LanguageSwitcher from '../LanguageSwitcher';

type Props = {
  open: boolean;
  onClose: () => void;
  onSearchOpen?: () => void;
  onLinkClick?: () => void;
};

export default function MobileNavDrawer({ open, onClose, onSearchOpen, onLinkClick }: Props) {
  const { t } = useTranslation();
  const setActiveCategory = useSearchStore((s) => s.setActiveCategory);
  useBodyScrollLock(open);

  const handleNavigate = (categoryId?: string) => {
    if (categoryId) setActiveCategory(categoryId);
    else setActiveCategory('');
    onClose();
    onLinkClick?.();
  };

  const drawer = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/65"
            onClick={onClose}
            aria-hidden
          />
          <motion.nav
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 left-0 z-[130] flex h-[100dvh] w-[92vw] max-w-sm flex-col overflow-y-auto border-r border-[#E4E1D5]/10 bg-[#050505]"
          >
            <div className="flex items-center justify-between px-6 pt-[env(safe-area-inset-top)] pt-6 pb-4 rtl:flex-row-reverse">
              <Link
                to="/"
                onClick={() => handleNavigate()}
                className="inline-flex w-[48%] min-w-[150px] items-center"
                aria-label={t('mobileNav.backHome')}
              >
                <img
                  src="/logo-Chiraz.png"
                  alt={t('common.logo')}
                  className="h-auto w-full object-contain filter invert opacity-95"
                />
              </Link>
              <div className="flex items-center gap-2">
                <LanguageSwitcher compact className="text-[#E4E1D5]" />
                <button type="button" onClick={onClose} className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[#E4E1D5]" aria-label={t('common.close')}>
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-8 pt-6">
              <section className="mb-6 border-b border-[#E4E1D5]/10 pb-6">
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[#E4E1D5]/60">{t('mobileNav.mainNav')}</p>
                <ul className="space-y-2">
                  <li>
                    <Link to="/" onClick={() => handleNavigate()} className="block rounded-lg border border-[#E4E1D5]/15 bg-white/[0.06] px-4 py-3 font-serif text-xl text-[#E4E1D5]">
                      {t('common.home')}
                    </Link>
                  </li>
                  <li>
                    <Link to="/shop" onClick={() => handleNavigate()} className="block rounded-lg border border-[#E4E1D5]/15 bg-white/[0.06] px-4 py-3 font-serif text-xl text-[#E4E1D5]">
                      {t('common.shop')}
                    </Link>
                  </li>
                  <li>
                    <Link to="/shop" onClick={() => handleNavigate('chaussures')} className="block rounded-lg border border-[#E4E1D5]/15 bg-white/[0.06] px-4 py-3 font-serif text-xl text-[#E4E1D5]">
                      {t('common.collectionShoes')}
                    </Link>
                  </li>
                  <li>
                    <Link to="/shop" onClick={() => handleNavigate('sandales')} className="block rounded-lg border border-[#E4E1D5]/15 bg-white/[0.06] px-4 py-3 font-serif text-xl text-[#E4E1D5]">
                      {t('common.collectionSandals')}
                    </Link>
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory('');
                    onClose();
                    onSearchOpen?.();
                    onLinkClick?.();
                  }}
                  className="mt-4 flex min-h-[48px] w-full items-center gap-3 rounded-lg border border-[#E4E1D5]/20 bg-white/[0.03] px-4 py-3 text-start text-[#E4E1D5] rtl:flex-row-reverse"
                >
                  <Search size={18} />
                  <span className="font-medium">{t('common.searchLabel')}</span>
                </button>
              </section>

              <section className="mb-6 border-b border-[#E4E1D5]/10 pb-6">
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[#E4E1D5]/60">{t('mobileNav.categories')}</p>
                <Link to="/shop" onClick={() => handleNavigate('chaussures')} className="block py-2 text-lg font-medium text-[#E4E1D5]">{t('catalog.chaussures')}</Link>
                <Link to="/shop" onClick={() => handleNavigate('sandales')} className="block py-2 text-lg font-medium text-[#E4E1D5]">{t('catalog.sandales')}</Link>
                <Link to="/shop?sort=new" onClick={() => handleNavigate()} className="block py-2 text-lg font-medium text-[#E4E1D5]">{t('common.newArrivals')}</Link>
                <Link to="/shop?promo=1" onClick={() => handleNavigate()} className="block py-2 text-lg font-medium text-[#E4E1D5]">{t('common.promos')}</Link>
              </section>

              <section className="mb-6 border-b border-[#E4E1D5]/10 pb-6">
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[#E4E1D5]/60">{t('common.account')}</p>
                <Link to="/contact" onClick={() => handleNavigate()} className="block py-2 text-lg font-medium text-[#E4E1D5]">{t('common.myAccount')}</Link>
                <Link to="/faq" onClick={() => handleNavigate()} className="block py-2 text-lg font-medium text-[#E4E1D5]">{t('common.myOrders')}</Link>
              </section>

              <section className="mb-6 border-b border-[#E4E1D5]/10 pb-6">
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[#E4E1D5]/60">{t('common.contactSection')}</p>
                <Link to="/contact" onClick={() => handleNavigate()} className="block py-2 text-lg font-medium text-[#E4E1D5]">{t('common.whatsapp')}</Link>
                <Link to="/contact" onClick={() => handleNavigate()} className="block py-2 text-lg font-medium text-[#E4E1D5]">{t('common.contact')}</Link>
              </section>

              <footer className="mt-8 border-t border-[#E4E1D5]/10 pt-6">
                <Link to="/contact" onClick={() => handleNavigate()} className="inline-flex min-h-[44px] items-center rounded-lg border border-[#E4E1D5]/20 px-4 py-2 text-sm text-[#E4E1D5]">
                  {t('common.whatsapp')}
                </Link>
              </footer>
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(drawer, document.body);
}
