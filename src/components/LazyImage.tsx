import { useState } from 'react';
import { motion } from 'framer-motion';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderColor?: string;
  loading?: 'lazy' | 'eager';
  width?: number;
  height?: number;
  srcSet?: string;
  sizes?: string;
  priority?: boolean;
}

export default function LazyImage({
  src,
  alt,
  className = '',
  placeholderColor = '#1a1a1a',
  loading = 'lazy',
  width,
  height,
  srcSet,
  sizes,
  priority = false,
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const loadingAttr = priority ? 'eager' : loading;

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
        width={width}
        height={height}
        srcSet={srcSet}
        sizes={sizes}
        loading={loadingAttr}
        decoding="async"
        fetchPriority={priority ? 'high' : undefined}
        onLoad={() => setLoaded(true)}
        initial={{ opacity: 0 }}
        animate={{ opacity: loaded ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="relative w-full h-full object-cover"
      />
    </span>
  );
}
