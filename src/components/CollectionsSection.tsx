import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import LazyImage from './LazyImage';

export default function CollectionsSection() {
  const { t } = useTranslation();
  const collections = useMemo(
    () =>
      [
        {
          id: 'chaussures' as const,
          titleKey: 'collections.colShoes',
          image: '/shoe.jpeg',
          to: '/shop?category=chaussures',
        },
        {
          id: 'sandales' as const,
          titleKey: 'collections.colSandals',
          image: '/sandale.jpeg',
          to: '/shop?category=sandales',
        },
      ] as const,
    [],
  );

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6 }}
      className="py-16 md:py-24 px-4 md:px-6 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        <h2 className="font-serif text-3xl md:text-4xl text-[#E4E1D5] text-center mb-12 md:mb-16">
          {t('collections.title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {collections.map((col) => (
            <motion.div
              key={col.id}
              onMouseEnter={() => setHoveredId(col.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="relative group"
            >
              <Link
                to={col.to}
                className={`block relative aspect-[4/5] md:aspect-[3/4] rounded-lg overflow-hidden transition-opacity duration-500 ${
                  hoveredId !== null && hoveredId !== col.id ? 'opacity-40' : 'opacity-100'
                }`}
              >
                <LazyImage
                  src={col.image}
                  alt=""
                  className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-105"
                  placeholderColor="#1a1a1a"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
                  aria-hidden
                />
                <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-10">
                  <h3 className="font-serif text-2xl md:text-3xl lg:text-4xl text-[#E4E1D5] mb-4">
                    {t(col.titleKey)}
                  </h3>
                  <span className="inline-flex items-center text-[#E4E1D5] text-sm font-medium border border-[#E4E1D5]/50 rounded px-4 py-2 w-fit hover:bg-[#E4E1D5]/10 transition-colors">
                    {t('collections.discover')}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
