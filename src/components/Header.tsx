import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, User, HelpCircle } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSearchStore } from '../store/searchStore';
import MobileNavDrawer from './layout/MobileNavDrawer';
import LanguageSwitcher from './LanguageSwitcher';

const Header = () => {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();
  const openSearch = useSearchStore((s) => s.openSearch);
  const activeCategory = useSearchStore((s) => s.activeCategory);
  const setActiveCategory = useSearchStore((s) => s.setActiveCategory);
  const navigate = useNavigate();

  const logoScale = useTransform(scrollY, [0, 100], [1, 0.85]);
  const headerBgColor = useTransform(
    scrollY,
    [0, 100],
    ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.95)'],
  );
  const textColor = useTransform(scrollY, [0, 100], ['#e4e1d5', '#e4e1d5']);

  const navItemVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.8 },
    }),
  };

  const navLinks = [
    { label: t('nav.shoes'), value: 'chaussures' },
    { label: t('nav.sandals'), value: 'sandales' },
  ] as const;

  return (
    <motion.header
      style={{
        backgroundColor: headerBgColor,
        color: textColor,
      }}
      className="fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)] backdrop-blur-sm transition-colors duration-500 pl-[max(2rem,env(safe-area-inset-left))] pr-[max(2rem,env(safe-area-inset-right))]"
    >
      {/* 3 equal columns → logo centered on full viewport; md+ shows links + icons */}
      <div className="flex h-16 w-full max-w-full items-center">
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-start gap-8">
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="min-h-[44px] min-w-[44px] flex flex-col justify-center gap-1.5 p-2 text-[#e4e1d5] hover:opacity-80 md:hidden"
            aria-label={mobileOpen ? t('common.closeMenu') : t('common.openMenu')}
          >
            <motion.span
              animate={mobileOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.2 }}
              className="block h-0.5 w-5 origin-center rounded-full bg-current"
            />
            <motion.span
              animate={mobileOpen ? { opacity: 0 } : { opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="block h-0.5 w-5 rounded-full bg-current"
            />
            <motion.span
              animate={mobileOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.2 }}
              className="block h-0.5 w-5 origin-center rounded-full bg-current"
            />
          </button>

          <nav
            className="hidden min-w-0 items-center gap-8 md:flex"
            aria-label={t('header.categoriesAria')}
          >
            {navLinks.map(({ label, value }, i) => (
              <motion.div
                key={label}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={navItemVariants}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (activeCategory === value) setActiveCategory('');
                    else setActiveCategory(value);
                    navigate('/shop');
                  }}
                  className={`relative block overflow-hidden pb-0.5 font-sans text-xs font-normal uppercase tracking-[0.15em] text-white transition-opacity duration-200 ease-out hover:opacity-100 ${activeCategory === value ? 'opacity-100' : 'opacity-85'}`}
                >
                  {label}
                  {activeCategory === value && (
                    <motion.div
                      layoutId="activeCategoryIndicator"
                      className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#E4E1D5]"
                    />
                  )}
                </button>
              </motion.div>
            ))}
          </nav>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
          <motion.div
            className="flex origin-center items-center justify-center"
            style={{ scale: logoScale }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link to="/">
              <img
                src="/logo-Chiraz.png"
                alt={t('common.logoChiraz')}
                className="w-[170px] sm:w-[190px] md:h-40 md:w-auto object-contain opacity-95 invert transition-transform duration-700 hover:scale-105"
              />
            </Link>
          </motion.div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-end gap-4 rtl:flex-row-reverse md:gap-6">
          <LanguageSwitcher className="hidden md:flex" />
          <nav
            className="hidden items-center gap-6 md:flex"
            aria-label={t('header.actionsAria')}
          >
            <motion.div custom={0} initial="hidden" animate="visible" variants={navItemVariants}>
              <button
                type="button"
                onClick={openSearch}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center opacity-85 transition-opacity duration-200 ease-out hover:opacity-100"
                aria-label={t('common.search')}
              >
                <Search size={18} strokeWidth={1.5} />
              </button>
            </motion.div>
            <motion.div custom={1} initial="hidden" animate="visible" variants={navItemVariants}>
              <Link
                to="/contact"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center opacity-85 transition-opacity duration-200 ease-out hover:opacity-100"
              >
                <User size={18} strokeWidth={1.5} />
              </Link>
            </motion.div>
            <motion.div custom={2} initial="hidden" animate="visible" variants={navItemVariants}>
              <Link
                to="/faq"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center opacity-85 transition-opacity duration-200 ease-out hover:opacity-100"
              >
                <HelpCircle size={18} strokeWidth={1.5} />
              </Link>
            </motion.div>
          </nav>
        </div>
      </div>

      <MobileNavDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onSearchOpen={openSearch}
        onLinkClick={() => setMobileOpen(false)}
      />
    </motion.header>
  );
};

export default Header;
