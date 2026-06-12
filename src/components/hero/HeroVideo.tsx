import { motion } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

const HERO_POSTER = '/photos/hero-poster.jpg';

interface HeroVideoProps {
  bgScale: number | MotionValue<number>;
  isMobile: boolean;
}

export function HeroVideo({ bgScale, isMobile }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleCanPlay = useCallback(() => {
    setIsReady(true);
    const video = videoRef.current;
    if (video) {
      void video.play().catch(() => {
        /* autoplay blocked — poster remains visible */
      });
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnded = () => {
      video.pause();
    };

    video.addEventListener('ended', onEnded);
    return () => video.removeEventListener('ended', onEnded);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full transform-origin-center bg-black"
      style={{ scale: bgScale }}
      initial={isMobile ? false : { scale: 1.1 }}
      animate={isMobile ? undefined : { scale: 1 }}
      transition={isMobile ? undefined : { duration: 2.5, ease: 'easeOut' }}
    >
      {/* Poster + shimmer skeleton — visible until video is ready */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          isReady && !hasError ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        aria-hidden={isReady && !hasError}
      >
        <img
          src={HERO_POSTER}
          alt=""
          width={1280}
          height={720}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {!isReady && !hasError && (
          <div className="absolute inset-0 bg-black/20 animate-pulse" />
        )}
      </div>

      {!hasError && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          loop={false}
          poster={HERO_POSTER}
          preload="metadata"
          onCanPlay={handleCanPlay}
          onError={() => setHasError(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            isReady ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <source src="/photos/hero.webm" type="video/webm" />
          <source src="/photos/hero.mp4" type="video/mp4" />
        </video>
      )}

      {hasError && (
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            background:
              'radial-gradient(circle at 30% 20%, rgba(228,225,213,0.12), transparent 45%), radial-gradient(circle at 70% 80%, rgba(228,225,213,0.08), transparent 50%), #000',
          }}
        />
      )}

      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
    </motion.div>
  );
}
