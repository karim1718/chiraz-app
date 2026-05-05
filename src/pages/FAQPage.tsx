import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const FAQ_CATEGORY_KEYS = ['delivery', 'sizes', 'returns', 'payment', 'products'] as const;
type FaqCategoryKey = (typeof FAQ_CATEGORY_KEYS)[number];

export default function FAQPage() {
  const { t, i18n } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<FaqCategoryKey>('delivery');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const items = useMemo(() => {
    const raw = t(`faq.categories.${activeCategory}.items`, { returnObjects: true });
    return Array.isArray(raw) ? (raw as { q: string; a: string }[]) : [];
  }, [t, i18n.language, activeCategory]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="pt-28 pb-24 px-6 bg-[#0f0f0f] min-h-screen"
    >
      <div className="max-w-4xl mx-auto">
        <h1 className="font-serif text-4xl md:text-5xl text-[#E4E1D5] mb-12 text-center">
          {t('faq.title')}
        </h1>

        <div className="flex overflow-x-auto gap-2 mb-12 pb-2 hide-scrollbar justify-start sm:justify-center flex-nowrap">
          {FAQ_CATEGORY_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setActiveCategory(key);
                setOpenIndex(0);
              }}
              className={`flex-shrink-0 min-h-[44px] px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === key
                  ? 'bg-[#E4E1D5] text-[#0a0a0a]'
                  : 'bg-[#1a1a1a] text-[#E4E1D5]/80 hover:bg-[#E4E1D5]/10 hover:text-[#E4E1D5]'
              }`}
            >
              {t(`faq.categories.${key}.label`)}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {items.map((item, i) => (
            <motion.div
              key={`${activeCategory}-${i}-${item.q.slice(0, 24)}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="border border-[#E4E1D5]/10 rounded-lg overflow-hidden bg-[#0a0a0a]/50"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-6 py-4 flex items-center justify-between text-start text-[#E4E1D5] hover:bg-[#E4E1D5]/5 transition-colors"
              >
                <span className="font-medium pe-4">{item.q}</span>
                {openIndex === i ? <Minus size={18} /> : <Plus size={18} />}
              </button>
              <AnimatePresence initial={false}>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-4 text-[#E4E1D5]/80 text-sm leading-relaxed border-t border-[#E4E1D5]/10 pt-3">
                      {item.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
