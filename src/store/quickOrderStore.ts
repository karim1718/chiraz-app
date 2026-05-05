import { create } from 'zustand';

interface QuickOrderState {
  fullName: string;
  phone: string;
  city: string;
  setFullName: (name: string) => void;
  setPhone: (phone: string) => void;
  setCity: (city: string) => void;
  reset: () => void;
}

export const useQuickOrderStore = create<QuickOrderState>((set) => ({
  fullName: '',
  phone: '',
  city: '',
  setFullName: (fullName) => set({ fullName }),
  setPhone: (phone) => set({ phone }),
  setCity: (city) => set({ city }),
  reset: () => set({ fullName: '', phone: '', city: '' }),
}));
