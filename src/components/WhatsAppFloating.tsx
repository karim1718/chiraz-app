import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';


// Remplacer par votre numéro WhatsApp (ex: +213555123456)
const WHATSAPP_NUMBER = '+213XXXXXXXXX';

export default function WhatsAppFloating() {
  const { t } = useTranslation();
  const [tooltip, setTooltip] = useState(false);


  const href = `https://wa.me/${WHATSAPP_NUMBER.replace(/\+/g, '')}`;

  return (
    <AnimatePresence>

        <motion.a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-[99] flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-[#25D366] text-white shadow-lg hover:bg-[#20BD5A] transition-colors"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          onMouseEnter={() => setTooltip(true)}
          onMouseLeave={() => setTooltip(false)}
          aria-label={t('whatsappFloat.aria')}
        >
          <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30 motion-reduce:animate-none" aria-hidden />
          <MessageCircle size={28} className="relative z-10 md:w-8 md:h-8" strokeWidth={2} />
          <AnimatePresence>
            {tooltip && (
              <motion.span
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="absolute right-full mr-3 px-3 py-2 bg-[#0a0a0a] border border-[#E4E1D5]/20 rounded text-[#E4E1D5] text-sm whitespace-nowrap"
              >
                {t('whatsappFloat.tooltip')}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.a>

    </AnimatePresence>
  );
}
