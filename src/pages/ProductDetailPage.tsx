import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
  Star,
  X,
} from 'lucide-react';
import type { Product } from '../types/product';
import { useProductStore } from '../store/productStore';
import {
  getImagesForColor,
  getHexForProductColor,
  getPrimaryImageForColor,
  isVeryLightHex,
} from '../utils/productColorAssets';
import { useWindowSize } from '../hooks';
import SizeChips, { ALL_SIZES } from '../components/ui/SizeChips';
import QuickOrderModal from '../components/ui/QuickOrderModal';
import { formatCurrencyAmount } from '../lib/vocab';
import { useProductStock } from '../hooks/useProductStock';

const STAR_RATING = 4.5;

const SIZE_GUIDE_ROWS = [
  { eu: 36, uk: 3, us: 5.5, cm: 23 },
  { eu: 37, uk: 4, us: 6, cm: 23.5 },
  { eu: 38, uk: 5, us: 7, cm: 24 },
  { eu: 39, uk: 6, us: 8, cm: 24.5 },
  { eu: 40, uk: 7, us: 9, cm: 25 },
  { eu: 41, uk: 8, us: 10, cm: 25.5 },
  { eu: 42, uk: 9, us: 11, cm: 26 },
  { eu: 43, uk: 10, us: 12, cm: 27 },
  { eu: 44, uk: 11, us: 13, cm: 28 },
  { eu: 45, uk: 12, us: 14, cm: 29 },
  { eu: 46, uk: 13, us: 15, cm: 30 },
];

// --- Zoom lens on desktop; swipeable carousel + dots on mobile ---
function ProductGallery({
  images,
  productName,
  className,
  isMobile,
}: {
  images: string[];
  productName: string;
  className?: string;
  isMobile?: boolean;
}) {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [hover, setHover] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const containerRef = useRef<HTMLDivElement>(null);
  const galleryImages = images.length ? images : [''];
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, galleryImages.length - 1));
  const mainSrc = galleryImages[safeActiveIndex];
  /** Change quand la couleur (jeu d’images) ou la vignette active change → transition visible */
  const slideKey = `${galleryImages.join('|')}::${safeActiveIndex}`;

  useEffect(() => {
    setActiveIndex(0);
  }, [images.join('|')]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setZoomPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
    },
    []
  );

  return (
    <div className={className}>
      <div className="flex gap-4">
        <div
          ref={containerRef}
          className={`relative flex-1 bg-[#1a1a1a] rounded-sm overflow-hidden ${
            isMobile ? 'h-[60vw] min-h-[240px] max-h-[400px]' : 'aspect-[4/3]'
          }`}
          onMouseEnter={() => !isMobile && setHover(true)}
          onMouseLeave={() => setHover(false)}
          onMouseMove={!isMobile ? handleMouseMove : undefined}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={slideKey}
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
            >
              {mainSrc ? (
                <img
                  src={mainSrc}
                  alt={productName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="flex items-center justify-center h-full text-[#E4E1D5]/40 font-serif text-lg">
                  {productName}
                </span>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Zoom lens preview (desktop): cadre à droite, zone sous le curseur agrandie */}
          {hover && mainSrc && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="hidden lg:block absolute start-full ms-4 top-0 w-[280px] h-full rounded border border-[#E4E1D5]/20 overflow-hidden bg-[#0a0a0a] z-10 pointer-events-none"
            >
              <div
                className="w-full h-full bg-no-repeat"
                style={{
                  backgroundImage: `url(${mainSrc})`,
                  backgroundSize: '250%',
                  backgroundPosition: `${zoomPos.x - 20}% ${zoomPos.y - 20}%`,
                }}
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 mt-4 overflow-x-auto hide-scrollbar pb-2">
        {galleryImages.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded overflow-hidden border-2 transition-colors min-w-[56px] min-h-[56px] sm:min-w-0 sm:min-h-0 ${
              safeActiveIndex === i ? 'border-[#E4E1D5]' : 'border-transparent hover:border-[#E4E1D5]/40'
            }`}
          >
            {src ? (
              <img src={src} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center text-[#E4E1D5]/30 text-xs">
                {i + 1}
              </div>
            )}
          </button>
        ))}
      </div>
      {isMobile && galleryImages.length > 1 && (
        <div className="flex justify-center gap-2 mt-3">
          {galleryImages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors min-w-[8px] min-h-[8px] ${i === safeActiveIndex ? 'bg-[#E4E1D5]' : 'bg-[#E4E1D5]/30'}`}
              aria-label={t('productDetail.imageNum', { n: i + 1 })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Size guide modal ---
function SizeGuideModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0a0a0a] border border-[#E4E1D5]/20 rounded-lg max-w-lg w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 relative">
          <h3 className="font-serif text-xl text-[#E4E1D5] mb-4">{t('productDetail.guideTitle')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 end-4 p-2 text-[#E4E1D5]/70 hover:text-[#E4E1D5]"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-[#E4E1D5]/90">
              <thead>
                <tr className="border-b border-[#E4E1D5]/20">
                  <th className="text-start py-3 font-medium">{t('productDetail.sizeEu')}</th>
                  <th className="text-start py-3 font-medium">{t('productDetail.sizeUk')}</th>
                  <th className="text-start py-3 font-medium">{t('productDetail.sizeUs')}</th>
                  <th className="text-start py-3 font-medium">{t('productDetail.sizeCm')}</th>
                </tr>
              </thead>
              <tbody>
                {SIZE_GUIDE_ROWS.map((row) => (
                  <tr key={row.eu} className="border-b border-[#E4E1D5]/10">
                    <td className="py-2">{row.eu}</td>
                    <td className="py-2">{row.uk}</td>
                    <td className="py-2">{row.us}</td>
                    <td className="py-2">{row.cm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- Accordion section ---
function AccordionItem({
  title,
  children,
  open,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-[#E4E1D5]/10 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full min-h-[48px] py-4 px-0 flex items-center justify-between text-start text-[#E4E1D5] font-medium"
      >
        <span>{title}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[#E4E1D5]/70"
        >
          {open ? <Minus size={18} /> : <Plus size={18} />}
        </motion.span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden"
      >
        <div className="pb-4 text-[#E4E1D5]/80 text-sm leading-relaxed">{children}</div>
      </motion.div>
    </div>
  );
}

// --- Similar products carousel ---
function SimilarCarousel({ products, isMobile }: { products: Product[]; isMobile?: boolean }) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: dir === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  if (products.length === 0) return null;

  return (
    <section className="py-10 sm:py-16 border-t border-[#E4E1D5]/10">
      <div className="flex items-end justify-between mb-6 sm:mb-8">
        <h2 className="font-serif text-xl sm:text-2xl md:text-3xl text-[#E4E1D5]">{t('productDetail.similar')}</h2>
        {!isMobile && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scroll('left')}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center p-3 border border-[#E4E1D5]/30 text-[#E4E1D5] hover:bg-[#E4E1D5] hover:text-[#0a0a0a] transition-all rounded-full"
              aria-label={t('common.previous')}
            >
              <ChevronLeft size={20} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center p-3 border border-[#E4E1D5]/30 text-[#E4E1D5] hover:bg-[#E4E1D5] hover:text-[#0a0a0a] transition-all rounded-full"
              aria-label={t('common.next')}
            >
              <ChevronRight size={20} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4"
      >
        {products.map((p) => (
          <Link
            key={p.id}
            to={`/product/${p.id}`}
            className="flex-shrink-0 w-[75vw] min-w-[200px] sm:w-[280px] md:w-[320px] snap-center group"
          >
            <div className="aspect-[3/4] bg-[#E4E1D5]/10 rounded-sm overflow-hidden mb-4 transition-all duration-300 group-hover:shadow-[0_20px_40px_rgba(228,225,213,0.1)] group-hover:-translate-y-1">
              {(getPrimaryImageForColor(p, p.colors[0]) || p.images[0]) ? (
                <img
                  src={getPrimaryImageForColor(p, p.colors[0]) || p.images[0]}
                  alt={p.name}
                  className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <span className="flex items-center justify-center h-full text-[#E4E1D5]/40 font-serif">
                  {p.name}
                </span>
              )}
            </div>
            <p className="font-serif text-[#E4E1D5]">{p.name}</p>
            <p className="text-[#E4E1D5]/80 mt-1 text-sm">
              {formatCurrencyAmount(Number(p.price), { maximumFractionDigits: 0 })}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function ProductDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { getProductById, getSimilarProducts, isLoading: storeLoading } = useProductStore();
  const product = id ? getProductById(id) : undefined;
  const { isMobile } = useWindowSize();
  const { variants } = useProductStock(product?.id || '');

  const [selectedColor, setSelectedColor] = useState<string>(() => product?.colors[0] ?? '');
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [isQuickOrderOpen, setQuickOrderOpen] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  useEffect(() => {
    if (product) {
      setSelectedSize(null);
      setSelectedColor(product.colors[0] ?? '');
    }
  }, [product?.id]);
  const [accordionOpen, setAccordionOpen] = useState<number | null>(0);
  const [isAdding, setIsAdding] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(true);
  const mainCtaRef = useRef<HTMLButtonElement>(null);

  const galleryImages = useMemo(
    () => (product ? getImagesForColor(product, selectedColor) : []),
    [product, selectedColor]
  );

  useEffect(() => {
    const el = mainCtaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      setCtaVisible(entry.isIntersecting);
    }, { rootMargin: '0px 0px -10% 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [product?.id]);

  const handleMainAction = () => {
    setIsAdding(true);
    setTimeout(() => {
      setIsAdding(false);
      setQuickOrderOpen(true);
    }, 800);
  };

  const similarProducts = product
    ? getSimilarProducts(product.id, product.category, 4)
    : [];

  if (storeLoading && !product) {
    return (
      <div className="pt-32 pb-32 flex flex-col items-center justify-center text-[#E4E1D5]/70 min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#E4E1D5]/30 border-t-[#E4E1D5] animate-spin mb-4" />
        <p className="font-serif">{t('common.loading')}</p>
      </div>
    );
  }

  const getActiveVariant = () => {
    if (!variants.length || !selectedSize) return null;
    return variants.find(v => v.size === selectedSize && v.color === selectedColor);
  };

  const activeVariant = getActiveVariant();
  const basePrice = product?.price ?? 0;
  
  const priceDisplay = activeVariant?.price != null ? activeVariant.price : basePrice;
  const originalPriceDisplay = activeVariant?.original_price || (product?.original_price && product.original_price > basePrice ? product.original_price : undefined);
  const salePercentDisplay = (originalPriceDisplay && originalPriceDisplay > priceDisplay) 
    ? Math.round(((originalPriceDisplay - priceDisplay) / originalPriceDisplay) * 100) 
    : undefined;

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = product
    ? `${product.name} - ${formatCurrencyAmount(Number(priceDisplay), { maximumFractionDigits: 0 })}${t('productDetail.shareSuffix')}`
    : t('common.logo');

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // fallback
    }
  };

  const handleDirectWhatsApp = () => {
    const priceStr = formatCurrencyAmount(Number(priceDisplay), { maximumFractionDigits: 0 });
    const lines = [
      t('productDetail.waIntro'),
      '',
      `- ${t('productDetail.waProduct')}: ${product!.name}`,
      `- ${t('productDetail.waSize')}: ${selectedSize != null ? selectedSize : t('productDetail.waUnspecified')}`,
    ];
    if (selectedColor) lines.push(`- ${t('productDetail.waColor')}: ${selectedColor}`);
    lines.push(`- ${t('productDetail.waPrice')}: ${priceStr}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  if (!product) {
    return (
      <div className="pt-32 pb-24 px-6 text-center">
        <p className="text-[#E4E1D5]/80 mb-6">{t('productDetail.notFound')}</p>
        <Link to="/shop" className="text-[#E4E1D5] underline font-serif">
          {t('common.backToCatalog')}
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="pt-28 pb-24 px-4 md:px-6 lg:px-8"
    >
      <div className="max-w-7xl mx-auto">
        <Link
          to="/shop"
          className="inline-block text-[#E4E1D5]/70 hover:text-[#E4E1D5] text-sm mb-8"
        >
          {t('productDetail.backCatalog')}
        </Link>

        {/* Main layout: 60% gallery / 40% info on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-16">
          {/* Left: Gallery */}
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="lg:min-w-0"
          >
            <ProductGallery
              images={galleryImages}
              productName={product.name}
              isMobile={isMobile}
            />
          </motion.div>

          {/* Right: Info */}
          <div className="lg:min-w-0">
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              className="space-y-6"
            >
              {product.badge && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-xs uppercase tracking-wider text-[#E4E1D5]/70"
                >
                  {product.badge === 'Nouveau' ? t('catalog.badgeNewDb') : product.badge}
                </motion.span>
              )}
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-[#E4E1D5] leading-tight"
              >
                {product.name}
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="flex items-center gap-3"
              >
                <span className="text-xl font-semibold text-white sm:text-2xl">
                  {formatCurrencyAmount(Number(priceDisplay), { maximumFractionDigits: 0 })}
                </span>
                {originalPriceDisplay && (
                  <span className="text-lg text-[#E4E1D5]/50 line-through">
                    {formatCurrencyAmount(Number(originalPriceDisplay), { maximumFractionDigits: 0 })}
                  </span>
                )}
                {salePercentDisplay != null && (
                  <span className="px-2 py-0.5 text-xs font-bold tracking-wider uppercase bg-rose-500 text-white rounded shadow-md">
                    -{salePercentDisplay}%
                  </span>
                )}
              </motion.div>

              {/* Star rating */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-1"
              >
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    size={16}
                    className={
                      i <= Math.floor(STAR_RATING)
                        ? 'fill-[#E4E1D5] text-[#E4E1D5]'
                        : 'text-[#E4E1D5]/30'
                    }
                    strokeWidth={1}
                  />
                ))}
                <span className="ml-2 text-sm text-[#E4E1D5]/70">
                  {STAR_RATING}
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="h-px bg-[#E4E1D5]/20"
              />

              {/* Color selector */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <p className="text-xs uppercase tracking-wider text-[#E4E1D5]/70 mb-2">
                  {t('common.color')}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {product.colors.map((c) => {
                    const hx = getHexForProductColor(product, c);
                    const light = isVeryLightHex(hx);
                    return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      title={c}
                      className={`rounded-md border-2 transition-all min-w-[44px] min-h-[44px] w-10 h-10 sm:w-9 sm:h-9 sm:min-w-0 sm:min-h-0 ${
                        selectedColor === c
                          ? 'border-[#E4E1D5] ring-2 ring-[#E4E1D5]/40 scale-105'
                          : 'border-[#E4E1D5]/30 hover:border-[#E4E1D5]/60'
                      } ${light ? 'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]' : ''}`}
                      style={{
                        backgroundColor: hx,
                      }}
                    />
                  );})}
                  <span className="text-sm text-[#E4E1D5]/80 ms-1">
                    {selectedColor}
                  </span>
                </div>
              </motion.div>

              {/* Size selector */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wider text-[#E4E1D5]/70">
                    {t('common.size')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSizeGuideOpen(true)}
                    className="text-xs text-[#E4E1D5]/70 hover:text-[#E4E1D5] underline min-h-[48px] px-4 flex items-center"
                  >
                    {t('productDetail.guideTitle')}
                  </button>
                </div>
                <SizeChips
                  productId={product.id}
                  selectedColor={selectedColor}
                  sizes={ALL_SIZES}
                  selectedSize={selectedSize}
                  onSelect={setSelectedSize}
                />
              </motion.div>

              {/* Add to cart: inline on desktop, fixed bar on mobile */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-10 space-y-3"
              >
                <button
                  ref={mainCtaRef}
                  type="button"
                  disabled={!selectedSize || isAdding}
                  onClick={handleMainAction}
                  className={`w-full md:w-auto px-4 min-h-[56px] rounded-2xl font-medium transition-colors text-base flex justify-center items-center gap-2 ${
                    !selectedSize
                      ? 'bg-black/50 text-white/50 cursor-not-allowed border border-[#E4E1D5]/20'
                      : 'bg-black text-white border border-[#E4E1D5] shadow-[0_0_15px_rgba(228,225,213,0.15)] hover:bg-[#E4E1D5] hover:text-black'
                  }`}
                >
                  {isAdding ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    selectedSize ? t('productDetail.buyNow') : t('productDetail.selectSizeCta')
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDirectWhatsApp}
                  className="w-full md:w-auto px-4 min-h-[56px] rounded-2xl font-medium transition-colors text-base flex justify-center items-center bg-[#E4E1D5]/10 hover:bg-[#E4E1D5]/20 text-[#E4E1D5]"
                >
                  {t('productDetail.waOrder')}
                </button>
              </motion.div>

              {/* Share */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className="flex items-center gap-3 text-[#E4E1D5]/60"
              >
                <span className="text-xs uppercase tracking-wider">{t('common.share')}</span>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#E4E1D5]/60 hover:text-[#E4E1D5] transition-colors p-2 min-w-[48px] min-h-[48px] flex justify-center items-center"
                  aria-label={t('common.whatsapp')}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.865 9.865 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#E4E1D5]/60 hover:text-[#E4E1D5] transition-colors p-2 min-w-[48px] min-h-[48px] flex justify-center items-center"
                  aria-label="Facebook"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="text-[#E4E1D5]/60 hover:text-[#E4E1D5] transition-colors p-2 min-w-[48px] min-h-[48px] flex justify-center items-center"
                  aria-label={t('common.copyLink')}
                  title={t('common.copyLink')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6 6m3-13a9 9 0 00-9 9c0 1.898.512 3.675 1.384 5.208m0 0l2.616 2.616" />
                  </svg>
                </button>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 max-w-2xl"
        >
          <AccordionItem
            title={t('productDetail.accDesc')}
            open={accordionOpen === 0}
            onToggle={() => setAccordionOpen((v) => (v === 0 ? null : 0))}
          >
            {t('productDetail.accDescBody', { name: product.name })}
          </AccordionItem>
          <AccordionItem
            title={t('productDetail.accMat')}
            open={accordionOpen === 1}
            onToggle={() => setAccordionOpen((v) => (v === 1 ? null : 1))}
          >
            {t('productDetail.accMatBody', { material: product.material })}
          </AccordionItem>
          <AccordionItem
            title={t('productDetail.accCare')}
            open={accordionOpen === 2}
            onToggle={() => setAccordionOpen((v) => (v === 2 ? null : 2))}
          >
            {t('productDetail.accCareBody')}
          </AccordionItem>
          <AccordionItem
            title={t('productDetail.accShip')}
            open={accordionOpen === 3}
            onToggle={() => setAccordionOpen((v) => (v === 3 ? null : 3))}
          >
            {t('productDetail.accShipBody')}
          </AccordionItem>
        </motion.div>

        {/* Similar products */}
        <SimilarCarousel products={similarProducts} isMobile={isMobile} />
      </div>

      <AnimatePresence>
        {isMobile && !ctaVisible && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-14 left-0 right-0 z-40 px-4 py-3 bg-[#0a0a0a]/95 backdrop-blur border-t border-[#E4E1D5]/10"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-serif text-[#E4E1D5] truncate">{product.name}</p>
                <p className="text-sm font-semibold text-[#E4E1D5]">
                  {formatCurrencyAmount(Number(priceDisplay), { maximumFractionDigits: 0 })}
                </p>
              </div>
              <button
                type="button"
                disabled={!selectedSize || isAdding}
                onClick={handleMainAction}
                className={`px-6 min-h-[48px] rounded-2xl font-medium transition-colors text-sm flex justify-center items-center ${
                  !selectedSize
                    ? 'bg-[#E4E1D5]/20 text-[#E4E1D5]/50 cursor-not-allowed'
                    : 'bg-[#E4E1D5] text-[#0a0a0a]'
                }`}
              >
                {isAdding ? (
                   <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#0a0a0a" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="#0a0a0a" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                ) : (
                  t('productDetail.buyBar')
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sizeGuideOpen && (
          <SizeGuideModal onClose={() => setSizeGuideOpen(false)} />
        )}
      </AnimatePresence>

      <QuickOrderModal
        isOpen={isQuickOrderOpen}
        onClose={() => setQuickOrderOpen(false)}
        product={product}
        selectedSize={selectedSize}
        selectedColor={selectedColor}
      />
    </motion.div>
  );
}
