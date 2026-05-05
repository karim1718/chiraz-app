import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CURRENCY } from '../../lib/vocab';
import { X, Loader2, Tag } from 'lucide-react';

interface VariantPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  variant: any;
}

export default function VariantPriceModal({ isOpen, onClose, onSuccess, variant }: VariantPriceModalProps) {
  const [price, setPrice] = useState<number | ''>('');
  const [originalPrice, setOriginalPrice] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && variant) {
      setPrice(variant.price || '');
      setOriginalPrice(variant.original_price || '');
    }
  }, [isOpen, variant]);

  if (!isOpen || !variant) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('variants')
        .update({ 
          price: price !== '' ? Number(price) : null, 
          original_price: originalPrice !== '' ? Number(originalPrice) : null 
        })
        .eq('id', variant.id);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (err: any) {
      alert("Erreur lors de la mise à jour : " + err.message);
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
              <Tag size={18} className="text-white" />
            </div>
            <h2 className="font-serif text-xl">Modifier Prix</h2>
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
          <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm flex items-center gap-4">
            {variant.products?.images?.[0] ? (
              <img src={variant.products.images[0]} alt="Produit" className="h-12 w-12 rounded object-cover border border-neutral-200" />
            ) : (
              <div className="h-12 w-12 rounded border border-neutral-300 bg-neutral-100" />
            )}
            <div>
              <p className="font-semibold text-neutral-900">{variant.products?.name}</p>
              <p className="text-sm text-neutral-500">Pointure: {variant.size} | {variant.color}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                {`Prix de Vente (${CURRENCY.code})`}
              </label>
              <input 
                type="number" 
                min="0"
                value={price}
                onChange={e => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 font-medium focus:border-black focus:ring-2 focus:ring-black outline-none transition-shadow"
                placeholder="Ex: 5500"
              />
              <p className="mt-1 text-xs text-neutral-500">Laissez vide pour utiliser le prix global du produit.</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                {`Prix Barré (Original) (${CURRENCY.code})`}
              </label>
              <input 
                type="number" 
                min="0"
                value={originalPrice}
                onChange={e => setOriginalPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 font-medium focus:border-black focus:ring-2 focus:ring-black outline-none transition-shadow"
                placeholder="Ex: 8000"
              />
              <p className="mt-1 text-xs text-neutral-500">S'affichera barré à côté du prix de vente pour indiquer une promotion.</p>
            </div>
          </form>
        </div>

        {/* Footer */}
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
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-neutral-900 px-6 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black disabled:opacity-70"
          >
            {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Enregistrement...</> : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
