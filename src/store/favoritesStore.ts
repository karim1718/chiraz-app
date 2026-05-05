import { create } from 'zustand';

interface FavoritesStore {
  ids: string[];
  toggle: (id: string) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
}

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  ids: [],

  toggle: (id) => {
    set((state) => ({
      ids: state.ids.includes(id) ? state.ids.filter((i) => i !== id) : [...state.ids, id],
    }));
  },

  add: (id) => {
    if (!get().ids.includes(id)) set((state) => ({ ids: [...state.ids, id] }));
  },

  remove: (id) => {
    set((state) => ({ ids: state.ids.filter((i) => i !== id) }));
  },

  has: (id) => get().ids.includes(id),
}));
