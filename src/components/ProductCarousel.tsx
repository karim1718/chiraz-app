import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Product } from '../types/product';
import { useProductStore } from '../store/productStore';
import { getPrimaryImageForColor } from '../utils/productColorAssets';
import { formatCurrencyAmount } from '../lib/vocab';

function formatProductPrice(product: Product, t: (key: string, opts?: Record<string, unknown>) => string) {
  if (product.minPrice != null && product.minPrice < product.price) {
    return t('common.fromPrice', {
      price: formatCurrencyAmount(Number(product.minPrice), { maximumFractionDigits: 0 }),
    });
  }
  if (product.salePercent != null && product.original_price) {
    return formatCurrencyAmount(Number(product.price), { maximumFractionDigits: 0 });
  }
  return formatCurrencyAmount(Number(product.price), { maximumFractionDigits: 0 });
}

const IMAGE_BOX_CLASS =
  'relative w-[280px] h-[280px] max-w-full aspect-square shrink-0 overflow-hidden rounded-lg bg-[#e4e1d5] flex items-center justify-center p-4 sm:p-5';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
};

function FeaturedProductCard({ product }: { product: Product }) {
  const { t } = useTranslation();
  const primaryColor = product.colors[0];
  const imageUrl = primaryColor
    ? getPrimaryImageForColor(product, primaryColor)
    : product.images?.[0] ?? '';
  const priceLabel = formatProductPrice(product, t);

  return (
    <motion.article variants={itemVariants} className="flex w-full max-w-[320px] flex-col items-center text-center">
      <Link to={`/product/${product.id}`} className="group flex w-full flex-col items-center">
        <motion.div
          className={`${IMAGE_BOX_CLASS} transition-shadow duration-500 group-hover:shadow-[0_16px_40px_rgba(228,225,213,0.12)]`}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              loading="lazy"
              width={280}
              height={280}
              className="max-h-full max-w-full object-contain object-center mix-blend-multiply transition-transform duration-500 group-hover:scale-[1.03]"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <span
            className={`absolute inset-0 flex items-center justify-center px-4 text-center font-serif text-lg text-[#0a0a0a]/40 ${
              imageUrl ? 'hidden' : ''
            }`}
          >
            {product.name}
          </span>
        </motion.div>

        <h3 className="mt-5 w-full truncate font-serif text-base tracking-wide text-[#e4e1d5] sm:text-lg">
          {product.name}
        </h3>

        {priceLabel ? (
          <p className="mt-1.5 font-sans text-sm tracking-widest text-[#e4e1d5]/70">{priceLabel}</p>
        ) : null}

        <span className="mt-4 inline-flex min-h-[40px] items-center justify-center border border-[#e4e1d5]/35 px-6 py-2 text-[10px] font-medium uppercase tracking-[0.22em] text-[#e4e1d5] transition-colors duration-300 group-hover:border-[#e4e1d5] group-hover:bg-[#e4e1d5] group-hover:text-[#0a0a0a]">
          {t('productCarousel.cta')}
        </span>
      </Link>
    </motion.article>
  );
}

function FeaturedGridSkeleton() {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden border-t border-[#e4e1d5]/10 bg-[#000000] px-4 py-12 sm:py-20 md:px-8 lg:px-12">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-10 sm:mb-14">
          <h2 className="mb-4 font-serif text-3xl text-[#e4e1d5] sm:text-4xl md:text-5xl">
            {t('productCarousel.title')}
          </h2>
          <motion.div className="h-px w-24 origin-left bg-[#e4e1d5] rtl:origin-right" />
        </div>
        <motion.div className="grid grid-cols-1 justify-items-center gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <motion.div key={i} className="flex w-full max-w-[320px] animate-pulse flex-col items-center">
              <div className={`${IMAGE_BOX_CLASS} bg-[#e4e1d5]/15`} />
              <div className="mt-5 h-5 w-32 rounded bg-[#e4e1d5]/15" />
              <motion.div className="mt-2 h-4 w-20 rounded bg-[#e4e1d5]/10" />
              <motion.div className="mt-4 h-9 w-24 rounded border border-[#e4e1d5]/10" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

const ProductCarousel = () => {
  const { t } = useTranslation();
  const isLoading = useProductStore((s) => s.isLoading);
  const isLoaded = useProductStore((s) => s.isLoaded);
  const products = useProductStore((s) => s.products);

  const featured = useMemo(
    () =>
      products
        .filter((p) => p.is_featured === true)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [products],
  );

  if (isLoaded && featured.length === 0) {
    return null;
  }

  if (isLoading && featured.length === 0) {
    return <FeaturedGridSkeleton />;
  }

  return (
    <section className="relative overflow-hidden border-t border-[#e4e1d5]/10 bg-[#000000] px-4 py-12 sm:py-20 md:px-8 lg:px-12">
      <div className="mx-auto max-w-[1280px]">
        <motion.header
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="mb-10 sm:mb-14"
        >
          <h2 className="mb-4 font-serif text-3xl text-[#e4e1d5] sm:text-4xl md:text-5xl">
            {t('productCarousel.title')}
          </h2>
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.15, ease: 'anticipate' }}
            className="h-px w-24 origin-left bg-[#e4e1d5] rtl:origin-right"
          />
        </motion.header>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          className="grid grid-cols-1 justify-items-center gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3 xl:grid-cols-4"
        >
          {featured.map((product) => (
            <FeaturedProductCard key={product.id} product={product} />
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default ProductCarousel;
