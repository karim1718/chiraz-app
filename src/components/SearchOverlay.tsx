import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../types/product';
import { useProductStore } from '../store/productStore';
import { useSearchStore } from '../store/searchStore';
import { normalizeSearch } from '../utils/search';
import { formatCurrencyAmount } from '../lib/vocab';
import { getPrimaryImageForColor } from '../utils/productColorAssets';

const FEATURED_IDS = ['chz-001', 'chz-004', 'chz-005', 'chz-007'];
const POPULAR_TAG_KEYS = [
  'tagDerby',
  'tagOxford',
  'tagCuir',
  'tagNew',
  'tagChelsea',
  'tagEscarpin',
  'tagBallerine',
  'tagSneaker',
] as const;
const EMPTY_SUGGESTION_KEYS = ['tagDerby', 'tagOxford', 'tagChelsea', 'tagCuir'] as const;

/** Canonical query strings (product/catalog language) — labels are translated separately. */
const TAG_SEARCH_QUERY: Record<(typeof POPULAR_TAG_KEYS)[number], string> = {
  tagDerby: 'Derby',
  tagOxford: 'Oxford',
  tagCuir: 'Cuir',
  tagNew: 'Nouvelle collection',
  tagChelsea: 'Chelsea',
  tagEscarpin: 'Escarpin',
  tagBallerine: 'Ballerine',
  tagSneaker: 'Sneaker',
};

function getFeaturedProducts(prods: Product[]): Product[] {
  return prods.filter((p) => FEATURED_IDS.includes(p.id)).slice(0, 4);
}

function searchProducts(query: string, prods: Product[]): Product[] {
  const q = normalizeSearch(query).trim();
  if (!q) return [];
  return prods.filter((p) => {
    const name = normalizeSearch(p.name);
    const category = normalizeSearch(p.category);
    const material = normalizeSearch(p.material);
    const colors = p.colors.map((c) => normalizeSearch(c)).join(' ');
    return (
      name.includes(q) ||
      category.includes(q) ||
      material.includes(q) ||
      colors.includes(q)
    );
  });
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function SearchOverlay() {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const {
    isOpen,
    query,
    results,
    setQuery,
    setResults,
    closeSearch,
    reset,
  } = useSearchStore();

  const products = useProductStore((s) => s.products);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const list = searchProducts(debouncedQuery, products);
    setResults(list);
  }, [debouncedQuery, setResults, products, isOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeSearch]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) closeSearch();
  };

  const handleResultClick = (product: Product) => {
    closeSearch();
    reset();
    navigate(`/product/${product.id}`);
  };

  const handleTagClick = (tag: string) => {
    setQuery(tag);
  };

  const featured = useMemo(() => getFeaturedProducts(products), [products]);

  const showInitial = !query.trim();
  const showEmpty = query.trim() && results.length === 0;
  const showResults = query.trim() && results.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          initial={{ y: '-100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 bg-[#0a0a0a] z-[100] flex flex-col overflow-hidden"
          onClick={handleBackdropClick}
        >
          <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-8 sm:pt-12 pb-8 flex flex-col flex-1 min-h-0 pb-[env(keyboard-inset-height,0)]" onClick={(e) => e.stopPropagation()}>
            {/* Header : champ + fermer */}
            <div className="flex items-center gap-4 mb-8">
              <Search size={28} className="text-[#E4E1D5]/60 flex-shrink-0" strokeWidth={1.5} />
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('search.placeholder')}
                  className="w-full bg-transparent border-0 border-b-2 border-[#E4E1D5]/30 focus:border-[#E4E1D5] focus:outline-none py-3 text-[#E4E1D5] text-2xl sm:text-3xl md:text-4xl lg:text-5xl placeholder:text-[#E4E1D5]/40 caret-[#E4E1D5] transition-colors min-h-[48px]"
                  aria-label={t('search.aria')}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute end-0 top-1/2 -translate-y-1/2 p-2 text-[#E4E1D5]/50 hover:text-[#E4E1D5]"
                    aria-label={t('search.clear')}
                  >
                    <X size={22} strokeWidth={1.5} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={closeSearch}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-[#E4E1D5]/70 hover:text-[#E4E1D5] flex-shrink-0"
                aria-label={t('common.close')}
              >
                <X size={28} strokeWidth={1.5} />
              </button>
            </div>

            {/* Contenu scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* État initial : Tendances + Recherches populaires */}
              {showInitial && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-12"
                >
                  <section>
                    <h3 className="font-serif text-lg text-[#E4E1D5]/80 mb-4">{t('search.trends')}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {featured.map((product, i) => {
                        const thumb = getPrimaryImageForColor(product, product.colors?.[0]);
                        return (
                        <motion.button
                          key={product.id}
                          type="button"
                          onClick={() => handleResultClick(product)}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="text-start group"
                        >
                          <div className="aspect-square rounded-lg overflow-hidden bg-[#1a1a1a] mb-2">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <span className="flex items-center justify-center h-full text-[#E4E1D5]/30 text-sm">—</span>
                            )}
                          </div>
                          <p className="font-serif text-[#E4E1D5] truncate">{product.name}</p>
                          <p className="text-sm text-[#E4E1D5]/60">
                            {formatCurrencyAmount(Number(product.price), { maximumFractionDigits: 0 })}
                          </p>
                        </motion.button>
                        );
                      })}
                    </div>
                  </section>
                  <section>
                    <h3 className="font-serif text-lg text-[#E4E1D5]/80 mb-4">{t('search.popular')}</h3>
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 hide-scrollbar sm:flex-wrap sm:overflow-visible">
                      {POPULAR_TAG_KEYS.map((key, i) => (
                        <motion.button
                          key={key}
                          type="button"
                          onClick={() => handleTagClick(TAG_SEARCH_QUERY[key])}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 + i * 0.03 }}
                          className="flex-shrink-0 min-h-[44px] px-4 py-2 rounded-full border border-[#E4E1D5]/30 text-[#E4E1D5]/90 hover:bg-[#E4E1D5]/10 hover:border-[#E4E1D5]/50 transition-colors text-sm"
                        >
                          {t(`search.${key}`)}
                        </motion.button>
                      ))}
                    </div>
                  </section>
                </motion.div>
              )}

              {/* Résultats */}
              {showResults && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  <p className="text-[#E4E1D5]/70 text-sm">
                    {t('search.resultsFor', { count: results.length, query })}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {results.map((product, i) => {
                      const thumb = getPrimaryImageForColor(product, product.colors?.[0]);
                      return (
                      <motion.button
                        key={product.id}
                        type="button"
                        onClick={() => handleResultClick(product)}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-4 p-3 rounded-lg text-start min-h-[48px] hover:bg-[#E4E1D5]/10 rtl:hover:-translate-x-2 hover:translate-x-2 transition-all duration-200 group w-full"
                      >
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#1a1a1a] flex-shrink-0">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="flex items-center justify-center h-full text-[#E4E1D5]/30 text-xs">—</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-serif text-[#E4E1D5] truncate">
                            {product.name}
                          </p>
                          <p className="text-sm text-[#E4E1D5]/60">
                            {formatCurrencyAmount(Number(product.price), { maximumFractionDigits: 0 })} ·{' '}
                            {product.category === 'chaussures' ? t('catalog.chaussures') : t('catalog.sandales')}
                          </p>
                        </div>
                      </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* État vide */}
              {showEmpty && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <p className="font-serif text-xl text-[#E4E1D5]/90 mb-2">
                    {t('search.empty', { query })}
                  </p>
                  <p className="text-[#E4E1D5]/50 text-sm mb-6">
                    {t('search.emptyHint')}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {EMPTY_SUGGESTION_KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleTagClick(TAG_SEARCH_QUERY[key])}
                        className="px-3 py-1.5 rounded border border-[#E4E1D5]/20 text-[#E4E1D5]/70 hover:bg-[#E4E1D5]/10 text-sm"
                      >
                        {t(`search.${key}`)}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
