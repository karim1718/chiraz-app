import { useState } from 'react';
import { motion } from 'framer-motion';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderColor?: string;
  loading?: 'lazy' | 'eager';
}

export default function LazyImage({
  src,
  alt,
  className = '',
  placeholderColor = '#1a1a1a',
  loading = 'lazy',
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <span className={`relative block overflow-hidden ${className}`}>
      {!loaded && (
        <span
          className="absolute inset-0 animate-pulse"
          style={{ backgroundColor: placeholderColor }}
          aria-hidden
        />
      )}
      <motion.img
        src={src}
        alt={alt}
        loading={loading}
        onLoad={() => setLoaded(true)}
        initial={{ opacity: 0 }}
        animate={{ opacity: loaded ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="relative w-full h-full object-cover"
      />
    </span>
  );
}
