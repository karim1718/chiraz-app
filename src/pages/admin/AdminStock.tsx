import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCurrencyAmount } from '../../lib/vocab';
import {
  adminJoinProductStub,
  normalizeHex,
  getPrimaryImageForColor,
} from '../../utils/productColorAssets';
import { getHexForColor } from '../../utils/colorMap';
import { Loader2, AlertTriangle, Package, Activity, Boxes, AlertCircle, Plus, Minus, History, Tag } from 'lucide-react';
import StockUpdateModal from '../../components/admin/StockUpdateModal';
import StockHistoryModal from '../../components/admin/StockHistoryModal';
import VariantPriceModal from '../../components/admin/VariantPriceModal';

export default function AdminStock() {
  const [variants, setVariants] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [selectedProductId, setSelectedProductId] = useState<string>('tous');
  const [selectedSize, setSelectedSize] = useState<string>('toutes');
  const [selectedStatus, setSelectedStatus] = useState<string>('tous'); // 'tous', 'disponible', 'epuise', 'alerte'

  // Modals state
  const [updateModalVariant, setUpdateModalVariant] = useState<any>(null);
  const [updateModalType, setUpdateModalType] = useState<'entrée' | 'sortie' | null>(null);
  
  const [historyModalVariant, setHistoryModalVariant] = useState<any>(null);
  const [priceModalVariant, setPriceModalVariant] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch tous les produits actifs pour le filtre
      const { data: prods, error: prodsError } = await supabase
        .from('products')
        .select('id, name, is_active');
      if (prodsError) throw prodsError;
      setProducts(prods || []);

      // 2. Fetch tous les variants avec info produit
      const { data: vars, error: varsError } = await supabase
        .from('variants')
        .select(`
          id, size, color, stock, low_stock_alert, product_id, color_hex, price, original_price,
          products ( id, name, images, color_media, is_active, price )
        `)
        .order('stock', { ascending: true });
      if (varsError) throw varsError;
      setVariants(vars || []);
    } catch (err: any) {
      console.error("Erreur chargement données stock:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- STATISTIQUES ---
  const stats = useMemo(() => {
    const totalPaires = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    const activeProductsCount = products.filter(p => p.is_active).length;
    const exhaustedCount = variants.filter(v => v.stock === 0).length;
    const alertCount = variants.filter(v => v.stock > 0 && v.stock <= (v.low_stock_alert || 3)).length;
    return { totalPaires, activeProductsCount, exhaustedCount, alertCount };
  }, [variants, products]);

  // --- ALERTES ---
  const alertVariants = useMemo(() => {
    return variants.filter(v => v.stock <= (v.low_stock_alert || 3)).sort((a,b) => a.stock - b.stock);
  }, [variants]);

  // --- FILTRES TABLEAU PRINCIPAL ---
  const filteredVariants = useMemo(() => {
    return variants.filter(v => {
      // Produit
      if (selectedProductId !== 'tous' && v.product_id !== selectedProductId) return false;
      // Pointure
      if (selectedSize !== 'toutes' && v.size?.toString() !== selectedSize) return false;
      // Statut
      if (selectedStatus === 'disponible' && v.stock <= 0) return false;
      if (selectedStatus === 'epuise' && v.stock !== 0) return false;
      if (selectedStatus === 'alerte' && (v.stock === 0 || v.stock > (v.low_stock_alert || 3))) return false;
      
      return true;
    });
  }, [variants, selectedProductId, selectedSize, selectedStatus]);

  // Liste des pointures uniques pour le filtre
  const uniqueSizes = useMemo(() => {
    const sizes = new Set(variants.map(v => v.size?.toString()).filter(Boolean));
    return Array.from(sizes).sort((a, b) => Number(a) - Number(b));
  }, [variants]);

  return (
    <div className="min-h-full bg-[#F9FAFB] pb-10 font-sans text-neutral-900 antialiased">
      <div className="mx-auto max-w-[1600px] space-y-8 px-5 py-8 sm:px-6 lg:px-8">
        
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-neutral-950">Gestion du Stock</h1>
            <p className="mt-1 text-sm text-neutral-500">Gérez vos niveaux d'inventaire, les réapprovisionnements et les promotions.</p>
          </div>
        </div>

        {/* --- 4 CARDS STATS --- */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-neutral-200">
            <div className="absolute left-0 top-0 h-full w-1 bg-blue-500" />
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Boxes size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Total en stock</p>
                <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-neutral-900">{loading ? '-' : stats.totalPaires}</p>
              </div>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-neutral-200">
            <div className="absolute left-0 top-0 h-full w-1 bg-indigo-500" />
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Package size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Produits actifs</p>
                <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-neutral-900">{loading ? '-' : stats.activeProductsCount}</p>
              </div>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-neutral-200">
            <div className="absolute left-0 top-0 h-full w-1 bg-red-500" />
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Épuisés (0)</p>
                <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-neutral-900">{loading ? '-' : stats.exhaustedCount}</p>
              </div>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-neutral-200">
            <div className="absolute left-0 top-0 h-full w-1 bg-orange-500" />
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Activity size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-neutral-500">En alerte (≤ Seuil)</p>
                <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-neutral-900">{loading ? '-' : stats.alertCount}</p>
              </div>
            </div>
          </div>
        </div>

      {/* --- BLOC ALERTES --- */}
      {!loading && alertVariants.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-amber-100/50 px-5 py-3 border-b border-amber-200 flex items-center gap-3">
            <AlertCircle className="text-amber-600" size={20} />
            <h3 className="font-bold text-amber-900">⚠️ {alertVariants.length} référence(s) en stock critique ou épuisé</h3>
          </div>
          <div className="p-1">
            <div className="overflow-x-auto max-h-60 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="bg-amber-50/50 text-amber-800 font-medium sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="px-4 py-2">Produit</th>
                    <th className="px-4 py-2">Pointure</th>
                    <th className="px-4 py-2">Couleur</th>
                    <th className="px-4 py-2 text-center">Stock</th>
                    <th className="px-4 py-2 text-center">Seuil</th>
                    <th className="px-4 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200/50">
                  {alertVariants.map(v => (
                    <tr key={v.id} className="hover:bg-amber-100/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-amber-900">{v.products?.name || 'Inconnu'}</td>
                      <td className="px-4 py-2.5 text-amber-800">{v.size}</td>
                      <td className="px-4 py-2.5 text-amber-800">{v.color}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`font-bold ${v.stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                          {v.stock}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-amber-700/70">{v.low_stock_alert || 3}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button 
                          onClick={() => { setUpdateModalVariant(v); setUpdateModalType('entrée'); }}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-md transition-colors"
                        >
                          Réapprovisionner
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TABLEAU PRINCIPAL & FILTRES --- */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-5">
        
        {/* Filters */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              Produit
            </label>
            <select 
              value={selectedProductId} 
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none transition-shadow focus:border-black focus:ring-2 focus:ring-black/5"
            >
              <option value="tous">Tous les produits</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              Pointure
            </label>
            <select 
              value={selectedSize} 
              onChange={(e) => setSelectedSize(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none transition-shadow focus:border-black focus:ring-2 focus:ring-black/5"
            >
              <option value="toutes">Pointure: Toutes</option>
              {uniqueSizes.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              Statut
            </label>
            <select 
              value={selectedStatus} 
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none transition-shadow focus:border-black focus:ring-2 focus:ring-black/5"
            >
              <option value="tous">État: Tous</option>
              <option value="disponible">Disponible (&gt;0)</option>
              <option value="alerte">En alerte (≤seuil)</option>
              <option value="epuise">Épuisé (=0)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              <tr>
                <th className="px-5 py-4">Produit</th>
                <th className="px-5 py-4">Pointure</th>
                <th className="px-5 py-4">Couleur</th>
                <th className="px-5 py-4">Prix / Promo</th>
                <th className="px-5 py-4 text-center">Stock actuel</th>
                <th className="px-5 py-4 text-center">Seuil alerte</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-neutral-400" /></td></tr>
              ) : filteredVariants.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-neutral-500">Aucun variant ne correspond à ces filtres.</td></tr>
              ) : (
                filteredVariants.map((item) => {
                  const isOutOfStock = item.stock === 0;
                  const isLowStock = item.stock > 0 && item.stock <= (item.low_stock_alert || 3);
                  const pName = item.products?.name || "Produit inconnu";
                  const thumbUrl = item.products?.id
                    ? getPrimaryImageForColor(
                        adminJoinProductStub(item.products),
                        item.color ?? undefined,
                      )
                    : undefined;
                  const colorDotHex = item.color_hex
                    ? normalizeHex(item.color_hex)
                    : getHexForColor(item.color || '');

                  return (
                    <tr key={item.id} className="hover:bg-neutral-50 transition-colors group">
                      <td className="px-5 py-4 font-medium text-neutral-900">
                        <div className="flex items-center gap-3">
                          {thumbUrl ? (
                            <img src={thumbUrl} alt={pName} className="w-10 h-10 rounded-lg border border-neutral-200 object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg border border-neutral-200 bg-neutral-100" />
                          )}
                          <span className="truncate max-w-[200px]">{pName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-neutral-700 font-medium">{item.size}</td>
                      <td className="px-5 py-4 text-neutral-600">
                        <div className="flex items-center gap-2">
                          <span className="h-4 w-4 shrink-0 rounded-md border border-neutral-300 shadow-sm" style={{ backgroundColor: colorDotHex }} title={colorDotHex} />
                          {item.color}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-neutral-900">
                            {formatCurrencyAmount(Number(item.price ? item.price : item.products?.price ?? 0), {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                          {item.original_price && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-neutral-400 line-through">
                                {formatCurrencyAmount(Number(item.original_price), { maximumFractionDigits: 0 })}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold uppercase tracking-wider">Promo</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center justify-center font-bold text-sm px-2.5 py-1 rounded-full border ${
                          isOutOfStock ? 'bg-red-50 text-red-700 border-red-200' :
                          isLowStock ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          'bg-green-50 text-green-700 border-green-200'
                        }`}>
                          {item.stock}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center text-neutral-500 font-medium">{item.low_stock_alert || 3}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setPriceModalVariant(item); }}
                            className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg border border-rose-200 hover:border-rose-600 transition-colors"
                            title="Modifier Prix / Promo"
                          >
                            <Tag size={16} />
                          </button>
                          <div className="w-px h-6 bg-neutral-200 mx-1"></div>
                          <button 
                            onClick={() => { setUpdateModalVariant(item); setUpdateModalType('entrée'); }}
                            className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg border border-emerald-200 hover:border-emerald-600 transition-colors"
                            title="Entrée de stock"
                          >
                            <Plus size={16} />
                          </button>
                          <button 
                            onClick={() => { setUpdateModalVariant(item); setUpdateModalType('sortie'); }}
                            className="p-1.5 bg-orange-50 text-orange-700 hover:bg-orange-600 hover:text-white rounded-lg border border-orange-200 hover:border-orange-600 transition-colors"
                            title="Sortie de stock"
                          >
                            <Minus size={16} />
                          </button>
                          <div className="w-px h-6 bg-neutral-200 mx-1"></div>
                          <button 
                            onClick={() => setHistoryModalVariant(item)}
                            className="p-1.5 bg-neutral-100 text-neutral-600 hover:bg-black hover:text-white rounded-lg border border-neutral-200 hover:border-black transition-colors"
                            title="Voir l'historique"
                          >
                            <History size={16} />
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
      </div>

      {/* Modales */}
      <StockUpdateModal 
        isOpen={!!updateModalVariant} 
        onClose={() => { setUpdateModalVariant(null); setUpdateModalType(null); }} 
        onSuccess={fetchData} 
        variant={updateModalVariant} 
        type={updateModalType} 
      />

      <StockHistoryModal 
        isOpen={!!historyModalVariant} 
        onClose={() => setHistoryModalVariant(null)} 
        variant={historyModalVariant} 
      />

      <VariantPriceModal
        isOpen={!!priceModalVariant}
        onClose={() => setPriceModalVariant(null)}
        onSuccess={fetchData}
        variant={priceModalVariant}
      />

    </div>
  </div>
  );
}
