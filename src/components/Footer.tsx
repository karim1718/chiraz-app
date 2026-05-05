import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Instagram, Facebook, MessageCircle, Mail, Phone, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const WHATSAPP_NUMBER = '21627522650'

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export default function Footer() {
  const { t } = useTranslation();
  const footerNav = useMemo(
    () => [
      { label: t('footer.home'), to: '/' },
      { label: t('footer.shop'), to: '/shop' },
      { label: t('footer.about'), to: '/about' },
      { label: t('footer.contact'), to: '/contact' },
    ],
    [t],
  );
  const footerHelp = useMemo(
    () => [
      { label: t('footer.helpFaq'), to: '/faq' },
      { label: t('footer.helpReturns'), to: '/returns' },
      { label: t('footer.helpSize'), to: '/shop' },
      { label: t('footer.helpTrack'), to: '/shop' },
    ],
    [t],
  );
  const [navOpen, setNavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <footer className="bg-[#0a0a0a] text-[#E4E1D5] border-t border-[#E4E1D5]/10">
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pt-12 md:pt-16 pb-12"
        variants={container}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* Col 1 : Logo + description + réseaux */}
          <motion.div variants={item} className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mb-6 sm:mb-8"
            >
              <Link to="/" className="inline-block">
                <img
                  src="/logo-Chiraz.png"
                  alt={t('common.logo')}
                  className="w-[110px] sm:w-[160px] h-auto object-contain filter invert opacity-90 transition-all duration-500 hover:opacity-100 hover:[filter:invert(1)_drop-shadow(0_0_12px_rgba(228,225,213,0.3))]"
                />
              </Link>
            </motion.div>
            <p className="text-sm text-[#E4E1D5]/70 max-w-xs leading-relaxed">
              {t('footer.brand')}
            </p>
            <div className="flex gap-4">
              <a href="#" aria-label={t('footer.instagram')} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#E4E1D5]/60 hover:text-[#E4E1D5] transition-colors">
                <Instagram size={22} />
              </a>
              <a href="#" aria-label={t('footer.facebook')} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#E4E1D5]/60 hover:text-[#E4E1D5] transition-colors">
                <Facebook size={22} />
              </a>
              <a href="#" aria-label={t('footer.tiktok')} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#E4E1D5]/60 hover:text-[#E4E1D5] transition-colors">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </a>
            </div>
          </motion.div>

          {/* Col 2 : Navigation — accordion on mobile */}
          <motion.div variants={item} className="border-b border-[#E4E1D5]/10 md:border-0">
            <button
              type="button"
              onClick={() => setNavOpen((o) => !o)}
              className="md:hidden w-full min-h-[48px] flex items-center justify-between py-3 text-left"
            >
              <h3 className="text-xs uppercase tracking-wider text-[#E4E1D5]/50 font-medium">{t('footer.navigation')}</h3>
              <ChevronDown size={18} className={`text-[#E4E1D5]/50 transition-transform ${navOpen ? 'rotate-180' : ''}`} />
            </button>
            <h3 className="hidden md:block text-xs uppercase tracking-wider text-[#E4E1D5]/50 font-medium mb-4">{t('footer.navigation')}</h3>
            <ul className={`space-y-3 ${navOpen ? 'block pb-4' : 'hidden'} md:!block md:pb-0`}>
              {footerNav.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-sm text-[#E4E1D5]/80 hover:text-[#E4E1D5] transition-colors block py-1">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Col 3 : Aide — accordion on mobile */}
          <motion.div variants={item} className="border-b border-[#E4E1D5]/10 md:border-0">
            <button
              type="button"
              onClick={() => setHelpOpen((o) => !o)}
              className="md:hidden w-full min-h-[48px] flex items-center justify-between py-3 text-left"
            >
              <h3 className="text-xs uppercase tracking-wider text-[#E4E1D5]/50 font-medium">{t('footer.help')}</h3>
              <ChevronDown size={18} className={`text-[#E4E1D5]/50 transition-transform ${helpOpen ? 'rotate-180' : ''}`} />
            </button>
            <h3 className="hidden md:block text-xs uppercase tracking-wider text-[#E4E1D5]/50 font-medium mb-4">{t('footer.help')}</h3>
            <ul className={`space-y-3 ${helpOpen ? 'block pb-4' : 'hidden'} md:!block md:pb-0`}>
              {footerHelp.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-sm text-[#E4E1D5]/80 hover:text-[#E4E1D5] transition-colors block py-1">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Col 4 : Contact direct — accordion on mobile */}
          <motion.div variants={item} className="space-y-4 border-b border-[#E4E1D5]/10 md:border-0 pb-4 md:pb-0">
            <button
              type="button"
              onClick={() => setContactOpen((o) => !o)}
              className="md:hidden w-full min-h-[48px] flex items-center justify-between py-3 text-left"
            >
              <h3 className="text-xs uppercase tracking-wider text-[#E4E1D5]/50 font-medium">{t('footer.directContact')}</h3>
              <ChevronDown size={18} className={`text-[#E4E1D5]/50 transition-transform ${contactOpen ? 'rotate-180' : ''}`} />
            </button>
            <h3 className="hidden md:block text-xs uppercase tracking-wider text-[#E4E1D5]/50 font-medium mb-4">{t('footer.directContact')}</h3>
            <div className={`space-y-4 ${contactOpen ? 'block' : 'hidden'} md:!block`}>
              <a href="mailto:contact@chiraz.tn" className="flex items-center gap-2 text-sm text-[#E4E1D5]/80 hover:text-[#E4E1D5] transition-colors min-h-[44px]">
                <Mail size={16} /> contact@chiraz.tn
              </a>
              <a href="tel:21621XXXXXX" className="flex items-center gap-2 text-sm text-[#E4E1D5]/80 hover:text-[#E4E1D5] transition-colors min-h-[44px]">
                <Phone size={16} /> 216  20 78 07 41
              </a>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER.replace(/\+/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 min-h-[48px] px-4 py-2.5 bg-[#25D366] text-white text-sm font-medium rounded-lg hover:bg-[#20BD5A] transition-colors"
              >
                <MessageCircle size={18} /> {t('common.whatsapp')}
              </a>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Barre basse */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-6 border-t border-[#E4E1D5]/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left pb-[env(safe-area-inset-bottom)]">
        <p className="text-xs text-[#E4E1D5]/50">
          {t('footer.rights', { year: new Date().getFullYear() })}
        </p>
        <div className="flex items-center gap-6 text-xs text-[#E4E1D5]/50">
          <Link to="/legal" className="hover:text-[#E4E1D5]/70 transition-colors">
            {t('common.legal')}
          </Link>
          <Link to="/privacy" className="hover:text-[#E4E1D5]/70 transition-colors">
            {t('common.privacy')}
          </Link>
        </div>
      </div>
    </footer>
  );
}
