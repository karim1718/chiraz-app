import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { CURRENCY, formatCurrencyAmount as fmt } from '../../lib/vocab';
import { createDirectSale } from '../../services/orderService';
import { listCustomers } from '../../services/financeService';
import type { CustomerListItem } from '../../services/financeService';
import type { CustomerCategory } from '../../types/finance';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  Phone,
  ShoppingCart,
  Store,
  User,
  Plus,
} from 'lucide-react';

type VariantRow = {
  id: string;
  product_id: string;
  size: number;
  color: string | null;
  stock: number;
  price: number | null;
  products: { name: string; price: number | null } | null;
};

/** Vente magasin : uniquement B2B et Boutique (hors en ligne). */
type DirectSaleCategory = Extract<CustomerCategory, 'b2b' | 'boutique'>;

const inputClass =
  'h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 shadow-sm transition placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10';

const labelClass = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400';

const CATEGORY_OPTIONS: { value: DirectSaleCategory; label: string; short: string; Icon: typeof Store }[] = [
  { value: 'boutique', label: 'Boutique', short: 'Vente comptoir', Icon: Store },
  { value: 'b2b', label: 'B2B', short: 'Client professionnel', Icon: Briefcase },
];

export default function AdminDirectSales() {
  const navigate = useNavigate();
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(true);
  const [variantId, setVariantId] = useState('');
  const [qty, setQty] = useState(1);
  const [unitPriceInput, setUnitPriceInput] = useState(0);

  const [saleCategory, setSaleCategory] = useState<DirectSaleCategory>('boutique');
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [customerId, setCustomerId] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Magasin');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Commande créée : conservé pour navigation Encaissements (client + réf. CMD). */
  const [createdOrder, setCreatedOrder] = useState<{ orderNumber: string; customerId: string } | null>(null);

  const loadVariants = useCallback(async () => {
    setLoadingVariants(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from('variants')
        .select('id, product_id, size, color, stock, price, products(name, price)')
        .gt('stock', 0)
        .order('stock', { ascending: false });
      if (error) throw error;
      const rows: VariantRow[] = (data || []).map((row: Record<string, unknown>) => {
        const p = row.products;
        const single = Array.isArray(p) ? ((p[0] ?? null) as VariantRow['products']) : (p as VariantRow['products']);
        return {
          ...(row as Omit<VariantRow, 'products'>),
          products: single,
        };
      });
      setVariants(rows);
      setVariantId((prev) => (rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? ''));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Chargement impossible.';
      setErrorMessage(msg);
    } finally {
      setLoadingVariants(false);
    }
  }, []);

  useEffect(() => {
    void loadVariants();
  }, [loadVariants]);

  useEffect(() => {
    const sel = variants.find((v) => v.id === variantId);
    if (!sel) return;
    const def = Number(sel.price ?? sel.products?.price ?? 0);
    setUnitPriceInput(def);
  }, [variantId, variants]);

  useEffect(() => {
    let cancelled = false;
    const loadCustomers = async () => {
      setLoadingCustomers(true);
      setErrorMessage(null);
      try {
        const res = await listCustomers({ category: saleCategory, pageSize: 500 });
        if (cancelled) return;
        setCustomers(res.customers);
        const first = res.customers[0];
        if (first) {
          setCustomerId(first.id);
          setCustomerName(first.full_name);
          setPhone(first.phone);
          setCity(first.address?.trim() || 'Magasin');
        } else {
          setCustomerId('');
          setCustomerName('');
          setPhone('');
          setCity('Magasin');
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setErrorMessage(e instanceof Error ? e.message : 'Impossible de charger les clients.');
          setCustomers([]);
          setCustomerId('');
        }
      } finally {
        if (!cancelled) setLoadingCustomers(false);
      }
    };
    void loadCustomers();
    return () => {
      cancelled = true;
    };
  }, [saleCategory]);

  const selected = variants.find((v) => v.id === variantId) || null;
  const lineTotal = Math.max(0, Number(unitPriceInput) || 0) * qty;
  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;

  const applyCustomer = (id: string) => {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (c) {
      setCustomerName(c.full_name);
      setPhone(c.phone);
      setCity(c.address?.trim() || 'Magasin');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!customerId) {
      setErrorMessage('Sélectionnez un client dans la liste ou créez une fiche dans Clients.');
      return;
    }
    const unit = Number(unitPriceInput);
    if (!Number.isFinite(unit) || unit <= 0) {
      setErrorMessage('Indiquez un prix unitaire valide supérieur à 0.');
      return;
    }
    setIsSaving(true);
    setCreatedOrder(null);
    setErrorMessage(null);
    try {
      const orderId = await createDirectSale({
        productId: selected.product_id,
        selectedSize: selected.size,
        selectedColor: selected.color,
        fullName: customerName.trim() || selectedCustomer?.full_name || 'Client',
        phone: phone.trim() || selectedCustomer?.phone || '—',
        city: city.trim() || 'Magasin',
        price: lineTotal,
        quantity: qty,
        customerId,
      });
      const { data: ord } = await supabase.from('orders').select('order_number').eq('id', orderId).maybeSingle();
      const orderNumber = (ord?.order_number as string)?.trim();
      if (!orderNumber) {
        setErrorMessage(
          'Commande enregistrée, mais le numéro CMD n’a pas été renvoyé. Ouvrez Encaissements ou Commandes pour la retrouver.',
        );
        setQty(1);
        return;
      }
      setCreatedOrder({ orderNumber, customerId });
      setQty(1);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Erreur lors de la création de la vente.');
    } finally {
      setIsSaving(false);
    }
  };

  const goToPayments = () => {
    if (!createdOrder) return;
    const params = new URLSearchParams();
    params.set('customerId', createdOrder.customerId);
    params.set('orderRef', createdOrder.orderNumber);
    navigate(`/admin/payments?${params.toString()}`);
  };

  const startNewDirectSale = () => {
    setCreatedOrder(null);
    setErrorMessage(null);
    setQty(1);
    void loadVariants();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-full bg-[#F9FAFB] pb-10 font-sans text-neutral-900 antialiased">
      <div className="mx-auto max-w-[960px] space-y-8 px-5 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-4 border-b border-neutral-200/80 pb-8 sm:flex-row sm:items-start">
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-neutral-950">Vente directe</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
              Enregistrez une vente B2B ou boutique : la commande est créée <strong>livrée</strong>, liée au client CRM,
              avec statut comptable <strong>en attente d’encaissement</strong>, puis visible dans Encaissements.
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-neutral-200/90 bg-white shadow-sm text-neutral-700">
            <ShoppingCart className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </div>
        </header>

        {errorMessage && !loadingVariants ? (
          <div
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200/90 bg-red-50/90 p-4 text-sm text-red-900"
            role="alert"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" strokeWidth={1.75} />
            <p className="min-w-0 flex-1 font-medium">{errorMessage}</p>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-xs font-semibold text-red-800 hover:text-red-950"
            >
              Fermer
            </button>
          </div>
        ) : null}

        <section aria-label="Synthèse">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">En un coup d’œil</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="flex h-[5.5rem] flex-col justify-center rounded-2xl border border-neutral-200/90 border-l-4 border-l-neutral-400 bg-white px-3.5 shadow-sm">
              <span className="tabular-nums text-2xl font-bold tracking-tight text-neutral-950">
                {loadingVariants ? '—' : variants.length}
              </span>
              <span className="mt-1.5 text-xs font-semibold leading-snug text-neutral-600">Variantes en stock</span>
            </div>
            <div className="flex h-[5.5rem] flex-col justify-center rounded-2xl border border-neutral-200/90 border-l-4 border-l-sky-500 bg-white px-3.5 shadow-sm">
              <span className="tabular-nums text-2xl font-bold tracking-tight text-neutral-950">
                {loadingCustomers ? '—' : customers.length}
              </span>
              <span className="mt-1.5 text-xs font-semibold leading-snug text-neutral-600">
                Clients {saleCategory === 'b2b' ? 'B2B' : 'Boutique'}
              </span>
            </div>
            <div className="flex h-[5.5rem] flex-col justify-center rounded-2xl border border-neutral-200/90 border-l-4 border-l-neutral-900 bg-neutral-50 px-3.5 shadow-sm">
              <span className="tabular-nums text-2xl font-bold tracking-tight text-neutral-950">
                {selected ? fmt(lineTotal) : '—'}
              </span>
              <span className="mt-1.5 text-xs font-semibold leading-snug text-neutral-600">Total de la vente</span>
            </div>
          </div>
        </section>

        <section
          className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm sm:p-6"
          aria-label="Formulaire vente directe"
        >
          {loadingVariants ? (
            <div className="flex items-center justify-center gap-3 py-16 text-sm text-neutral-500">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-400" strokeWidth={1.75} />
              Chargement des variantes…
            </div>
          ) : variants.length === 0 ? (
            errorMessage ? (
              <p className="py-10 text-center text-sm text-neutral-600">
                Les variantes n’ont pas pu être chargées. Corrigez l’erreur ci-dessus puis actualisez la page.
              </p>
            ) : (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <Package className="h-10 w-10 text-neutral-300" strokeWidth={1.5} />
                <p className="text-sm font-medium text-neutral-700">Aucune variante avec stock disponible</p>
                <p className="max-w-md text-xs text-neutral-500">
                  Réapprovisionnez le stock ou vérifiez les produits dans l’onglet Produits.
                </p>
              </div>
            )
          ) : (
            <form
              className={['space-y-8', createdOrder ? 'pointer-events-none opacity-60' : ''].filter(Boolean).join(' ')}
              onSubmit={handleSave}
              aria-busy={Boolean(createdOrder)}
            >
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Type de client</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {CATEGORY_OPTIONS.map(({ value, label, short, Icon }) => {
                    const active = saleCategory === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSaleCategory(value)}
                        className={[
                          'flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition',
                          active
                            ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm'
                            : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50',
                        ].join(' ')}
                      >
                        <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-neutral-500'}`} strokeWidth={1.75} />
                        <span>
                          <span className="block text-sm font-semibold">{label}</span>
                          <span className={`mt-0.5 block text-xs ${active ? 'text-white/75' : 'text-neutral-500'}`}>{short}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-8">
                <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-950">
                  <User className="h-4 w-4 text-neutral-500" strokeWidth={1.75} />
                  Fiche client ({saleCategory === 'b2b' ? 'B2B' : 'Boutique'})
                </p>
                {loadingCustomers ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-neutral-500">
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                    Chargement des clients…
                  </div>
                ) : customers.length === 0 ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                    Aucun client {saleCategory === 'b2b' ? 'B2B' : 'Boutique'} en base. Créez une fiche dans{' '}
                    <strong>Clients</strong> puis rechargez cette page.
                  </p>
                ) : (
                  <div className="mb-5">
                    <label htmlFor="direct-customer" className={labelClass}>
                      Client rattaché à la commande
                    </label>
                    <select
                      id="direct-customer"
                      value={customerId}
                      onChange={(e) => applyCustomer(e.target.value)}
                      className={inputClass}
                    >
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name} · {c.phone}
                          {c.customer_ref ? ` · ${c.customer_ref}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="direct-name" className={labelClass}>
                      Nom sur la commande
                    </label>
                    <input
                      id="direct-name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nom affiché"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="direct-phone" className={labelClass}>
                      Téléphone
                    </label>
                    <div className="relative">
                      <Phone
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <input
                        id="direct-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Téléphone"
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="direct-city" className={labelClass}>
                      Point de vente / ville
                    </label>
                    <div className="relative">
                      <MapPin
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <input
                        id="direct-city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Magasin, adresse…"
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-8">
                <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-950">
                  <Package className="h-4 w-4 text-neutral-500" strokeWidth={1.75} />
                  Article
                </p>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="direct-variant" className={labelClass}>
                      Produit et variante
                    </label>
                    <select
                      id="direct-variant"
                      value={variantId}
                      onChange={(e) => setVariantId(e.target.value)}
                      className={inputClass}
                    >
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.products?.name ?? 'Produit'} — Taille {v.size}
                          {v.color ? ` · ${v.color}` : ''} · Stock {v.stock}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="direct-qty" className={labelClass}>
                      Quantité
                    </label>
                    <input
                      id="direct-qty"
                      type="number"
                      min={1}
                      max={selected ? selected.stock : undefined}
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="direct-unit" className={labelClass}>
                      {`Prix unitaire (${CURRENCY.code})`}
                    </label>
                    <input
                      id="direct-unit"
                      type="number"
                      min={0}
                      step="0.01"
                      value={Number.isFinite(unitPriceInput) ? unitPriceInput : ''}
                      onChange={(e) => setUnitPriceInput(Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 px-5 py-4 text-white shadow-inner">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">Montant à encaisser</p>
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{fmt(lineTotal)}</p>
                <p className="mt-1 text-xs text-white/65">
                  {qty} × {fmt(Number(unitPriceInput) || 0)}
                  {selected ? ` · max. ${selected.stock} unité(s)` : ''}
                </p>
              </div>

              <div className="border-t border-neutral-100 pt-6">
                {createdOrder ? (
                  <div
                    className="pointer-events-auto flex flex-col gap-4 rounded-2xl border border-emerald-200/90 bg-emerald-50/90 p-4 text-sm text-emerald-950 opacity-100 sm:flex-row sm:items-start"
                    role="status"
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 max-sm:mt-0.5" strokeWidth={1.75} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium leading-relaxed">
                        Commande{' '}
                        <strong className="font-semibold text-emerald-950 tabular-nums">{createdOrder.orderNumber}</strong>{' '}
                        créée : statut <strong>livré</strong>, en attente d’encaissement. Enregistrez le paiement dans
                        Encaissements pour cette commande.
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                      <button
                        type="button"
                        onClick={goToPayments}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 text-xs font-semibold text-white shadow-sm hover:bg-emerald-950"
                      >
                        Ouvrir Encaissements
                      </button>
                      <button
                        type="button"
                        onClick={startNewDirectSale}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300/90 bg-white px-4 text-xs font-semibold text-emerald-900 shadow-sm hover:bg-emerald-100/40"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                        Nouvelle vente directe
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="submit"
                      disabled={isSaving || !selected || !customerId || customers.length === 0}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-black disabled:pointer-events-none disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : null}
                      {isSaving ? 'Enregistrement…' : 'Créer la commande (à encaisser)'}
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
