import { useRef, useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { formatCurrencyAmount } from '../lib/vocab';

const ProductCarousel = () => {
  const { t } = useTranslation();
  const products = useMemo(
    () => [
      {
        id: 1,
        name: t('productCarousel.p1.name'),
        price: formatCurrencyAmount(12000, { maximumFractionDigits: 0 }),
        image: '/product_black_shoe_1772247846152.png',
      },
      {
        id: 2,
        name: t('productCarousel.p2.name'),
        price: formatCurrencyAmount(11000, { maximumFractionDigits: 0 }),
        image: '/product_beige_shoe_1772247887498.png',
      },
      {
        id: 3,
        name: t('productCarousel.p3.name'),
        price: formatCurrencyAmount(9500, { maximumFractionDigits: 0 }),
        image: '/product_women_shoe_1772247905393.png',
      },
      {
        id: 4,
        name: t('productCarousel.p4.name'),
        price: formatCurrencyAmount(12000, { maximumFractionDigits: 0 }),
        image: '/product_black_shoe_1772247846152.png',
      },
      {
        id: 5,
        name: t('productCarousel.p5.name'),
        price: formatCurrencyAmount(11000, { maximumFractionDigits: 0 }),
        image: '/product_beige_shoe_1772247887498.png',
      },
      {
        id: 6,
        name: t('productCarousel.p6.name'),
        price: formatCurrencyAmount(9500, { maximumFractionDigits: 0 }),
        image: '/product_women_shoe_1772247905393.png',
      },
    ],
    [t],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.8;
      scrollRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const cardWidth = el.querySelector('[data-carousel-card]')?.getBoundingClientRect().width ?? 0;
      const gap = 32;
      const index = Math.round(el.scrollLeft / (cardWidth + gap));
      setActiveIndex(Math.max(0, Math.min(index, products.length - 1)));
    };
    el.addEventListener('scroll', onScroll);
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' as const } },
  };

  return (
    <section className="py-12 sm:py-24 bg-[#000000] overflow-hidden relative border-t border-[#e4e1d5]/10 px-4 sm:px-0">
      <div className="px-2 sm:px-6 md:px-12 xl:px-24 flex items-end justify-between mb-8 sm:mb-12">
        <div>
          <motion.h2
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-3xl sm:text-4xl md:text-5xl font-serif text-[#e4e1d5] mb-4"
          >
            {t('productCarousel.title')}
          </motion.h2>
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2, ease: 'anticipate' }}
            className="h-[1px] w-24 bg-[#e4e1d5] origin-left rtl:origin-right"
          />
        </div>

        <div className="hidden md:flex gap-4">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-3 border border-[#e4e1d5]/30 text-[#e4e1d5] hover:bg-[#e4e1d5] hover:text-black transition-all duration-300 rounded-full"
            aria-label={t('common.scrollLeft')}
          >
            <ChevronLeft size={20} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-3 border border-[#e4e1d5]/30 text-[#e4e1d5] hover:bg-[#e4e1d5] hover:text-black transition-all duration-300 rounded-full"
            aria-label={t('common.scrollRight')}
          >
            <ChevronRight size={20} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <motion.div
        ref={scrollRef}
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        className="flex gap-4 md:gap-8 overflow-x-auto snap-x snap-mandatory hide-scrollbar px-4 sm:px-6 md:px-12 xl:px-24 pb-8 sm:pb-12 pt-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {products.map((product) => (
          <motion.div
            key={product.id}
            data-carousel-card
            variants={itemVariants}
            className="min-w-[75vw] sm:min-w-[300px] md:min-w-[400px] snap-center group cursor-pointer flex-shrink-0"
          >
            <div className="bg-[#e4e1d5] aspect-[3/4] overflow-hidden mb-4 sm:mb-6 relative transition-all duration-500 ease-out md:duration-700 group-hover:shadow-[0_20px_40px_rgba(228,225,213,0.15)] md:group-hover:-translate-y-2">
              <img
                src={product.image}
                alt={product.name}
                loading="lazy"
                className="w-full h-full object-cover mix-blend-multiply transition-all duration-500 md:duration-1000 md:group-hover:scale-110 md:group-hover:rotate-1 group-active:opacity-90"
              />
              <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 translate-y-0 opacity-100 md:translate-y-8 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 transition-all duration-500 ease-out">
                <button
                  type="button"
                  className="w-full bg-[#000000] text-[#e4e1d5] py-3 md:py-4 font-medium text-xs tracking-widest hover:bg-neutral-800 active:bg-neutral-800 transition-colors uppercase min-h-[44px]"
                >
                  {t('productCarousel.cta')}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-start mb-1 sm:mb-2">
              <h3 className="font-serif text-[#e4e1d5] text-base sm:text-xl tracking-wide truncate pr-2">{product.name}</h3>
              <span className="font-sans text-[#e4e1d5] tracking-widest text-sm flex-shrink-0">{product.price}</span>
            </div>
            <p className="text-[#e4e1d5]/50 text-xs tracking-widest font-sans uppercase">{t('productCarousel.twoColors')}</p>
          </motion.div>
        ))}
      </motion.div>

      <div className="flex justify-center gap-2 mt-6 md:hidden">
        {products.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              const el = scrollRef.current;
              if (el) {
                const card = el.querySelector('[data-carousel-card]');
                const w = (card?.getBoundingClientRect().width ?? 0) + 16;
                el.scrollTo({ left: i * w, behavior: 'smooth' });
              }
            }}
            className={`w-2 h-2 rounded-full transition-colors min-w-[12px] min-h-[12px] ${i === activeIndex ? 'bg-[#e4e1d5]' : 'bg-[#e4e1d5]/30'}`}
            aria-label={`${t('common.slide')} ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
};

export default ProductCarousel;
