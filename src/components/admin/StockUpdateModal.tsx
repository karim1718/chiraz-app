import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { adminJoinProductStub, getPrimaryImageForColor } from '../../utils/productColorAssets';
import { X, Loader2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useToast } from './ui/Toast';

function formatStockSaveError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/row-level security|violates row-level security policy/i.test(msg)) {
    return "L'historique des mouvements refuse l'enregistrement avec votre session. Appliquez la migration Supabase « stock_movements » pour le rôle authenticated, ou utilisez la clé anon pour les tests.";
  }
  return msg;
}

interface StockUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  variant: any;
  type: 'entrée' | 'sortie' | null;
}

export default function StockUpdateModal({ isOpen, onClose, onSuccess, variant, type }: StockUpdateModalProps) {
  const { showToast } = useToast();
  const [qty, setQty] = useState<number | ''>('');
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQty('');
      setNote('');
      if (type === 'entrée') setReason('Réapprovisionnement');
      else if (type === 'sortie') setReason('Vente hors-ligne');
    }
  }, [isOpen, type]);

  if (!isOpen || !variant || !type) return null;

  const lineThumb =
    variant.products?.id != null
      ? getPrimaryImageForColor(adminJoinProductStub(variant.products), variant.color)
      : undefined;

  const isEntree = type === 'entrée';

  const reasons = isEntree 
    ? ['Réapprovisionnement', 'Retour client', 'Correction']
    : ['Vente hors-ligne', 'Perte', 'Correction'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedQty = Number(qty);
    if (!parsedQty || parsedQty < 1) {
      showToast('Indiquez une quantité entière au moins égale à 1.', 'error');
      return;
    }
    if (!reason) {
      showToast('Choisissez un motif pour ce mouvement.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const newStock = isEntree ? variant.stock + parsedQty : variant.stock - parsedQty;

      if (newStock < 0) {
        showToast('Stock final impossible : la sortie dépasse le stock disponible.', 'error');
        return;
      }

      const finalReason = note.trim() ? `${reason} : ${note.trim()}` : reason;

      // 1. Historique d'abord : si RLS/erreur, le stock physique n'est pas modifié.
      const { error: moveError } = await supabase.from('stock_movements').insert([
        {
          variant_id: variant.id,
          type,
          quantity: parsedQty,
          reason: finalReason,
        },
      ]);

      if (moveError) throw moveError;

      const { error: variantError } = await supabase
        .from('variants')
        .update({ stock: newStock })
        .eq('id', variant.id);

      if (variantError) throw variantError;

      showToast(
        isEntree
          ? `+${parsedQty} enregistré(s). Le stock affiché est à jour.`
          : `-${parsedQty} enregistré(s). Le stock affiché est à jour.`,
        'success',
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      showToast(formatStockSaveError(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between bg-neutral-900 p-5 text-white">
          <div className="flex items-center gap-3">
            {isEntree ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400"><ArrowDownCircle size={18} /></div>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20 text-orange-400"><ArrowUpCircle size={18} /></div>
            )}
            <div>
              <h2 className="font-serif text-xl">
                {isEntree ? 'Entrée de stock' : 'Sortie de stock'}
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-neutral-50 p-6">
          <div className="mb-6 flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            {lineThumb ? (
              <img src={lineThumb} alt="Produit" className="h-12 w-12 rounded object-cover border border-neutral-200" />
            ) : (
              <div className="h-12 w-12 rounded border border-neutral-300 bg-neutral-100" />
            )}
            <div>
              <p className="font-semibold text-neutral-900">{variant.products?.name}</p>
              <p className="text-sm text-neutral-500">Pointure: {variant.size} | {variant.color}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Stock Actuel</p>
              <p className="text-2xl font-bold tabular-nums text-neutral-900">{variant.stock}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Quantité ({isEntree ? '+' : '-'}) <span className="text-red-500">*</span>
              </label>
              <input 
                type="number" 
                required 
                min="1"
                value={qty}
                onChange={e => setQty(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 font-medium outline-none transition-shadow focus:border-black focus:ring-2 focus:ring-black/5"
                placeholder="Ex: 5"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Motif <span className="text-red-500">*</span>
              </label>
              <select 
                value={reason} 
                onChange={e => setReason(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 outline-none transition-shadow focus:border-black focus:ring-2 focus:ring-black/5"
              >
                {reasons.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Note libre (optionnelle)
              </label>
              <textarea 
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full resize-none rounded-lg border border-neutral-300 px-4 py-2 outline-none transition-shadow focus:border-black focus:ring-2 focus:ring-black/5"
                placeholder="Détails supplémentaires..."
              />
            </div>
          </form>
        </div>

        {/* Footer actions */}
        <div className="flex shrink-0 justify-end gap-3 rounded-b-2xl border-t border-neutral-200 bg-white p-4 sm:p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button 
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-neutral-200 bg-white px-5 py-2 text-sm font-semibold text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
          >
            Annuler
          </button>
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !qty}
            className={`flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-70 ${isEntree ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-700'}`}
          >
            {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Enregistrement...</> : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
