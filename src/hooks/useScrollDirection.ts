import { useState, useEffect, useRef } from 'react';

export function useScrollDirection(threshold = 10) {
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const lastY = useRef(0);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (Math.abs(y - lastY.current) >= threshold) {
          setDirection(y > lastY.current ? 'down' : 'up');
          lastY.current = y;
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return direction;
}
