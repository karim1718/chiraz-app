import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Heart, ChevronDown, Filter, X, Loader2 } from 'lucide-react';
import type { Product } from '../types/product';
import { useProductStore } from '../store/productStore';
import { useFavoritesStore } from '../store/favoritesStore';
import {
  getPrimaryImageForColor,
  getCatalogHexForColorLabel,
  getHexForProductColor,
  isVeryLightHex,
} from '../utils/productColorAssets';
import BottomSheet from '../components/ui/BottomSheet';
import { useSearchStore } from '../store/searchStore';
import SizeChips from '../components/ui/SizeChips';
import QuickOrderModal from '../components/ui/QuickOrderModal';
import { CURRENCY, formatCurrencyAmount } from '../lib/vocab';
import { useProductStock } from '../hooks/useProductStock';
import i18n from '../i18n';

const PAGE_SIZE = 6;
const SIZES = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46];

type SortOption = 'new' | 'price_asc' | 'price_desc' | 'popular';

interface FilterState {
  sizes: number[];
  colors: string[];
  priceMin: number;
  priceMax: number;
  materials: string[];
}

const defaultFilters: FilterState = {
  sizes: [],
  colors: [],
  priceMin: 0,
  priceMax: 600,
  materials: [],
};

/** Catégories affichées sur le catalogue (aligné admin / header). */
const CATALOG_CATEGORIES = new Set(['chaussures', 'sandales']);

function normalizeColorLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function getPaletteProducts(prods: Product[]): Product[] {
  return prods.filter((p) => CATALOG_CATEGORIES.has(p.category));
}

/**
 * Couleurs des pastilles : union des couleurs encore en stock (variante)
 * sur chaussures + sandales actives uniquement, libellés normalisés (évite doublons).
 */
function getCatalogFilterColors(prods: Product[]): string[] {
  const set = new Set<string>();
  for (const p of prods) {
    const src = p.colorsAvailable?.length ? p.colorsAvailable : [];
    for (const c of src) {
      const k = normalizeColorLabel(c);
      if (k) set.add(k);
    }
  }
  const loc = i18n.language?.startsWith('ar') ? 'ar' : i18n.language?.startsWith('en') ? 'en' : 'fr';
  return Array.from(set).sort((a, b) => a.localeCompare(b, loc));
}

function getUniqueMaterials(prods: Product[]) {
  const set = new Set(prods.map((p) => p.material));
  return Array.from(set).sort();
}

function applyFiltersAndSort(
  prods: Product[],
  filters: FilterState,
  sort: SortOption,
  activeCategory: string
): Product[] {
  let result = [...prods];
  if (activeCategory) {
    result = result.filter((p) => p.category === activeCategory);
  }
  if (filters.sizes.length) {
    result = result.filter((p) => p.sizes.some((s) => filters.sizes.includes(s)));
  }
  if (filters.colors.length) {
    const wanted = new Set(filters.colors.map(normalizeColorLabel));
    result = result.filter((p) => {
      const avail = p.colorsAvailable?.length ? p.colorsAvailable : p.colors;
      return avail.some((c) => wanted.has(normalizeColorLabel(c)));
    });
  }
  result = result.filter(
    (p) => p.price >= filters.priceMin && p.price <= filters.priceMax
  );
  if (filters.materials.length) {
    result = result.filter((p) => filters.materials.includes(p.material));
  }
  if (sort === 'price_asc') result.sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') result.sort((a, b) => b.price - a.price);
  else if (sort === 'new') {
    const hasNew = (p: Product) => p.badge === 'Nouveau';
    result.sort((a, b) => (hasNew(b) ? 1 : 0) - (hasNew(a) ? 1 : 0));
  }
  return result;
}

// --- Product card with hover, badges, heart, quick view ---
function ProductCard({
  product,
  index,
  onQuickView,
}: {
  product: Product;
  index: number;
  onQuickView: (p: Product) => void;
}) {
  const { t } = useTranslation();
  const has = useFavoritesStore((s) => s.has(product.id));
  const toggle = useFavoritesStore((s) => s.toggle);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="group relative"
    >
      <Link to={`/product/${product.id}`} className="block">
        <div className="relative aspect-square bg-[#f8f8f8] rounded-xl overflow-hidden shadow-sm group-hover:shadow-md transition-shadow duration-300">
          <motion.div
            className="absolute inset-0 flex items-center justify-center overflow-hidden p-4 sm:p-5"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ touchAction: 'manipulation' }}
          >
            {getPrimaryImageForColor(product, product.colors[0]) ? (
              <>
                <img
                  src={getPrimaryImageForColor(product, product.colors[0])}
                  alt={product.name}
                  className="w-full h-full object-contain object-center"
                  onError={(e) => {
                    const t = e.target as HTMLImageElement;
                    t.style.display = 'none';
                    t.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <span className="font-serif text-[#0a0a0a]/40 text-lg hidden absolute">
                  {product.name}
                </span>
              </>
            ) : (
              <span className="font-serif text-[#0a0a0a]/40 text-lg">
                {product.name}
              </span>
            )}
          </motion.div>

          {/* Badges top-left */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
            {product.badge === 'Nouveau' && (
              <span className="px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase bg-[#E4E1D5] text-[#0a0a0a] rounded shadow-sm">
                {t('common.new')}
              </span>
            )}
            {product.maxSalePercent != null && (
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-rose-500 text-white rounded shadow-md">
                {t('catalog.saleUpToBadge', { percent: product.maxSalePercent })}
              </span>
            )}
            {!product.maxSalePercent && product.salePercent != null && (
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-rose-500 text-white rounded shadow-md">
                {t('catalog.salePercent', { percent: product.salePercent })}
              </span>
            )}
          </div>

          {/* Heart top-right */}
          <button
            type="button"
            aria-label={t('catalog.favoriteAria')}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-[#0a0a0a]/60 hover:bg-[#0a0a0a]/80 transition-colors min-h-[48px] px-4"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle(product.id);
            }}
          >
            <motion.div
              animate={{ scale: has ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <Heart
                size={18}
                className="text-[#E4E1D5]"
                fill={has ? '#E4E1D5' : 'transparent'}
                strokeWidth={1.5}
              />
            </motion.div>
          </button>

          {/* Aperçu rapide: always visible on mobile, slide-up on hover desktop */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-sm p-3 flex justify-center z-10 min-h-[44px] items-center translate-y-0 opacity-100 md:translate-y-full md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 transition-all duration-250"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickView(product);
            }}
          >
            <span className="text-xs font-medium tracking-wider uppercase text-[#E4E1D5]">
              {t('catalog.quickViewAria')}
            </span>
          </motion.div>
        </div>
        <p className="font-serif text-base sm:text-lg text-[#E4E1D5] mt-2 sm:mt-4 truncate group-hover:text-white transition-colors">{product.name}</p>
        <p className="text-[#E4E1D5]/80 mt-1 text-base">
          {product.minPrice != null && product.minPrice < product.price ? (
            <span className="font-medium text-white">
              {t('common.fromPrice', {
                price: formatCurrencyAmount(Number(product.minPrice), { maximumFractionDigits: 0 }),
              })}
            </span>
          ) : product.salePercent != null ? (
            <>
              <span className="line-through text-[#E4E1D5]/50 mr-2 text-sm">
                {formatCurrencyAmount(Number(product.original_price || product.price), { maximumFractionDigits: 0 })}
              </span>
              <span className="font-medium text-white">
                {formatCurrencyAmount(Number(product.price), { maximumFractionDigits: 0 })}
              </span>
            </>
          ) : (
            <span className="font-medium">
              {formatCurrencyAmount(Number(product.price), { maximumFractionDigits: 0 })}
            </span>
          )}
        </p>
      </Link>
    </motion.article>
  );
}

// --- Quick view modal ---
function QuickViewModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [selectedSize, setSelectedSize] = useState<number | null>(product.sizes[0] ?? null);
  const [selectedColor, setSelectedColor] = useState<string>(product.colors[0] ?? '');

  useEffect(() => {
    setSelectedSize(product.sizes[0] ?? null);
    setSelectedColor(product.colors[0] ?? '');
  }, [product.id]);
  const [isQuickOrderOpen, setIsQuickOrderOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  const { variants } = useProductStock(product.id);

  const handleMainAction = () => {
    setIsAdding(true);
    setTimeout(() => {
      setIsAdding(false);
      setIsQuickOrderOpen(true);
    }, 800);
  };

  const getActiveVariant = () => {
    if (!variants.length) return null;
    return variants.find(v => v.size === selectedSize && v.color === selectedColor);
  };

  const activeVariant = getActiveVariant();
  const priceDisplay = activeVariant?.price != null ? activeVariant.price : product.price;
  const originalPriceDisplay = activeVariant?.original_price || (product.original_price && product.original_price > product.price ? product.original_price : undefined);
  const salePercentDisplay = (originalPriceDisplay && originalPriceDisplay > priceDisplay) 
    ? Math.round(((originalPriceDisplay - priceDisplay) / originalPriceDisplay) * 100) 
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-[#0a0a0a] border border-[#E4E1D5]/20 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 relative">
          <button
            type="button"
            aria-label={t('common.close')}
            className="absolute top-2 right-2 min-w-[48px] min-h-[48px] flex items-center justify-center text-[#E4E1D5]/70 hover:text-[#E4E1D5] z-10"
            onClick={onClose}
          >
            <X size={20} />
          </button>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="aspect-square bg-[#f8f8f8] rounded-xl overflow-hidden p-4 flex items-center justify-center">
              {getPrimaryImageForColor(product, selectedColor) ? (
                <img
                  src={getPrimaryImageForColor(product, selectedColor)}
                  alt={product.name}
                  className="w-full h-full object-contain object-center"
                />
              ) : (
                <span className="flex items-center justify-center h-full text-[#0a0a0a]/40 font-serif">
                  {product.name}
                </span>
              )}
            </div>
            <div>
              <h2 className="font-serif text-2xl text-[#E4E1D5]">{product.name}</h2>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-xl font-medium text-white">
                  {formatCurrencyAmount(Number(priceDisplay), { maximumFractionDigits: 0 })}
                </p>
                {originalPriceDisplay && (
                  <p className="text-sm line-through text-[#E4E1D5]/50">
                    {formatCurrencyAmount(Number(originalPriceDisplay), { maximumFractionDigits: 0 })}
                  </p>
                )}
                {salePercentDisplay != null && (
                  <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-rose-500 text-white rounded shadow-md">
                    -{salePercentDisplay}%
                  </span>
                )}
              </div>
              <p className="text-sm text-[#E4E1D5]/60 mt-2">{product.material}</p>

              {product.colors.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wider text-[#E4E1D5]/70 mb-2">{t('common.color')}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {product.colors.map((c) => {
                      const hx = getHexForProductColor(product, c);
                      const light = isVeryLightHex(hx);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSelectedColor(c)}
                          title={c}
                          className={`min-h-[44px] min-w-[44px] w-10 h-10 rounded-md border-2 transition-transform ${
                            selectedColor === c
                              ? 'border-[#E4E1D5] ring-2 ring-[#E4E1D5]/30 scale-105'
                              : 'border-[#E4E1D5]/30 hover:border-[#E4E1D5]/60'
                          } ${light ? 'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]' : ''}`}
                          style={{ backgroundColor: hx }}
                        />
                      );
                    })}
                    <span className="text-sm text-[#E4E1D5]/80 ml-1">{selectedColor}</span>
                  </div>
                </div>
              )}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-[#E4E1D5]">{t('catalog.selectSize')}</p>
                </div>
                <SizeChips
                  productId={product.id}
                  selectedColor={selectedColor}
                  sizes={product.sizes}
                  selectedSize={selectedSize}
                  onSelect={setSelectedSize}
                />
              </div>

              <button
                type="button"
                disabled={!selectedSize || isAdding}
                onClick={handleMainAction}
                className={`mt-6 w-full px-4 min-h-[56px] font-medium rounded-2xl transition-colors flex items-center justify-center ${
                  !selectedSize
                    ? 'bg-black/50 text-white/50 cursor-not-allowed border border-[#E4E1D5]/20'
                    : 'bg-black text-white border border-[#E4E1D5] hover:bg-[#E4E1D5] hover:text-black shadow-[0_0_15px_rgba(228,225,213,0.15)]'
                }`}
              >
                {isAdding ? (
                   <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                ) : (
                  t('catalog.buyNow')
                )}
              </button>
              <Link
                to={`/product/${product.id}`}
                onClick={onClose}
                className="block mt-3 text-center text-sm text-[#E4E1D5]/80 hover:text-[#E4E1D5] underline"
              >
                {t('catalog.seeFull')}
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      <QuickOrderModal
        isOpen={isQuickOrderOpen}
        onClose={() => setIsQuickOrderOpen(false)}
        product={product}
        selectedSize={selectedSize}
        selectedColor={selectedColor}
      />
    </motion.div>
  );
}

// --- Sort dropdown ---
function SortDropdown({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (v: SortOption) => void;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const labels = useMemo(
    (): Record<SortOption, string> => ({
      new: t('catalog.sortNew'),
      price_asc: t('catalog.sortPriceAsc'),
      price_desc: t('catalog.sortPriceDesc'),
      popular: t('catalog.sortPopular'),
    }),
    [t, i18n.language]
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 min-h-[48px] border border-[#E4E1D5]/20 rounded text-[#E4E1D5] text-sm hover:border-[#E4E1D5]/40 transition-colors"
      >
        <span>{labels[value]}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <motion.ul
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute end-0 top-full mt-1 py-1 min-w-[180px] bg-[#0a0a0a] border border-[#E4E1D5]/20 rounded shadow-xl z-20"
            >
              {(Object.keys(labels) as SortOption[]).map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                    className={`w-full text-start px-4 py-2 text-sm transition-colors ${
                      value === opt ? 'text-[#E4E1D5] bg-[#E4E1D5]/10' : 'text-[#E4E1D5]/80 hover:bg-[#E4E1D5]/5'
                    }`}
                  >
                    {labels[opt]}
                  </button>
                </li>
              ))}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Filter sidebar content (shared by sidebar + drawer) ---
function FilterContent({
  filters,
  setFilters,
  allColors,
  allMaterials,
  priceRange,
  resultCount,
  onReset,
  onClose,
  catalogProducts,
}: {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  allColors: string[];
  allMaterials: string[];
  priceRange: { min: number; max: number };
  resultCount: number;
  onReset: () => void;
  onClose?: () => void;
  catalogProducts: Product[];
}) {
  const { t } = useTranslation();
  const toggleSize = (s: number) => {
    setFilters((f) => ({
      ...f,
      sizes: f.sizes.includes(s) ? f.sizes.filter((x) => x !== s) : [...f.sizes, s],
    }));
  };
  const toggleColor = (c: string) => {
    setFilters((f) => ({
      ...f,
      colors: f.colors.includes(c) ? f.colors.filter((x) => x !== c) : [...f.colors, c],
    }));
  };
  const toggleMaterial = (m: string) => {
    setFilters((f) => ({
      ...f,
      materials: f.materials.includes(m) ? f.materials.filter((x) => x !== m) : [...f.materials, m],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#E4E1D5]/80">
          {t('common.results', { count: resultCount })}
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center text-[#E4E1D5]/70 hover:text-[#E4E1D5]"
            aria-label={t('common.filterClose')}
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-[#E4E1D5]/70 mb-2">
          {t('common.size')}
        </p>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSize(s)}
              className={`w-9 h-9 rounded border text-xs ${
                filters.sizes.includes(s)
                  ? 'border-[#E4E1D5] bg-[#E4E1D5]/10 text-[#E4E1D5]'
                  : 'border-[#E4E1D5]/30 text-[#E4E1D5]/80 hover:border-[#E4E1D5]/50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-[#E4E1D5]/70 mb-2">
          {t('common.color')}
        </p>
        <div className="flex flex-wrap gap-2">
          {allColors.map((c) => {
            const hx = getCatalogHexForColorLabel(catalogProducts, c);
            const light = isVeryLightHex(hx);
            return (
            <button
              key={c}
              type="button"
              onClick={() => toggleColor(c)}
              title={c}
              className={`min-w-[44px] min-h-[44px] w-8 h-8 rounded-md border-2 transition-transform hover:scale-105 ${
                filters.colors.includes(c) ? 'border-[#E4E1D5] ring-2 ring-[#E4E1D5]/30 scale-105' : 'border-[#E4E1D5]/30'
              } ${light ? 'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]' : ''}`}
              style={{ backgroundColor: hx }}
            />
          );})}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-[#E4E1D5]/70 mb-2">
          {t('common.price', { code: CURRENCY.code })}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={priceRange.min}
            max={priceRange.max}
            value={filters.priceMin}
            onChange={(e) =>
              setFilters((f) => ({ ...f, priceMin: Number(e.target.value) || 0 }))
            }
            className="w-20 px-2 py-1.5 bg-[#1a1a1a] border border-[#E4E1D5]/20 rounded text-[#E4E1D5] text-sm"
          />
          <span className="text-[#E4E1D5]/50">–</span>
          <input
            type="number"
            min={priceRange.min}
            max={priceRange.max}
            value={filters.priceMax}
            onChange={(e) =>
              setFilters((f) => ({ ...f, priceMax: Number(e.target.value) || priceRange.max }))
            }
            className="w-20 px-2 py-1.5 bg-[#1a1a1a] border border-[#E4E1D5]/20 rounded text-[#E4E1D5] text-sm"
          />
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-[#E4E1D5]/70 mb-2">
          {t('common.material')}
        </p>
        <div className="flex flex-wrap gap-2">
          {allMaterials.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMaterial(m)}
              className={`px-2 py-1 rounded text-xs ${
                filters.materials.includes(m)
                  ? 'bg-[#E4E1D5] text-[#0a0a0a]'
                  : 'bg-[#E4E1D5]/10 text-[#E4E1D5]/80 hover:bg-[#E4E1D5]/20'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="text-sm text-[#E4E1D5]/70 hover:text-[#E4E1D5] underline min-h-[48px] px-4 flex items-center"
      >
        {t('common.resetFilters')}
      </button>
    </div>
  );
}

function countActiveFilters(f: FilterState): number {
  let n = 0;
  if (f.sizes.length) n++;
  if (f.colors.length) n++;
  if (f.materials.length) n++;
  if (f.priceMin > 0 || f.priceMax < 600) n++;
  return n;
}

export default function CatalogPage() {
  const { t, i18n } = useTranslation();
  const { products, isLoading: storeLoading } = useProductStore();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [sort, setSort] = useState<SortOption>('new');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const [searchParams] = useSearchParams();
  const urlCategory = searchParams.get('category');
  const storeCategory = useSearchStore((s) => s.activeCategory);
  
  // L'URL est le maître, le store est le fallback
  const activeCategory = urlCategory || storeCategory;

  const paletteProducts = useMemo(
    () => getPaletteProducts(products),
    [products],
  );

  const priceRange = useMemo(() => {
    const prices = paletteProducts.map((p) => p.price);
    return { min: 0, max: Math.max(600, ...prices, 0) };
  }, [paletteProducts]);

  const filtered = useMemo(
    () => applyFiltersAndSort(products, filters, sort, activeCategory),
    [products, filters, sort, activeCategory]
  );

  const allColors = useMemo(
    () => getCatalogFilterColors(paletteProducts),
    [paletteProducts],
  );
  const allMaterials = useMemo(
    () => getUniqueMaterials(paletteProducts),
    [paletteProducts],
  );

  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const loading = displayCount < filtered.length || storeLoading;
  const hasMore = displayCount < filtered.length;
  const displayed = useMemo(
    () => filtered.slice(0, displayCount),
    [filtered, displayCount]
  );

  const loadMore = useCallback(() => {
    setDisplayCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
  }, [filtered.length]);

  const observerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = observerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '200px', threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [filters, sort, activeCategory]);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQuickViewProduct(null);
        setFilterSheetOpen(false);
        setSortSheetOpen(false);
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    setDisplayCount(PAGE_SIZE);
  }, []);

  const activeFiltersCount = countActiveFilters(filters);
  const sortLabels = useMemo(
    (): Record<SortOption, string> => ({
      new: t('catalog.sortNew'),
      price_asc: t('catalog.sortPriceAsc'),
      price_desc: t('catalog.sortPriceDesc'),
      popular: t('catalog.sortPopular'),
    }),
    [t, i18n.language]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="pt-24 sm:pt-28 pb-32 md:pb-24 px-4 md:px-6 lg:px-8 min-h-screen"
    >
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        {/* Sidebar desktop */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-28">
            <FilterContent
              filters={filters}
              setFilters={setFilters}
              allColors={allColors}
              allMaterials={allMaterials}
              priceRange={priceRange}
              resultCount={filtered.length}
              onReset={resetFilters}
              catalogProducts={paletteProducts}
            />
          </div>
        </aside>

        {/* Main: sort + grid */}
        <div className="flex-1 min-w-0">
          <div className="relative z-10 bg-[#0a0a0a]/95 backdrop-blur py-2 -mx-4 px-4 md:mx-0 md:px-0 md:bg-transparent md:backdrop-blur-none">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-8">
              <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl text-[#E4E1D5]">{t('catalog.title')}</h1>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(true)}
                  className="lg:hidden flex items-center gap-2 min-h-[44px] px-4 py-2 border border-[#E4E1D5]/20 rounded text-[#E4E1D5] text-sm"
                >
                  <Filter size={18} />
                  {t('common.filters')}
                  {activeFiltersCount > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-[#E4E1D5] text-[#0a0a0a] text-xs font-bold">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
                <div className="hidden lg:flex">
                  <SortDropdown value={sort} onChange={setSort} />
                </div>
                <button
                  type="button"
                  onClick={() => setSortSheetOpen(true)}
                  className="lg:hidden flex items-center gap-2 min-h-[44px] px-4 py-2 border border-[#E4E1D5]/20 rounded text-[#E4E1D5] text-sm"
                >
                  {t('common.sort')} <ChevronDown size={16} />
                </button>
              </div>
            </div>
            <p className="text-sm text-[#E4E1D5]/70 mb-4 lg:hidden">
              {t('common.results', { count: filtered.length })}
            </p>
          </div>

          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-2 max-[380px]:grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-3 md:gap-8">
              {displayed.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={i}
                  onQuickView={setQuickViewProduct}
                />
              ))}
            </div>
          </AnimatePresence>

          {/* Infinite scroll sentinel + loader + end message */}
          <div ref={observerRef} className="h-4" />
          <div className="flex justify-center py-8">
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[#E4E1D5]/70"
              >
                <Loader2 size={28} className="animate-spin" />
              </motion.div>
            )}
            {filtered.length > 0 && !hasMore && !storeLoading && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-[#E4E1D5]/60"
              >
                {t('common.allLoaded')}
              </motion.p>
            )}
            {filtered.length === 0 && (
              <p className="text-[#E4E1D5]/60">{t('common.noMatch')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter bottom sheet */}
      <BottomSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        maxHeight="85vh"
        showHandle
        dragToDismiss
      >
        <FilterContent
          filters={filters}
          setFilters={setFilters}
          allColors={allColors}
          allMaterials={allMaterials}
          priceRange={priceRange}
          resultCount={filtered.length}
          onReset={resetFilters}
          catalogProducts={paletteProducts}
        />
        <button
          type="button"
          onClick={() => setFilterSheetOpen(false)}
          className="mt-6 w-full min-h-[48px] py-3 bg-[#E4E1D5] text-[#0a0a0a] font-medium rounded"
        >
          {t('catalog.apply', { count: filtered.length })}
        </button>
      </BottomSheet>

      {/* Mobile sort bottom sheet */}
      <BottomSheet
        open={sortSheetOpen}
        onClose={() => setSortSheetOpen(false)}
        maxHeight="50vh"
        showHandle
        title={t('catalog.sortSheetTitle')}
      >
        <ul className="space-y-0">
          {(Object.keys(sortLabels) as SortOption[]).map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onClick={() => {
                  setSort(opt);
                  setSortSheetOpen(false);
                }}
                className={`w-full text-start min-h-[48px] px-4 py-3 text-sm border-b border-[#E4E1D5]/10 last:border-0 ${
                  sort === opt ? 'text-[#E4E1D5] bg-[#E4E1D5]/10' : 'text-[#E4E1D5]/80'
                }`}
              >
                {sortLabels[opt]}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>

      {/* Quick view modal */}
      <AnimatePresence>
        {quickViewProduct && (
          <QuickViewModal
            key={quickViewProduct.id}
            product={quickViewProduct}
            onClose={() => setQuickViewProduct(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
