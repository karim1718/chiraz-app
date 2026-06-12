import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuickOrderStore } from '../../store/quickOrderStore';
import type { Product } from '../../types/product';
import { getPrimaryImageForColor } from '../../utils/productColorAssets';
import { useWindowSize, useBodyScrollLock } from '../../hooks';
import { createOrder, StockError } from '../../services/orderService';
import {
  createLeadSessionKey,
  hasMeaningfulLeadData,
  markOrderLeadConverted,
  upsertOrderLead,
} from '../../services/orderLeadService';
import { formatCurrencyAmount } from '../../lib/vocab';
import { fetchShopShippingSettings } from '../../lib/shopShippingSettings';
import { shopWhatsAppUrl } from '../../lib/shopContact';

interface QuickOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  selectedSize: number | null;
  selectedColor?: string | null;
}

export default function QuickOrderModal({ isOpen, onClose, product, selectedSize, selectedColor }: QuickOrderModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isMobile } = useWindowSize();
  const fullName = useQuickOrderStore((s) => s.fullName);
  const phone = useQuickOrderStore((s) => s.phone);
  const city = useQuickOrderStore((s) => s.city);
  const setFullName = useQuickOrderStore((s) => s.setFullName);
  const setPhone = useQuickOrderStore((s) => s.setPhone);
  const setCity = useQuickOrderStore((s) => s.setCity);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shippingEnabled, setShippingEnabled] = useState(true);
  const [deliveryFeeInput, setDeliveryFeeInput] = useState('0');
  const sessionKeyRef = useRef<string>('');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushAutosaveRef = useRef<((force?: boolean) => Promise<void>) | null>(null);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const cfg = await fetchShopShippingSettings();
      if (cancelled) return;
      setShippingEnabled(cfg.shipping_enabled);
      setDeliveryFeeInput(
        cfg.shipping_enabled ? String(cfg.default_shipping_fee) : '0',
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const unitPrice = Number(product?.price ?? 0);
  const quantity = 1;
  const subtotalProducts = unitPrice * quantity;
  const parsedDelivery = shippingEnabled
    ? Math.max(0, Number(String(deliveryFeeInput).replace(',', '.') || 0) || 0)
    : 0;
  const grandTotal = subtotalProducts + parsedDelivery;

  const orderSummary = {
    subtotal: subtotalProducts,
    delivery: parsedDelivery,
    total: grandTotal,
  };

  const leadPayload = useMemo(() => {
    if (!product) return null;
    return {
      fullName,
      phone,
      city,
      productId: product.id,
      productName: product.name,
      selectedSize,
      selectedColor: selectedColor ?? null,
      quantity,
      unitPrice,
      deliveryCost: parsedDelivery,
      total: grandTotal,
    };
  }, [
    product,
    fullName,
    phone,
    city,
    selectedSize,
    selectedColor,
    quantity,
    unitPrice,
    parsedDelivery,
    grandTotal,
  ]);

  const flushAutosave = useCallback(
    async (force = false) => {
      if (!sessionKeyRef.current) return;
      if (!force && !isOpen) return;
      if (!leadPayload || !hasMeaningfulLeadData(leadPayload)) return;
      await upsertOrderLead(sessionKeyRef.current, leadPayload);
    },
    [isOpen, leadPayload],
  );

  flushAutosaveRef.current = flushAutosave;

  /** Nouvelle session à chaque ouverture du modal → un nouveau prospect dans l’admin. */
  useEffect(() => {
    if (!isOpen || !product) return;
    sessionKeyRef.current = createLeadSessionKey();
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      void flushAutosaveRef.current?.(true);
    };
  }, [isOpen, product?.id]);

  useEffect(() => {
    if (!isOpen) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      return;
    }

    if (!leadPayload || !hasMeaningfulLeadData(leadPayload)) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      void flushAutosave();
    }, 2000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [isOpen, leadPayload, flushAutosave]);

  const orderThumb = product
    ? getPrimaryImageForColor(product, selectedColor || product.colors[0]) ?? ''
    : '';

  if (!product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !city) return;
    
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (selectedSize === null) throw new Error(t('quickOrder.errSize'));
      
      const orderId = await createOrder({
        productId: product.id,
        selectedSize: selectedSize,
        selectedColor: selectedColor || null,
        fullName,
        phone,
        city,
        price: unitPrice,
        quantity,
        deliveryCost: shippingEnabled ? parsedDelivery : 0,
      });

      await markOrderLeadConverted(sessionKeyRef.current, orderId);

      setIsLoading(false);
      onClose();
      navigate('/confirmation', { state: { orderId } });
    } catch (err: any) {
      setIsLoading(false);
      if (err instanceof StockError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(err.message || t('quickOrder.errGeneric'));
      }
    }
  };

  const handleWhatsApp = () => {
    const unitStr = formatCurrencyAmount(unitPrice, { maximumFractionDigits: 0 });
    const subStr = formatCurrencyAmount(orderSummary.subtotal, { maximumFractionDigits: 0 });
    const delStr = formatCurrencyAmount(orderSummary.delivery, { maximumFractionDigits: 0 });
    const totStr = formatCurrencyAmount(orderSummary.total, { maximumFractionDigits: 0 });
    const lines = [
      t('quickOrder.waIntro'),
      '',
      `- ${t('quickOrder.waLineProduct')}: ${product.name}`,
      `- ${t('quickOrder.waLineSize')}: ${selectedSize ?? ''}`,
    ];
    if (selectedColor) lines.push(`- ${t('quickOrder.waLineColor')}: ${selectedColor}`);
    lines.push(`- ${t('quickOrder.waLineUnit')}: ${unitStr}`);
    if (shippingEnabled) {
      lines.push(
        `- ${t('quickOrder.waLineSub')}: ${subStr}`,
        `- ${t('quickOrder.waLineShip')}: ${delStr}`,
        `- ${t('quickOrder.waLineTotal')}: ${totStr}`
      );
    } else {
      lines.push(`- ${t('quickOrder.waLineTotal')}: ${totStr}`);
    }
    lines.push('', `- ${t('quickOrder.waLineName')}: ${fullName}`, `- ${t('quickOrder.waLineTel')}: ${phone}`, `- ${t('quickOrder.waLineCity')}: ${city}`);
    window.open(shopWhatsAppUrl(lines.join('\n')), '_blank');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: '-50%', x: '-50%' }}
            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: '-50%', x: '-50%' }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: '-50%', x: '-50%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={`fixed z-50 bg-[#0a0a0a] border border-[#E4E1D5]/20 flex flex-col ${
              isMobile
                ? 'bottom-0 left-0 right-0 rounded-t-3xl max-h-[90vh]'
                : 'top-1/2 left-1/2 w-[450px] rounded-2xl max-h-[85vh]'
            }`}
          >
            <div className="flex items-center justify-between p-6 border-b border-[#E4E1D5]/10">
              <h2 className="text-xl font-serif text-[#E4E1D5]">{t('quickOrder.title')}</h2>
              <button
                type="button"
                onClick={onClose}
                className="min-w-[48px] min-h-[48px] flex items-center justify-center text-[#E4E1D5]/60 hover:text-[#E4E1D5] bg-[#E4E1D5]/5 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              <div className="flex gap-4 mb-8 bg-[#E4E1D5]/5 p-4 rounded-xl border border-[#E4E1D5]/10">
                {orderThumb ? (
                  <img src={orderThumb} alt={product.name} className="w-20 h-20 object-cover rounded-lg shrink-0" />
                ) : (
                  <div
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-[#E4E1D5]/20 bg-[#0a0a0a] text-center text-[10px] text-[#E4E1D5]/50"
                    aria-hidden
                  >
                    —
                  </div>
                )}
                <div className="flex flex-col justify-center">
                  <h3 className="font-serif text-lg text-[#E4E1D5]">{product.name}</h3>
                  <p className="text-[#E4E1D5]/70 text-sm mt-1">
                    {t('quickOrder.sizeLabel', {
                      size: selectedSize != null ? String(selectedSize) : t('quickOrder.notSelected'),
                    })}
                    {selectedColor && ` • ${selectedColor}`}
                  </p>
                  <p className="mt-1 text-sm text-[#E4E1D5]/80">
                    {t('quickOrder.perUnit', {
                      price: formatCurrencyAmount(unitPrice, { maximumFractionDigits: 0 }),
                    })}
                  </p>
                </div>
              </div>

              <div
                className="mb-6 rounded-xl border border-[#E4E1D5]/15 bg-[#E4E1D5]/5 p-4"
                aria-label={t('quickOrder.summary')}
              >
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#E4E1D5]/50">
                  {t('quickOrder.summary')}
                </p>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3 text-[#E4E1D5]/90">
                    <dt>{t('quickOrder.subtotal')}</dt>
                    <dd className="tabular-nums font-medium">
                      {formatCurrencyAmount(orderSummary.subtotal, { maximumFractionDigits: 0 })}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 text-[#E4E1D5]/90">
                    <dt className="flex items-center gap-1.5">
                      <Truck size={14} className="shrink-0 text-[#E4E1D5]/60" aria-hidden />
                      {shippingEnabled ? t('quickOrder.delivery') : t('quickOrder.deliveryFree')}
                    </dt>
                    <dd className="tabular-nums font-medium">
                      {formatCurrencyAmount(orderSummary.delivery, { maximumFractionDigits: 0 })}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-[#E4E1D5]/10 pt-2 text-base text-[#E4E1D5]">
                    <dt className="font-semibold">{t('quickOrder.total')}</dt>
                    <dd className="tabular-nums font-bold">
                      {formatCurrencyAmount(orderSummary.total, { maximumFractionDigits: 0 })}
                    </dd>
                  </div>
                </dl>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
                    {errorMsg}
                  </motion.div>
                )}
                <div>
                  <label htmlFor="fullName" className="block text-sm text-[#E4E1D5]/80 mb-2">{t('quickOrder.fullName')}</label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-[#E4E1D5]/5 border border-[#E4E1D5]/20 rounded-xl px-4 min-h-[48px] text-[#E4E1D5] focus:outline-none focus:border-[#E4E1D5] transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm text-[#E4E1D5]/80 mb-2">{t('quickOrder.phone')}</label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#E4E1D5]/5 border border-[#E4E1D5]/20 rounded-xl px-4 min-h-[48px] text-[#E4E1D5] focus:outline-none focus:border-[#E4E1D5] transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="city" className="block text-sm text-[#E4E1D5]/80 mb-2">{t('quickOrder.city')}</label>
                  <input
                    id="city"
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-[#E4E1D5]/5 border border-[#E4E1D5]/20 rounded-xl px-4 min-h-[48px] text-[#E4E1D5] focus:outline-none focus:border-[#E4E1D5] transition-colors"
                  />
                </div>

                <div className="mt-8 pt-4 space-y-3">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-2xl min-h-[56px] px-4 transition-colors flex items-center justify-center text-base"
                  >
                    {isLoading ? <Loader2 size={24} className="animate-spin" /> : t('quickOrder.confirm')}
                  </button>
                  <button
                    type="button"
                    onClick={handleWhatsApp}
                    className="w-full bg-[#E4E1D5]/10 hover:bg-[#E4E1D5]/20 text-[#E4E1D5] font-medium rounded-2xl min-h-[56px] px-4 transition-colors text-base"
                  >
                    {t('quickOrder.wa')}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
