import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  Phone,
  User,
  Calendar,
  CreditCard,
  Tag,
  MessageCircle,
  Copy,
  Banknote,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CURRENCY, formatCurrencyAmount } from '../../lib/vocab';
import type { Order } from '../../types/order';
import { openWhatsAppQuickChat } from '../../services/notificationService';

import OrderStatusManager from './OrderStatusManager';
import StatusTimeline from './ui/StatusTimeline';
import { useToast } from './ui/Toast';
import type { OrderStatusHistory } from '../../types/stock';

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onStatusChange?: () => void | Promise<void>;
}

const MAIN_FLOW = [
  'nouveau',
  'confirmé',
  'en_preparation',
  'expédié',
  'livré',
] as const;

/** Étapes atteintes pour la frise (sans historique serveur : dérivé du statut courant). */
function completedStatusesForTimeline(status: string): string[] {
  const idx = MAIN_FLOW.indexOf(status as (typeof MAIN_FLOW)[number]);
  if (idx >= 0) return [...MAIN_FLOW.slice(0, idx + 1)];
  if (status === 'refusé') return ['nouveau'];
  if (status === 'annulé') return ['nouveau', 'confirmé'];
  if (status === 'retourné') return [...MAIN_FLOW];
  return [];
}

export default function OrderDetailModal({
  isOpen,
  onClose,
  order,
  onStatusChange,
}: OrderDetailModalProps) {
  const { showToast } = useToast();
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [statusHistory, setStatusHistory] = useState<OrderStatusHistory[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  useEffect(() => {
    if (order) setCurrentOrder(order);
  }, [order]);

  const refreshOrder = useCallback(async () => {
    const id = order?.id ?? currentOrder?.id;
    if (!id) return;

    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        *,
        order_items (
          quantity, price,
          variants (
            size, color,
            products ( name, images )
          )
        )
      `,
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.warn('refreshOrder:', error.message);
      return;
    }
    if (data) {
      setCurrentOrder(data as Order);
    }

    const [{ data: historyRows }, { data: paymentRows }] = await Promise.all([
      supabase
        .from('order_status_history')
        .select('id, order_id, old_status, new_status, reason, changed_at')
        .eq('order_id', id)
        .order('changed_at', { ascending: false }),
      supabase
        .from('payments')
        .select('id, amount, method, status, reference, paid_at')
        .eq('order_id', id)
        .order('paid_at', { ascending: false }),
    ]);

    setStatusHistory((historyRows || []) as OrderStatusHistory[]);
    setPaymentHistory(paymentRows || []);
  }, [order?.id, currentOrder?.id]);

  useEffect(() => {
    if (isOpen) {
      void refreshOrder();
    }
  }, [isOpen, refreshOrder]);

  const handleStatusChanged = useCallback(async () => {
    await refreshOrder();
    showToast('Statut mis à jour.', 'success');
    await Promise.resolve(onStatusChange?.());
  }, [refreshOrder, showToast, onStatusChange]);

  const handleCopyPhone = async () => {
    const phone = currentOrder?.phone;
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      showToast('Numéro copié.', 'success');
    } catch {
      showToast('Copie impossible.', 'error');
    }
  };

  const handleWhatsAppQuick = () => {
    const o = currentOrder;
    if (!o?.phone) return;
    const name = o.customer_name || 'Client';
    openWhatsAppQuickChat(
      o.phone,
      `Bonjour ${name}, concernant votre commande Chiraz — puis-je vous aider ?`,
    );
  };

  if (!isOpen) return null;

  const o = currentOrder ?? order;
  if (!o) return null;

  const orderDate = new Date(o.created_at).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const timelineCompleted = completedStatusesForTimeline(o.status);

  const canEncash = ['non_paye', 'partiellement_paye', 'en_retard', 'en_attente_encaissement'].includes(
    String(o.payment_status || 'non_paye'),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between bg-neutral-900 p-5 text-white">
          <div>
            <h2 className="flex items-center gap-3 font-serif text-xl">
              Commande #{o.order_number || o.id.slice(0, 8)}
              <span className="rounded bg-white/10 px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-wider">
                {o.status}
              </span>
            </h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-neutral-400">
              <Calendar size={14} /> {orderDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Timeline */}
        <div className="shrink-0 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
          <StatusTimeline
            currentStatus={o.status}
            completedStatuses={timelineCompleted}
          />
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-50 p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-neutral-900">
                  <User size={18} className="text-neutral-400" /> Informations
                  Client & Livraison
                </h3>
                <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-2">
                  <div className="space-y-3">
                    <p className="flex flex-col border-b border-neutral-100 pb-2">
                      <span className="mb-1 text-xs uppercase text-neutral-500">
                        Nom complet
                      </span>
                      <span className="font-medium text-neutral-900">
                        {o.customer_name}
                      </span>
                    </p>
                    <p className="flex flex-col border-b border-neutral-100 pb-2">
                      <span className="mb-1 flex items-center gap-1 text-xs uppercase text-neutral-500">
                        <Phone size={12} /> Téléphone
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-neutral-900">{o.phone}</span>
                        <button
                          type="button"
                          onClick={handleWhatsAppQuick}
                          className="rounded-lg p-2 text-green-600 transition hover:bg-green-50"
                          title="WhatsApp"
                          aria-label="Contacter sur WhatsApp"
                        >
                          <MessageCircle size={18} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCopyPhone()}
                          className="rounded-lg p-2 text-gray-400 transition hover:bg-neutral-100 hover:text-gray-600"
                          title="Copier le numéro"
                          aria-label="Copier le numéro"
                        >
                          <Copy size={16} strokeWidth={2} />
                        </button>
                      </span>
                    </p>
                    <p className="flex flex-col">
                      <span className="mb-1 text-xs uppercase text-neutral-500">Source</span>
                      <span className="font-medium capitalize text-neutral-900">
                        {o.source || 'Web'}
                      </span>
                    </p>
                  </div>
                  <div className="space-y-3">
                    <p className="flex flex-col border-b border-neutral-100 pb-2">
                      <span className="mb-1 text-xs uppercase text-neutral-500">
                        Wilaya / Commune
                      </span>
                      <span className="font-medium text-neutral-900">
                        {o.wilaya || '-'} / {o.commune || o.city}
                      </span>
                    </p>
                    <div className="pt-1">
                      <span className="mb-1 block text-xs uppercase text-neutral-500">
                        Adresse complète
                      </span>
                      <p className="rounded border border-neutral-100 bg-neutral-50 p-2 font-medium text-neutral-900">
                        {o.address || 'Aucune adresse précise.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {o.notes ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                  <h3 className="mb-2 font-semibold text-amber-900">Note du client</h3>
                  <p className="text-sm text-amber-800">{o.notes}</p>
                </div>
              ) : null}

              <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-neutral-900">
                  <Tag size={18} className="text-neutral-400" /> Articles (
                  {o.order_items?.length || 0})
                </h3>
                <div className="space-y-4">
                  {o.order_items?.map((item: any, idx: number) => {
                    const pName = item.variants?.products?.name || 'Produit Inconnu';
                    const pSize = item.variants?.size;
                    const pColor = item.variants?.color;

                    return (
                      <div
                        key={idx}
                        className="flex gap-4 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3"
                      >
                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-white">
                          {item.variants?.products?.images?.[0] ? (
                            <img
                              src={item.variants.products.images[0]}
                              alt={pName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Tag className="text-neutral-300" size={24} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate font-medium text-neutral-900">{pName}</h4>
                          <p className="mt-0.5 text-sm text-neutral-500">
                            Pointure: {pSize} • {pColor}
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="rounded border border-neutral-200 bg-white px-2 py-0.5 text-xs font-semibold">
                              Qté: {item.quantity}
                            </span>
                            <span className="font-medium text-neutral-900">
                              {formatCurrencyAmount(Number(item.price ?? 0), { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 font-semibold text-neutral-900">Historique des statuts</h3>
                <div className="space-y-2 text-sm">
                  {statusHistory.length === 0 ? (
                    <p className="text-neutral-500">Aucun changement enregistré.</p>
                  ) : (
                    statusHistory.map((h) => (
                      <div key={h.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                        <p className="font-medium text-neutral-900">
                          {h.old_status} → {h.new_status}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {new Date(h.changed_at).toLocaleString('fr-FR')}
                        </p>
                        {h.reason ? <p className="text-xs text-neutral-600">Raison: {h.reason}</p> : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 border-b border-neutral-100 pb-2 font-semibold text-neutral-900">
                  Gérer le statut
                </h3>
                <OrderStatusManager
                  order={o}
                  onStatusChange={handleStatusChanged}
                  compact={true}
                />
              </div>

              <div className="sticky top-6 rounded-xl bg-neutral-900 p-6 text-white shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-neutral-300">
                  <CreditCard size={18} /> Résumé Financier
                </h3>
                <div className="space-y-3 text-sm">
                  <p className="flex justify-between text-neutral-400">
                    <span>Statut paiement</span>
                    <span>{o.payment_status || 'non_paye'}</span>
                  </p>
                  <p className="flex justify-between text-neutral-400">
                    <span>Sous-total articles</span>
                    <span>{formatCurrencyAmount(Number(o.subtotal || o.total), { maximumFractionDigits: 0 })}</span>
                  </p>
                  <p className="flex justify-between border-b border-neutral-700 pb-3 text-neutral-400">
                    <span>Frais de livraison</span>
                    <span>
                      {o.delivery_cost
                        ? formatCurrencyAmount(Number(o.delivery_cost), { maximumFractionDigits: 0 })
                        : `0 ${CURRENCY.code}`}
                    </span>
                  </p>
                  <p className="flex items-center justify-between pt-2">
                    <span className="text-base font-medium">Total à payer</span>
                    <span className="text-2xl font-bold">
                      {formatCurrencyAmount(Number(o.total), { maximumFractionDigits: 0 })}
                    </span>
                  </p>
                  {canEncash && o.order_number ? (
                    <Link
                      to={`/admin/payments?orderRef=${encodeURIComponent(o.order_number)}`}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100"
                      onClick={() => onClose()}
                    >
                      <Banknote size={18} className="shrink-0" />
                      Encaisser cette commande
                    </Link>
                  ) : canEncash ? (
                    <Link
                      to="/admin/payments"
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/15"
                      onClick={() => onClose()}
                    >
                      <Banknote size={18} className="shrink-0" />
                      Ouvrir l’encaissement
                    </Link>
                  ) : null}
                </div>
                <div className="mt-4 border-t border-neutral-700 pt-4">
                  <p className="mb-2 text-xs uppercase text-neutral-400">Historique paiements</p>
                  <div className="max-h-48 space-y-2 overflow-auto text-xs">
                    {paymentHistory.length === 0 ? (
                      <p className="text-neutral-400">Aucun paiement.</p>
                    ) : (
                      paymentHistory.map((p) => (
                        <div key={p.id} className="rounded border border-neutral-700 bg-neutral-800 p-2">
                          <p className="font-medium text-white">
                            {formatCurrencyAmount(Number(p.amount || 0), { maximumFractionDigits: 0 })} - {p.method}
                          </p>
                          <p className="text-neutral-400">
                            {new Date(p.paid_at).toLocaleDateString('fr-FR')} - {p.status}
                          </p>
                          {p.reference ? <p className="text-neutral-400">Ref: {p.reference}</p> : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
