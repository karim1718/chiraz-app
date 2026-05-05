import { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const STAR = '⭐';

const INITIALS = ['SK', 'MR', 'LB', 'AB', 'ND', 'FK'];

export default function TestimonialsSection() {
  const { t } = useTranslation();
  const testimonials = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6].map((n) => ({
        id: n,
        initials: INITIALS[n - 1],
        name: t(`testimonials.t${n}.name`),
        city: t(`testimonials.t${n}.city`),
        text: t(`testimonials.t${n}.text`),
      })),
    [t],
  );

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % testimonials.length);
    }, 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused, testimonials.length]);

  const cur = testimonials[index];

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6 }}
      className="py-16 md:py-24 px-4 md:px-6 bg-[#0f0f0f] border-t border-[#E4E1D5]/10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="max-w-4xl mx-auto">
        <h2 className="font-serif text-3xl md:text-4xl text-[#E4E1D5] text-center mb-3">
          {t('testimonials.title')}
        </h2>
        <p className="text-center text-sm text-[#E4E1D5]/55 mb-12 max-w-lg mx-auto">
          {t('testimonials.subtitle')}
        </p>
        <div className="relative min-h-[220px]">
          <AnimatePresence mode="wait">
            <motion.article
              key={cur.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex flex-col items-center text-center px-4"
            >
              <div className="w-14 h-14 rounded-full bg-[#E4E1D5]/20 flex items-center justify-center text-[#E4E1D5] font-serif text-lg mb-4">
                {cur.initials}
              </div>
              <p className="text-[#E4E1D5]/50 text-sm mb-2" aria-hidden>
                {STAR.repeat(5)}
              </p>
              <p className="text-[#E4E1D5]/90 leading-relaxed max-w-xl mb-6">
                &ldquo;{cur.text}&rdquo;
              </p>
              <p className="text-[#E4E1D5] font-medium">{cur.name}</p>
              <p className="text-sm text-[#E4E1D5]/60">{cur.city}</p>
            </motion.article>
          </AnimatePresence>
        </div>
        <div className="flex justify-center gap-2 mt-8">
          {testimonials.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === index ? 'bg-[#E4E1D5]' : 'bg-[#E4E1D5]/30 hover:bg-[#E4E1D5]/50'
              }`}
              aria-label={`${t('common.slide')} ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
