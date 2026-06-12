import { create } from 'zustand';

interface WindowSizeState {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

function computeState(width: number, height: number): WindowSizeState {
  return {
    width,
    height,
    isMobile: width < 640,
    isTablet: width >= 640 && width < 1024,
    isDesktop: width >= 1024,
  };
}

const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
const initialHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

export const useWindowSizeStore = create<WindowSizeState>(() =>
  computeState(initialWidth, initialHeight),
);

let listenerAttached = false;

function attachResizeListener() {
  if (listenerAttached || typeof window === 'undefined') return;
  listenerAttached = true;
  window.addEventListener('resize', () => {
    useWindowSizeStore.setState(computeState(window.innerWidth, window.innerHeight));
  });
}

export function useWindowSize() {
  attachResizeListener();
  return useWindowSizeStore();
}

export function useIsMobile() {
  attachResizeListener();
  return useWindowSizeStore((s) => s.isMobile);
}
