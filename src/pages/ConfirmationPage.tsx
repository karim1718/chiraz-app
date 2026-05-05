import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useQuickOrderStore } from '../store/quickOrderStore';
import confetti from 'canvas-confetti';

export default function ConfirmationPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const resetOrder = useQuickOrderStore((s) => s.reset);
  const orderId =
    (location.state as { orderId?: string } | null)?.orderId ??
    `CHZ-2026-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  useEffect(() => {
    resetOrder();

    const duration = 2500;
    const end = Date.now() + duration;
    const colors = ['#E4E1D5', '#22c55e', '#ffffff'];

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, [resetOrder]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-[80vh] flex flex-col items-center justify-center px-6 py-24"
    >
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
        className="relative mb-8"
      >
        <motion.svg
          viewBox="0 0 80 80"
          className="w-24 h-24 text-[#E4E1D5]"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.4, duration: 0.6, ease: 'easeInOut' }}
        >
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeOpacity="0.2"
          />
          <motion.path
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M22 40 L35 53 L58 28"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          />
        </motion.svg>
      </motion.div>

      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="font-serif text-3xl md:text-4xl text-[#E4E1D5] text-center mb-4"
      >
        {t('confirmation.title')}
      </motion.h1>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.75 }}
        className="text-[#E4E1D5]/80 text-center mb-6 max-w-md"
      >
        {t('confirmation.subtitle')}
      </motion.p>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="text-sm text-[#E4E1D5]/60 font-mono mb-10"
      >
        {t('confirmation.orderNo', { id: orderId })}
      </motion.p>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-8 py-4 bg-[#E4E1D5] text-[#0a0a0a] font-medium rounded hover:bg-[#0a0a0a] hover:text-[#E4E1D5] border border-transparent hover:border-[#E4E1D5]/50 transition-all duration-200"
        >
          {t('confirmation.home')}
        </Link>
      </motion.div>
    </motion.div>
  );
}
