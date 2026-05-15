import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { CURRENCY, formatCurrencyAmount } from '../../lib/vocab';
import { 
  Search, Plus, Edit2, Trash2, Image as ImageIcon, 
  ChevronLeft, ChevronRight, AlertCircle, LayoutList, LayoutGrid, ArrowUpDown, Truck, Save,
  CheckCircle2,
} from 'lucide-react';
import type { Product } from '../../types/product';
import { useProductStore } from '../../store/productStore';
import ProductFormModal from '../../components/admin/ProductFormModal';
import ConfirmModal from '../../components/admin/ui/ConfirmModal';
import { useToast } from '../../components/admin/ui/Toast';
import { fetchShopShippingSettings } from '../../lib/shopShippingSettings';

interface ProductWithCount extends Product {
  variant_count: number;
  has_promo?: boolean;
}

type SortField = 'created_at' | 'name' | 'price' | 'is_active';

export default function AdminProducts() {
  const { showToast } = useToast();
  const refetchCatalogStore = useProductStore((s) => s.fetchProducts);
  const [products, setProducts] = useState<ProductWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('tous');
  const [genderFilter, setGenderFilter] = useState('tous');
  const [statusFilter, setStatusFilter] = useState('tous');

  // Pagination
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  // Modal Placeholder State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithCount | null>(null);
  const [productToDelete, setProductToDelete] = useState<ProductWithCount | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [density] = useState<'compact' | 'comfortable'>('comfortable');

  const [shippingEnabled, setShippingEnabled] = useState(true);
  const [defaultShippingFee, setDefaultShippingFee] = useState('0');
  const [shippingSettingsReady, setShippingSettingsReady] = useState(false);
  const [shippingSaveLoading, setShippingSaveLoading] = useState(false);
  /** Dernière config confirmée en base (affichage « enregistré »). */
  const [savedShipping, setSavedShipping] = useState<{
    enabled: boolean;
    fee: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await fetchShopShippingSettings();
      if (cancelled) return;
      const fee = Math.max(0, Number(s.default_shipping_fee ?? 0));
      setShippingEnabled(s.shipping_enabled);
      setDefaultShippingFee(String(s.default_shipping_fee));
      setSavedShipping({ enabled: s.shipping_enabled, fee });
      setShippingSettingsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, categoryFilter, genderFilter, statusFilter, sortField, sortDirection]);

  // Debounce pour la recherche textuelle
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      // Si on cherche, on repasse à la page 1
      if (page !== 1) setPage(1);
      else fetchProducts();
    }, 400);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch variants details for promo checks instead of just count
      let query = supabase
        .from('products')
        .select('*, variants(price, original_price)', { count: 'exact' });

      // Application des filtres
      if (searchQuery.trim()) {
        query = query.ilike('name', `%${searchQuery.trim()}%`);
      }
      if (categoryFilter !== 'tous') {
        query = query.eq('category', categoryFilter);
      }
      if (genderFilter !== 'tous') {
        query = query.eq('gender', genderFilter);
      }
      if (statusFilter !== 'tous') {
        query = query.eq('is_active', statusFilter === 'actifs');
      }

      // Pagination
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query
        .order(sortField, { ascending: sortDirection === 'asc' })
        .range(from, to);

      const { data, count, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Transformation des données pour extraire le variant_count et les promos
      const formattedData: ProductWithCount[] = (data || []).map((item: any) => {
        const variants = item.variants || [];
        const variantCount = variants.length;
        
        let hasPromo = false;
        if (item.original_price && item.original_price > item.price) {
          hasPromo = true;
        } else {
          for (const v of variants) {
            const vPrice = v.price != null ? v.price : item.price;
            if (v.original_price && v.original_price > vPrice) {
              hasPromo = true;
              break;
            }
          }
        }

        return {
          ...item,
          variant_count: variantCount,
          has_promo: hasPromo
        };
      });

      setProducts(formattedData);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error(err);
      setError("Impossible de charger les produits. " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      const { data, error } = await supabase
        .from('products')
        .update({ is_active: newStatus })
        .eq('id', id)
        .select('id, is_active')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error("Aucune ligne mise à jour. Vérifiez les permissions (RLS) sur la table products.");
      }

      // Mise à jour optimiste de la ligne dans l'UI sans recharger tout
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: data.is_active } : p));
      showToast(
        `Produit ${data.is_active ? 'activé' : 'désactivé'}. Visible dans le catalogue si actif.`,
        'success',
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Statut non mis à jour : ${msg}`, 'error');
    }
  };

  const handleDelete = async (product: ProductWithCount) => {
    setProductToDelete(product);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productToDelete.id);

      if (error) throw error;

      setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id));
      setSelectedIds((prev) => prev.filter((id) => id !== productToDelete.id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      setProductToDelete(null);
      showToast('Produit supprimé. La liste a été mise à jour.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Suppression impossible : ${msg}`, 'error');
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((productId) => productId !== id) : [...prev, id],
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = products.map((product) => product.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) => {
      if (allSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }
      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const handleBulkSetActive = async (isActive: boolean) => {
    if (selectedIds.length === 0) return;
    try {
      const { data, error } = await supabase
        .from('products')
        .update({ is_active: isActive })
        .in('id', selectedIds)
        .select('id');

      if (error) throw error;
      const updatedIds = new Set((data || []).map((row) => row.id as string));
      if (updatedIds.size === 0) {
        throw new Error("Aucun produit n'a été mis à jour. Vérifiez les permissions (RLS) sur la table products.");
      }

      setProducts((prev) =>
        prev.map((product) =>
          updatedIds.has(product.id) ? { ...product, is_active: isActive } : product,
        ),
      );
      setSelectedIds([]);
      showToast(
        `${updatedIds.size} produit(s) ${isActive ? 'activés' : 'désactivés'} en lot.`,
        'success',
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Mise à jour en lot impossible : ${msg}`, 'error');
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const allVisibleSelected =
    products.length > 0 && products.every((product) => selectedIds.includes(product.id));
  const activeCount = products.filter((p) => p.is_active !== false).length;
  const inactiveCount = products.length - activeCount;
  const promoCount = products.filter((p) => p.has_promo).length;

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('tous');
    setGenderFilter('tous');
    setStatusFilter('tous');
    setPage(1);
  };

  const saveShippingSettings = async () => {
    setShippingSaveLoading(true);
    try {
      const fee = Math.max(0, Number(String(defaultShippingFee).replace(',', '.') || 0) || 0);
      const { error } = await supabase
        .from('shop_shipping_settings')
        .update({
          shipping_enabled: shippingEnabled,
          default_shipping_fee: fee,
        })
        .eq('id', 1);

      if (error) throw error;
      setDefaultShippingFee(String(fee));
      setSavedShipping({ enabled: shippingEnabled, fee });
      showToast('Paramètres de livraison enregistrés.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Enregistrement impossible : ${msg}`, 'error');
    } finally {
      setShippingSaveLoading(false);
    }
  };

  const shippingFeeDraft = useMemo(
    () => Math.max(0, Number(String(defaultShippingFee).replace(',', '.') || 0) || 0),
    [defaultShippingFee],
  );

  const shippingSynced =
    shippingSettingsReady &&
    savedShipping !== null &&
    savedShipping.enabled === shippingEnabled &&
    savedShipping.fee === shippingFeeDraft;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDirection(field === 'name' ? 'asc' : 'desc');
    setPage(1);
  };

  const rowPaddingClass = density === 'compact' ? 'py-2.5' : 'py-3.5';

  return (
    <div className="min-h-full bg-[#F9FAFB] pb-10 font-sans text-neutral-900 antialiased">
      <div className="mx-auto max-w-[1600px] space-y-8 px-5 py-8 sm:px-6 lg:px-8">
        
        {/* En-tête */}
        <header className="border-b border-neutral-200/80 pb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-neutral-950">
              Produits
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
              Gérez votre catalogue : ajoutez des produits, mettez à jour les prix et suivez vos stocks. ({totalCount} produits trouvés)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border border-neutral-200 rounded-lg p-1 bg-white">
              <button
                onClick={() => setViewMode('table')}
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === 'table'
                    ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="Vue tableau"
              >
                <LayoutList size={16} />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="Vue cartes"
              >
                <LayoutGrid size={16} />
              </button>
            </div>

            <button
              onClick={() => {
                setEditingProduct(null);
                setIsModalOpen(true);
              }}
              className="bg-neutral-900 hover:bg-black text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={18} />
              Ajouter
            </button>
          </div>
        </header>

        <section
          aria-label="Livraison boutique"
          className={`rounded-2xl border bg-white p-5 shadow-sm transition-colors sm:p-6 ${
            shippingSynced
              ? 'border-emerald-200/90 ring-1 ring-emerald-500/15'
              : 'border-neutral-200/90 ring-1 ring-amber-500/10'
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white">
                <Truck size={20} strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                  <h2 className="font-serif text-lg font-semibold text-neutral-950">
                    Livraison (boutique en ligne)
                  </h2>
                  {shippingSettingsReady ? (
                    shippingSynced ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                        <CheckCircle2 size={12} strokeWidth={2.5} aria-hidden />
                        Enregistré
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                        <AlertCircle size={12} strokeWidth={2.5} aria-hidden />
                        Non enregistré
                      </span>
                    )
                  ) : null}
                </div>
                <p className="mt-1 max-w-xl text-sm text-neutral-500">
                  Définissez les frais par défaut proposés à la commande rapide. Le client peut les ajuster avant validation.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={saveShippingSettings}
              disabled={!shippingSettingsReady || shippingSaveLoading || shippingSynced}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-black disabled:opacity-50"
            >
              {shippingSaveLoading ? (
                <span>Enregistrement…</span>
              ) : shippingSynced ? (
                <>
                  <CheckCircle2 size={16} aria-hidden />
                  À jour
                </>
              ) : (
                <>
                  <Save size={16} aria-hidden />
                  Enregistrer
                </>
              )}
            </button>
          </div>

          {shippingSettingsReady && savedShipping !== null ? (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                shippingSynced
                  ? 'border-emerald-200 bg-emerald-50/60 text-emerald-950'
                  : 'border-neutral-200 bg-neutral-50/80 text-neutral-800'
              }`}
              role="status"
            >
              <p className="font-semibold text-neutral-900">
                {shippingSynced ? (
                  <>Configuration enregistrée en base</>
                ) : (
                  <>Dernière configuration enregistrée</>
                )}
              </p>
              <ul className="mt-2 space-y-1 text-neutral-700">
                <li className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-neutral-600">Frais par défaut enregistrés</span>
                  <span className="tabular-nums font-bold text-neutral-950">
                    {formatCurrencyAmount(savedShipping.fee, { maximumFractionDigits: 2 })}
                  </span>
                </li>
                <li className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-neutral-600">Facturation livraison</span>
                  <span className="font-medium text-neutral-950">
                    {savedShipping.enabled ? 'Activée' : 'Désactivée'}
                  </span>
                </li>
              </ul>
              {!shippingSynced ? (
                <p className="mt-2 border-t border-neutral-200/80 pt-2 text-xs text-neutral-600">
                  Brouillon :{' '}
                  <span className="font-semibold text-neutral-900">
                    {formatCurrencyAmount(shippingFeeDraft, { maximumFractionDigits: 2 })}
                  </span>{' '}
                  · livraison {shippingEnabled ? 'activée' : 'désactivée'} — enregistrez pour appliquer.
                </p>
              ) : (
                <p className="mt-2 text-xs text-emerald-900/80">
                  Ce montant est proposé par défaut dans « Achat rapide » sur la boutique.
                </p>
              )}
            </div>
          ) : null}

          <div className="mt-6 grid gap-6 border-t border-neutral-100 pt-6 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
              <input
                type="checkbox"
                checked={shippingEnabled}
                onChange={(e) => setShippingEnabled(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-neutral-300 text-neutral-900"
              />
              <span>
                <span className="block text-sm font-semibold text-neutral-900">
                  Facturer les frais de livraison
                </span>
                <span className="mt-0.5 block text-xs text-neutral-500">
                  Désactivé : aucun montant livraison sur le formulaire client (total = sous-total produits).
                </span>
              </span>
            </label>

            <div>
              <label htmlFor="admin-default-shipping" className="block text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Frais par défaut ({CURRENCY.code})
              </label>
              <input
                id="admin-default-shipping"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                disabled={!shippingEnabled}
                value={defaultShippingFee}
                onChange={(e) => setDefaultShippingFee(e.target.value)}
                className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-100"
              />
              <p className="mt-1.5 text-xs text-neutral-500">
                Prérempli dans « Achat rapide » ; le client peut modifier le montant.
              </p>
            </div>
          </div>
        </section>

        <section aria-label="Aperçu du catalogue">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            Aperçu
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
            <div className="group flex h-[5.5rem] flex-col justify-center rounded-2xl border border-neutral-200/90 border-l-4 border-l-neutral-400 bg-white px-3.5 text-left shadow-sm">
              <span className="tabular-nums text-2xl font-bold tracking-tight text-neutral-950">{totalCount}</span>
              <span className="mt-1.5 text-xs font-semibold leading-snug text-neutral-600">Total</span>
            </div>
            <div className="group flex h-[5.5rem] flex-col justify-center rounded-2xl border border-neutral-200/90 border-l-4 border-l-green-500 bg-white px-3.5 text-left shadow-sm">
              <span className="tabular-nums text-2xl font-bold tracking-tight text-neutral-950">{activeCount}</span>
              <span className="mt-1.5 text-xs font-semibold leading-snug text-neutral-600">Actifs</span>
            </div>
            <div className="group flex h-[5.5rem] flex-col justify-center rounded-2xl border border-neutral-200/90 border-l-4 border-l-neutral-600 bg-neutral-50 px-3.5 text-left shadow-sm">
              <span className="tabular-nums text-2xl font-bold tracking-tight text-neutral-950">{inactiveCount}</span>
              <span className="mt-1.5 text-xs font-semibold leading-snug text-neutral-600">Inactifs</span>
            </div>
            <div className="group flex h-[5.5rem] flex-col justify-center rounded-2xl border border-rose-200 border-l-4 border-l-rose-500 bg-rose-50/50 px-3.5 text-left shadow-sm">
              <span className="tabular-nums text-2xl font-bold tracking-tight text-neutral-950">{promoCount}</span>
              <span className="mt-1.5 text-xs font-semibold leading-snug text-rose-900">En Promotion</span>
            </div>
          </div>
        </section>

        {/* Filtres */}
        <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm sm:p-6" aria-label="Recherche et filtres">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(140px,0.5fr)_minmax(140px,0.5fr)_minmax(140px,0.5fr)_minmax(140px,0.5fr)_auto] lg:gap-x-6 lg:gap-y-2">
            
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 lg:row-start-1 lg:col-start-1">Recherche</label>
            <div className="relative min-w-0 lg:row-start-2 lg:col-start-1">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" strokeWidth={1.75} />
              <input 
                type="text"
                placeholder="Rechercher par nom..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>
            
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 lg:row-start-1 lg:col-start-2">Catégorie</label>
            <select 
              value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 lg:row-start-2 lg:col-start-2"
            >
              <option value="tous">Toutes</option>
              <option value="chaussures">Chaussures</option>
              <option value="sandales">Sandales</option>
            </select>

            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 lg:row-start-1 lg:col-start-3">Genre</label>
            <select 
              value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 lg:row-start-2 lg:col-start-3"
            >
              <option value="tous">Tous</option>
              <option value="homme">Homme</option>
              <option value="femme">Femme</option>
              <option value="unisex">Unisex</option>
            </select>

            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 lg:row-start-1 lg:col-start-4">Statut</label>
            <select 
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 lg:row-start-2 lg:col-start-4"
            >
              <option value="tous">Tous</option>
              <option value="actifs">Actifs</option>
              <option value="inactifs">Inactifs</option>
            </select>

            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 lg:row-start-1 lg:col-start-5">Trier par</label>
            <select
              value={`${sortField}:${sortDirection}`}
              onChange={(e) => {
                const [field, direction] = e.target.value.split(':') as [SortField, 'asc' | 'desc'];
                setSortField(field);
                setSortDirection(direction);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 lg:row-start-2 lg:col-start-5"
            >
              <option value="created_at:desc">Plus récents</option>
              <option value="created_at:asc">Plus anciens</option>
              <option value="name:asc">Nom A-Z</option>
              <option value="name:desc">Nom Z-A</option>
              <option value="price:asc">Prix croissant</option>
              <option value="price:desc">Prix décroissant</option>
              <option value="is_active:desc">Actifs d'abord</option>
              <option value="is_active:asc">Inactifs d'abord</option>
            </select>

            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 lg:row-start-1 lg:col-start-6 lg:block">Actions</span>
            <button
              onClick={clearFilters}
              className="h-10 w-full rounded-lg border border-neutral-200 px-4 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 lg:row-start-2 lg:col-start-6 lg:w-auto lg:min-w-[9.5rem]"
            >
              Tout réinitialiser
            </button>
          </div>
        </section>

      {/* Erreur Toast/Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-800 rounded flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      {viewMode === 'table' ? (
        <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm" aria-label="Liste des produits">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/90">
                  <th className="px-5 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="w-4 h-4 text-blue-600 rounded border-neutral-300 focus:ring-blue-600"
                    />
                  </th>
                  <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500 w-16">Photo</th>
                  <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                    <button
                      onClick={() => toggleSort('name')}
                      className="inline-flex items-center gap-1.5 hover:text-neutral-800 transition-colors"
                    >
                      Nom
                      <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500 max-w-[14rem]">
                    Description
                  </th>
                  <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Catégorie</th>
                  <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Genre</th>
                  <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                    <button
                      onClick={() => toggleSort('price')}
                      className="inline-flex items-center gap-1.5 hover:text-neutral-800 transition-colors"
                    >
                      {`Prix ${CURRENCY.code}`}
                      <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Variants</th>
                  <th className="px-5 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                    <button
                      onClick={() => toggleSort('is_active')}
                      className="inline-flex items-center gap-1.5 hover:text-neutral-800 transition-colors"
                    >
                      Actif
                      <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th className="px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="px-5 py-4"><div className="w-4 h-4 bg-neutral-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="w-10 h-10 bg-neutral-200 rounded-md"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-neutral-200 rounded w-3/4"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-neutral-200 rounded w-full max-w-[10rem]"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-neutral-200 rounded w-1/2"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-neutral-200 rounded w-1/2"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-neutral-200 rounded w-1/2"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-neutral-200 rounded w-8"></div></td>
                      <td className="px-5 py-4"><div className="mx-auto h-8 w-[52px] rounded-full bg-neutral-200/90" aria-hidden /></td>
                      <td className="px-5 py-4"><div className="h-4 bg-neutral-200 rounded w-12 ml-auto"></div></td>
                    </tr>
                  ))
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-16 text-center text-neutral-500">
                      <PackageSearchIcon className="mx-auto h-12 w-12 text-neutral-300 mb-3" />
                      <p>Aucun produit trouvé avec ces critères.</p>
                    </td>
                  </tr>
                ) : (
                  products.map((product) => {
                    const firstImage = product.images?.[0];
                    const isActive = product.is_active !== false;
                    const isSelected = selectedIds.includes(product.id);
                    const descPreview = product.description?.trim() ?? '';

                    return (
                      <tr
                        key={product.id}
                        className={`border-l-4 transition-colors duration-150 hover:bg-neutral-50/90 ${!isActive ? 'border-l-neutral-300 opacity-60' : 'border-l-transparent'}`}
                      >
                        <td className={`px-5 ${rowPaddingClass}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectProduct(product.id)}
                            className="w-4 h-4 text-blue-600"
                          />
                        </td>
                        <td className={`px-5 ${rowPaddingClass}`}>
                          {firstImage ? (
                            <img src={firstImage} alt={product.name} className="w-10 h-10 object-cover rounded-md border border-neutral-200" />
                          ) : (
                            <div className="w-10 h-10 bg-neutral-100 rounded-md flex items-center justify-center border border-neutral-200">
                              <ImageIcon size={16} className="text-neutral-400" />
                            </div>
                          )}
                        </td>
                        <td className={`px-5 ${rowPaddingClass} font-medium text-neutral-900`}>
                          <div className="flex flex-col">
                            <span>{product.name}</span>
                            {product.has_promo && (
                              <span className="text-[10px] uppercase tracking-wider font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-sm w-fit mt-1">Promo Active</span>
                            )}
                          </div>
                        </td>
                        <td className={`px-5 ${rowPaddingClass} max-w-[14rem]`}>
                          {descPreview ? (
                            <p
                              className="line-clamp-2 text-xs text-neutral-600 leading-snug"
                              title={descPreview}
                            >
                              {descPreview}
                            </p>
                          ) : (
                            <span className="text-xs text-neutral-400">—</span>
                          )}
                        </td>
                        <td className={`px-5 ${rowPaddingClass} text-neutral-600 capitalize`}>{product.category}</td>
                        <td className={`px-5 ${rowPaddingClass} text-neutral-600 capitalize`}>{product.gender || '-'}</td>
                        <td className={`px-5 ${rowPaddingClass} font-medium text-neutral-900`}>
                          {product.price.toLocaleString('fr-DZ')}
                        </td>
                        <td className={`px-5 ${rowPaddingClass}`}>
                          <span className="inline-flex items-center justify-center bg-neutral-100 text-neutral-700 text-xs font-semibold px-2 py-1 rounded-full">
                            {product.variant_count}
                          </span>
                        </td>
                        <td className={`px-5 ${rowPaddingClass} text-center`}>
                          <div className="flex flex-col items-center gap-1">
                            <ProductActiveToggle
                              isActive={isActive}
                              productName={product.name}
                              onToggle={() => toggleActive(product.id, product.is_active ?? true)}
                            />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                              {isActive ? 'En ligne' : 'Hors ligne'}
                            </span>
                          </div>
                        </td>
                        <td className={`px-5 ${rowPaddingClass} text-right`}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingProduct(product);
                                setIsModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm transition hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
                              title="Modifier"
                            >
                              <Edit2 size={14} strokeWidth={2} /> Modifier
                            </button>
                            <button
                              onClick={() => handleDelete(product)}
                              className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && totalCount > itemsPerPage && (
            <div className="px-5 py-4 border-t border-neutral-200 flex items-center justify-between">
              <span className="text-sm text-neutral-500">
                Affichage de {((page - 1) * itemsPerPage) + 1} à {Math.min(page * itemsPerPage, totalCount)} sur {totalCount}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 border border-neutral-200 rounded hover:bg-neutral-50 disabled:opacity-50 transition-colors text-neutral-600"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm px-3 text-neutral-700 font-medium">Page {page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 border border-neutral-200 rounded hover:bg-neutral-50 disabled:opacity-50 transition-colors text-neutral-600"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="bg-white border border-neutral-200/90 rounded-2xl overflow-hidden animate-pulse shadow-sm">
              <div className="h-48 w-full bg-neutral-200" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-neutral-200 rounded w-3/4" />
                <div className="h-5 bg-neutral-200 rounded w-1/3" />
                <div className="h-4 bg-neutral-200 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 px-5 py-16 text-center text-neutral-500">
          <PackageSearchIcon className="mx-auto h-12 w-12 text-neutral-300 mb-3" />
          <p>Aucun produit trouvé avec ces critères.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => {
            const firstImage = product.images?.[0];
            const isActive = product.is_active !== false;
            return (
              <article
                key={product.id}
                className={`bg-white border border-neutral-200/90 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${!isActive ? 'grayscale opacity-60' : ''}`}
              >
                {firstImage ? (
                  <img src={firstImage} alt={product.name} className="h-48 w-full object-cover" />
                ) : (
                  <div className="h-48 w-full bg-neutral-100 flex items-center justify-center">
                    <ImageIcon size={22} className="text-neutral-400" />
                  </div>
                )}
                <div className="p-5 relative">
                  <h3 className="font-semibold text-neutral-900 truncate pr-16">{product.name}</h3>
                  {product.has_promo && (
                    <span className="absolute top-5 right-5 text-[10px] uppercase tracking-wider font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-sm">Promo</span>
                  )}
                  <p className="text-lg font-bold tracking-tight text-neutral-900 mt-1">
                    {formatCurrencyAmount(Number(product.price), { maximumFractionDigits: 0 })}
                  </p>
                  {product.description?.trim() ? (
                    <p
                      className="mt-2 line-clamp-2 text-xs leading-relaxed text-neutral-600"
                      title={product.description.trim()}
                    >
                      {product.description.trim()}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-700 capitalize">
                      {product.category}
                    </span>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 capitalize">
                      {product.gender || 'N/A'}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                        isActive ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <ProductActiveToggle
                        isActive={isActive}
                        productName={product.name}
                        onToggle={() => toggleActive(product.id, product.is_active ?? true)}
                      />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                        {isActive ? 'En ligne' : 'Hors ligne'}
                      </span>
                      <span className="inline-flex items-center justify-center rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
                        {product.variant_count} var.
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingProduct(product);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(product)}
                        className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {viewMode === 'table' && selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white shadow-xl rounded-full px-6 py-3 border border-neutral-200 z-40">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-neutral-800">
              {selectedIds.length} produits sélectionnés
            </span>
            <button
              onClick={() => handleBulkSetActive(true)}
              className="px-3 py-1.5 rounded-full bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors"
            >
              Activer tous
            </button>
            <button
              onClick={() => handleBulkSetActive(false)}
              className="px-3 py-1.5 rounded-full bg-neutral-500 hover:bg-neutral-600 text-white text-xs font-semibold transition-colors"
            >
              Désactiver tous
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-full border border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold transition-colors"
            >
              Annuler sélection
            </button>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {isModalOpen && (
        <ProductFormModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          product={editingProduct}
          onSuccess={() => {
            void fetchProducts();
            void refetchCatalogStore(true);
          }}
        />
      )}

      <ConfirmModal
        open={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer le produit"
        message={`Êtes-vous sûr de vouloir supprimer "${productToDelete?.name}" ?`}
        isDanger={true}
      />
      </div>
    </div>
  );
}

/** Interrupteur catalogue : cible ~44px de haut, états clairs, focus visible. */
function ProductActiveToggle({
  isActive,
  productName,
  onToggle,
}: {
  isActive: boolean;
  productName: string;
  onToggle: () => void;
}) {
  const safeName = productName.replace(/"/g, "'");
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      aria-label={
        isActive
          ? `Désactiver le produit « ${safeName} » (retirer du catalogue)`
          : `Activer le produit « ${safeName} » (mettre en ligne)`
      }
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={[
        'relative inline-flex h-8 w-[52px] shrink-0 cursor-pointer items-center rounded-full border transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F9FAFB]',
        isActive
          ? 'border-emerald-700/30 bg-emerald-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]'
          : 'border-neutral-300/90 bg-neutral-200/90 hover:border-neutral-400/80 hover:bg-neutral-300/80',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'pointer-events-none absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-md ring-1 ring-black/[0.06]',
          'transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform',
          isActive ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}

// Icon local helper since we didn't import PackageSearch
function PackageSearchIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14" />
      <path d="m7.5 4.27 9 5.15" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" x2="12" y1="22" y2="12" />
      <circle cx="18.5" cy="15.5" r="2.5" />
      <path d="M20.27 17.27 22 19" />
    </svg>
  );
}
