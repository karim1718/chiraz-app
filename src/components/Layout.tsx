import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Header from './Header';
import Footer from './Footer';
import SearchOverlay from './SearchOverlay';
import WhatsAppFloating from './WhatsAppFloating';
import BottomNavBar from './layout/BottomNavBar';
import { useWindowSize } from '../hooks';

export default function Layout() {
  const location = useLocation();
  const { isMobile } = useWindowSize();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const base = t('meta.defaultTitle');
    const path = location.pathname;
    let title = base;
    let description: string | undefined;

    if (path === '/') {
      title = t('meta.home.title');
      description = t('meta.home.description');
    } else if (path === '/shop') {
      title = t('meta.shop.title');
      description = t('meta.shop.description');
    } else if (path === '/about') {
      title = t('meta.about.title');
      description = t('meta.about.description');
    } else if (path === '/contact') {
      title = t('meta.contact.title');
      description = t('meta.contact.description');
    } else if (path === '/faq') {
      title = t('meta.faq.title');
      description = t('meta.faq.description');
    } else if (path === '/returns') {
      title = t('meta.returns.title');
      description = t('meta.returns.description');
    } else if (path === '/checkout') {
      title = t('meta.checkout.title');
      description = t('meta.checkout.description');
    } else if (path === '/confirmation') {
      title = t('meta.confirmation.title');
      description = t('meta.confirmation.description');
    } else if (path === '/legal') {
      title = t('meta.legal.title');
      description = t('meta.legal.description');
    } else if (path === '/privacy') {
      title = t('meta.privacy.title');
      description = t('meta.privacy.description');
    } else if (path.startsWith('/product/')) {
      title = t('meta.product.title');
      description = t('meta.product.description');
    }

    document.title = title;
    const descEl = document.querySelector('meta[name="description"]');
    if (descEl && description) descEl.setAttribute('content', description);
  }, [location.pathname, i18n.language, t]);

  const duration = isMobile ? 0.15 : 0.2;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#E4E1D5] font-sans selection:bg-[#E4E1D5] selection:text-black">
      <Header />
      <main className="pb-14 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration, ease: 'easeOut' }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: isMobile ? 0.15 : 0.3, delay: 0.05 }}
            >
              <Outlet />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <SearchOverlay />
      <WhatsAppFloating />
      <BottomNavBar />
    </div>
  );
}
