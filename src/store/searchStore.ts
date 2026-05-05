import { create } from 'zustand';
import type { Product } from '../types/product';

interface SearchStore {
  query: string;
  results: Product[];
  isOpen: boolean;
  activeCategory: string;
  setQuery: (query: string) => void;
  setResults: (results: Product[]) => void;
  setOpen: (isOpen: boolean) => void;
  openSearch: () => void;
  closeSearch: () => void;
  setActiveCategory: (category: string) => void;
  reset: () => void;
}

const initialState = {
  query: '',
  results: [],
  isOpen: false,
  activeCategory: '',
};

export const useSearchStore = create<SearchStore>((set) => ({
  ...initialState,

  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  setOpen: (isOpen) => set({ isOpen }),
  openSearch: () => set({ isOpen: true }),
  closeSearch: () => set({ isOpen: false }),
  setActiveCategory: (category) => set({ activeCategory: category }),
  reset: () => set(initialState),
}));
