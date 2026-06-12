import { useSyncExternalStore } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
}

type Listener = () => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
const timers = new Map<string, number>();

const AUTO_DISMISS_MS = 4200;

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

function dismissToast(id: string) {
  const timer = timers.get(id);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timers.delete(id);
  }
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function showToast(message: string, variant: ToastVariant = 'info') {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  toasts = [{ id, variant, message }, ...toasts];
  emit();
  const timer = window.setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
  timers.set(id, timer);
}

export function useToastList() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export { dismissToast };

export interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
}
