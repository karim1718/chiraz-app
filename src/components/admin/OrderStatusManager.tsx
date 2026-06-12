import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { updateOrderStatus } from '../../services/orderService';
import {
  getOrderWhatsAppUrl,
  openWhatsApp,
  orderHasWhatsAppablePhone,
} from '../../services/notificationService';
import { Check, X as XIcon, Package, Truck, RefreshCcw, Loader2, Info } from 'lucide-react';
import type { Order } from '../../types/order';

interface OrderStatusManagerProps {
  order: Order;
  onStatusChange?: () => void | Promise<void>;
  /** Si le composant est utilisé dans un tableau (petit format) ou dans la modale (grand format) */
  compact?: boolean;
}

export default function OrderStatusManager({
  order,
  onStatusChange,
  compact = false,
}: OrderStatusManagerProps) {
  const notifyParent = async () => {
    await Promise.resolve(onStatusChange?.());
  };
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Modals state
  const [activeModal, setActiveModal] = useState<'refusal' | 'cancel' | 'ship' | 'return' | null>(null);
  
  // Forms state
  const [refusalReasonType, setRefusalReasonType] = useState('Faux numéro');
  const [customReason, setCustomReason] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const handleUpdate = async (newStatus: string, reason?: string, actionName?: string, waStatus?: string) => {
    setLoadingAction(actionName || newStatus);
    /** Onglet réservé au clic (avant await) pour contourner le blocage des popups. */
    const waTab =
      waStatus && orderHasWhatsAppablePhone(order) ? window.open('about:blank', '_blank') : null;
    try {
      const result = await updateOrderStatus(order.id, newStatus, reason);

      if (waStatus) {
        const merged = { ...order, ...result.order };
        const url = getOrderWhatsAppUrl(merged, waStatus);
        if (url && waTab) {
          waTab.location.href = url;
        } else {
          waTab?.close();
          if (url) openWhatsApp(merged, waStatus);
        }
      } else {
        waTab?.close();
      }

      await notifyParent();
      setActiveModal(null);
      // Reset forms
      setCustomReason('');
      setTrackingNumber('');
    } catch (error: any) {
      waTab?.close();
      alert(error.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleShip = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction('expédié');
    const waTab = orderHasWhatsAppablePhone(order) ? window.open('about:blank', '_blank') : null;
    try {
      if (trackingNumber.trim()) {
        await supabase.from('orders').update({ tracking_number: trackingNumber.trim() }).eq('id', order.id);
      }
      await updateOrderStatus(order.id, 'expédié');
      const merged = {
        ...order,
        tracking_number: trackingNumber.trim() || order.tracking_number,
      };
      const tracking = trackingNumber.trim() || undefined;
      const url = getOrderWhatsAppUrl(merged, 'expédié', { tracking });
      if (url && waTab) {
        waTab.location.href = url;
      } else {
        waTab?.close();
        if (url) openWhatsApp(merged, 'expédié', { tracking });
      }
      await notifyParent();
      setActiveModal(null);
      setTrackingNumber('');
    } catch (error: any) {
      waTab?.close();
      alert(error.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // Render Functions
  const renderActions = () => {
    if (order.status === 'nouveau') {
      return (
        <>
          <button 
            onClick={() => handleUpdate('confirmé', undefined, 'confirmer', 'confirmé')}
            disabled={!!loadingAction}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loadingAction === 'confirmer' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Confirmer
          </button>
          <button 
            onClick={() => setActiveModal('refusal')}
            disabled={!!loadingAction}
            className="flex items-center gap-2 px-4 py-2 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Refuser
          </button>
        </>
      );
    }

    if (order.status === 'confirmé') {
      return (
        <>
          <button 
            onClick={() => handleUpdate('en_preparation', undefined, 'preparer')}
            disabled={!!loadingAction}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loadingAction === 'preparer' ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
            Mettre en préparation
          </button>
          <button 
            onClick={() => setActiveModal('cancel')}
            disabled={!!loadingAction}
            className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
        </>
      );
    }

    if (order.status === 'en_preparation') {
      return (
        <>
          <button 
            onClick={() => setActiveModal('ship')}
            disabled={!!loadingAction}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loadingAction === 'expédié' ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
            Marquer expédié
          </button>
          <button 
            onClick={() => setActiveModal('cancel')}
            disabled={!!loadingAction}
            className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
        </>
      );
    }

    if (order.status === 'expédié') {
      return (
        <>
          <button 
            onClick={() => handleUpdate('livré', undefined, 'livrer')}
            disabled={!!loadingAction}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loadingAction === 'livrer' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Confirmer livraison
          </button>
          <button 
            onClick={() => setActiveModal('return')}
            disabled={!!loadingAction}
            className="flex items-center gap-2 px-4 py-2 border border-sky-200 text-sky-700 hover:bg-sky-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCcw size={16} /> Retour produit
          </button>
        </>
      );
    }

    if (order.status === 'livré') {
      return (
        <>
          <div className="flex items-center gap-2 text-green-700 font-semibold text-sm px-2">
            <Check size={16} /> Commande livrée
          </div>
          <button 
            onClick={() => setActiveModal('return')}
            disabled={!!loadingAction}
            className="flex items-center gap-2 px-3 py-1.5 border border-neutral-200 text-neutral-600 hover:bg-neutral-50 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ml-4"
          >
            Enregistrer un retour
          </button>
        </>
      );
    }

    if (['annulé', 'refusé', 'retourné'].includes(order.status)) {
      return (
        <div className="flex flex-col">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-200 text-neutral-700 rounded-full text-xs font-bold uppercase tracking-wider w-fit">
            Clôturée
          </span>
          <span className="text-xs text-neutral-500 italic mt-1 flex items-center gap-1">
            <Info size={12} /> Motif : {order.cancel_reason || order.refusal_reason || 'Restauration de stock effectuée'}
          </span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`flex ${compact ? 'flex-col gap-2' : 'flex-wrap items-center gap-3'}`}>
      {renderActions()}

      {/* --- MODALS --- */}
      {activeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-xl flex flex-col overflow-hidden">
            
            {activeModal === 'refusal' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                const finalReason = refusalReasonType === 'Autre' ? customReason : refusalReasonType;
                if (!finalReason) return alert("Veuillez préciser le motif.");
                handleUpdate('refusé', finalReason, 'refuser', 'refusé');
              }}>
                <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
                  <h3 className="font-bold text-neutral-900">Refuser la commande</h3>
                  <button type="button" onClick={() => setActiveModal(null)} className="text-neutral-400 hover:text-black"><XIcon size={18}/></button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Motif du refus</label>
                    <select 
                      value={refusalReasonType} 
                      onChange={e => setRefusalReasonType(e.target.value)}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-black"
                    >
                      <option>Faux numéro</option>
                      <option>Zone non desservie</option>
                      <option>Doublon</option>
                      <option>Prix refusé</option>
                      <option>Autre</option>
                    </select>
                  </div>
                  {refusalReasonType === 'Autre' && (
                    <div>
                      <textarea 
                        required
                        value={customReason}
                        onChange={e => setCustomReason(e.target.value)}
                        placeholder="Précisez la raison..."
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-black min-h-[80px]"
                      />
                    </div>
                  )}
                  <p className="text-xs text-neutral-500 italic">Le stock sera automatiquement restauré et le client sera notifié sur WhatsApp.</p>
                </div>
                <div className="p-4 bg-neutral-50 flex justify-end gap-2">
                  <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200 rounded-lg">Annuler</button>
                  <button type="submit" disabled={!!loadingAction} className="px-4 py-2 text-sm font-medium text-white bg-black hover:bg-neutral-800 rounded-lg flex items-center gap-2">
                    {loadingAction && <Loader2 size={16} className="animate-spin" />} Confirmer le refus
                  </button>
                </div>
              </form>
            )}

            {activeModal === 'cancel' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                handleUpdate('annulé', customReason, 'annuler', 'annulé');
              }}>
                <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-red-50 text-red-900">
                  <h3 className="font-bold">Annuler la commande</h3>
                  <button type="button" onClick={() => setActiveModal(null)} className="text-red-400 hover:text-red-900"><XIcon size={18}/></button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Motif d'annulation <span className="text-red-500">*</span></label>
                    <textarea 
                      required
                      value={customReason}
                      onChange={e => setCustomReason(e.target.value)}
                      placeholder="Ex: Demande client, rupture imprévue..."
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-red-500 min-h-[80px]"
                    />
                  </div>
                  <p className="text-xs text-neutral-500 italic">Le stock réservé sera automatiquement restauré dans l'inventaire.</p>
                </div>
                <div className="p-4 bg-neutral-50 flex justify-end gap-2">
                  <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200 rounded-lg">Fermer</button>
                  <button type="submit" disabled={!!loadingAction || !customReason.trim()} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2 disabled:opacity-50">
                    {loadingAction && <Loader2 size={16} className="animate-spin" />} Annuler la commande
                  </button>
                </div>
              </form>
            )}

            {activeModal === 'ship' && (
              <form onSubmit={handleShip}>
                <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-orange-50 text-orange-900">
                  <h3 className="font-bold">Expédier la commande</h3>
                  <button type="button" onClick={() => setActiveModal(null)} className="text-orange-400 hover:text-orange-900"><XIcon size={18}/></button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Numéro de suivi (Optionnel)</label>
                    <input 
                      type="text"
                      value={trackingNumber}
                      onChange={e => setTrackingNumber(e.target.value)}
                      placeholder="Ex: YAL-12345678"
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <p className="text-xs text-neutral-500 italic">WhatsApp sera ouvert pour envoyer la confirmation d'expédition au client.</p>
                </div>
                <div className="p-4 bg-neutral-50 flex justify-end gap-2">
                  <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200 rounded-lg">Annuler</button>
                  <button type="submit" disabled={!!loadingAction} className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg flex items-center gap-2">
                    {loadingAction && <Loader2 size={16} className="animate-spin" />} Confirmer l'expédition
                  </button>
                </div>
              </form>
            )}

            {activeModal === 'return' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                handleUpdate('retourné', customReason, 'retourner');
              }}>
                <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-sky-50 text-sky-900">
                  <h3 className="font-bold">Enregistrer un retour</h3>
                  <button type="button" onClick={() => setActiveModal(null)} className="text-sky-400 hover:text-sky-900"><XIcon size={18}/></button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Motif du retour <span className="text-red-500">*</span></label>
                    <textarea 
                      required
                      value={customReason}
                      onChange={e => setCustomReason(e.target.value)}
                      placeholder="Ex: Taille inadaptée, défaut de fabrication..."
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-sky-500 min-h-[80px]"
                    />
                  </div>
                  <p className="text-xs text-neutral-500 italic">Les articles retournés seront automatiquement réintégrés au stock.</p>
                </div>
                <div className="p-4 bg-neutral-50 flex justify-end gap-2">
                  <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200 rounded-lg">Fermer</button>
                  <button type="submit" disabled={!!loadingAction || !customReason.trim()} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg flex items-center gap-2 disabled:opacity-50">
                    {loadingAction && <Loader2 size={16} className="animate-spin" />} Confirmer le retour
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
