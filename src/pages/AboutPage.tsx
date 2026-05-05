import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const VALUE_ICONS = [
  (
    <svg key="v1" viewBox="0 0 48 48" fill="none" className="w-12 h-12" aria-hidden>
      <path d="M24 4L8 14v20l16 10 16-10V14L24 4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M24 14v20M8 14l16 10 16-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  (
    <svg key="v2" viewBox="0 0 48 48" fill="none" className="w-12 h-12" aria-hidden>
      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 12v12l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  (
    <svg key="v3" viewBox="0 0 48 48" fill="none" className="w-12 h-12" aria-hidden>
      <path d="M12 36l12-12 12 12M24 24V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
];

/** Années depuis 1978 (année courante côté client). */
const YEARS_SINCE_1978 = new Date().getFullYear() - 1978;

const COUNTERS = [
  { labelKey: 'about.countersTitle' as const, value: YEARS_SINCE_1978, suffix: '+' },
  { labelKey: 'about.countersClients' as const, value: 5000, suffix: '+' },
  { labelKey: 'about.countersLeather' as const, value: 100, suffix: '%' },
];

const ENGAGEMENT_KEYS = [1, 2, 3, 4] as const;

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || started) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setStarted(true);
        const duration = 2000;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          setDisplay(Math.round(t * value));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [value, started]);
  return <span ref={ref}>{display}{suffix}</span>;
}

export default function AboutPage() {
  const { t } = useTranslation();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section ref={heroRef} className="relative h-[60vh] sm:h-[70vh] min-h-[320px] overflow-hidden">
        <motion.div
          style={{
            y: heroY,
            backgroundImage: 'url(https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=1920&q=80)',
          }}
          className="absolute inset-0 bg-cover bg-center"
        />
        <div className="absolute inset-0 bg-[#0a0a0a]/70" />
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center max-w-4xl"
          >
            <p className="text-[#E4E1D5]/65 text-xs sm:text-sm uppercase tracking-[0.22em] mb-5">
              {t('about.heroKicker')}
            </p>
            <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl text-[#E4E1D5]">
              {t('about.heroTitle')}
            </h1>
            <p className="mt-6 font-serif text-xl md:text-2xl text-[#E4E1D5]/90 leading-snug">
              {t('about.heroLead')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Notre Histoire */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7 }}
        className="py-12 md:py-28 px-4 sm:px-6 max-w-6xl mx-auto"
      >
        <h2 className="font-serif text-2xl md:text-3xl text-[#E4E1D5] mb-4 text-center">
          {t('about.storyTitle')}
        </h2>
        <p className="text-center text-[#E4E1D5]/55 text-sm uppercase tracking-wider mb-12">
          {t('about.storySub')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 text-[#E4E1D5]/90 leading-relaxed mb-16">
          <p>{t('about.storyP1')}</p>
          <p>{t('about.storyP2')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
          {ENGAGEMENT_KEYS.map((n, i) => (
            <motion.div
              key={n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.45 }}
              className="rounded-xl border border-[#E4E1D5]/15 bg-[#E4E1D5]/[0.04] px-6 py-5 text-start"
            >
              <h3 className="font-serif text-lg text-[#E4E1D5] mb-2">{t(`about.e${n}t`)}</h3>
              <p className="text-sm text-[#E4E1D5]/75 leading-relaxed">{t(`about.e${n}d`)}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Nos Valeurs */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7 }}
        className="py-20 md:py-28 px-6 bg-[#0a0a0a] border-t border-[#E4E1D5]/10"
      >
        <div className="max-w-6xl mx-auto">
          <h2 className="font-serif text-2xl md:text-3xl text-[#E4E1D5] mb-16 text-center">
            {t('about.valuesTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[1, 2, 3].map((n, i) => (
              <motion.article
                key={n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="p-8 rounded-lg border border-[#E4E1D5]/10 hover:border-[#E4E1D5]/20 transition-colors"
              >
                <div className="text-[#E4E1D5]/80 mb-6">{VALUE_ICONS[i]}</div>
                <h3 className="font-serif text-xl text-[#E4E1D5] mb-4">{t(`about.v${n}t`)}</h3>
                <p className="text-[#E4E1D5]/80 text-sm leading-relaxed">{t(`about.v${n}d`)}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Chiffres */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7 }}
        className="py-20 md:py-28 px-6 border-t border-[#E4E1D5]/10"
      >
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 text-center">
            {COUNTERS.map((item, i) => (
              <motion.div
                key={item.labelKey}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
              >
                <p className="font-serif text-4xl md:text-5xl text-[#E4E1D5] mb-2">
                  <AnimatedCounter value={item.value} suffix={item.suffix} />
                </p>
                <p className="text-sm text-[#E4E1D5]/70 uppercase tracking-wider">{t(item.labelKey)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>
    </div>
  );
}
