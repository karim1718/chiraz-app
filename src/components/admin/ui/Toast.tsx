import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
}

export interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4200;
const motionTransition = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };

function toastVariantStyles(variant: ToastVariant): {
  Icon: typeof Info;
  accent: string;
  iconBg: string;
  iconColor: string;
} {
  switch (variant) {
    case 'success':
      return {
        Icon: CheckCircle2,
        accent: 'bg-emerald-500',
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-700',
      };
    case 'error':
      return {
        Icon: AlertCircle,
        accent: 'bg-red-500',
        iconBg: 'bg-red-50',
        iconColor: 'text-red-700',
      };
    case 'info':
      return {
        Icon: Info,
        accent: 'bg-neutral-800',
        iconBg: 'bg-neutral-100',
        iconColor: 'text-neutral-700',
      };
  }
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

function ToastView({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const { Icon, accent, iconBg, iconColor } = toastVariantStyles(toast.variant);

  return (
    <motion.div
      layout
      role="status"
      initial={{ opacity: 0, x: 40, y: -20 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 32, y: -12 }}
      transition={motionTransition}
      className="pointer-events-auto w-full max-w-md min-w-[300px]"
    >
      <div className="flex overflow-hidden rounded-2xl bg-white shadow-lg shadow-neutral-900/8 ring-1 ring-neutral-200/90">
        <div className={`w-1 shrink-0 ${accent}`} aria-hidden />
        <div className="flex flex-1 items-start gap-3 p-4">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
            aria-hidden
          >
            <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={2} />
          </span>
          <p className="min-w-0 flex-1 pt-1 text-sm font-medium leading-snug text-neutral-900">
            {toast.message}
          </p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            Fermer
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const existing = timersRef.current.get(id);
    if (existing !== undefined) {
      window.clearTimeout(existing);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      setToasts((prev) => [{ id, variant, message }, ...prev]);
      const timer = window.setTimeout(() => {
        dismissToast(id);
      }, AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  useEffect(() => {
    return () => {
      for (const id of timersRef.current.keys()) {
        const t = timersRef.current.get(id);
        if (t !== undefined) window.clearTimeout(t);
      }
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed top-6 right-6 z-[200] flex max-w-md flex-col items-end gap-3 sm:right-8"
        aria-live="polite"
        aria-relevant="additions text"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastView key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
