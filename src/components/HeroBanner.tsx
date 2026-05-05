import { motion, useScroll, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { useWindowSize } from '../hooks';

const ImageSequenceCanvas = ({ bgScale, isMobile }: { bgScale: number | MotionValue<number>; isMobile: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<HTMLImageElement[]>([]);

  // Charger toutes les photos du dossier (sans sauter de frame)
  useEffect(() => {
    let isMounted = true;
    const loadedImages: HTMLImageElement[] = [];
    let index = 0;

    const loadNextImage = () => {
      if (!isMounted) return;
      const img = new Image();
      const frameNum = String(index).padStart(3, '0');
      img.src = `/photos/Penny_loafer_on_marble_slab_243e7581b3 (1)_${frameNum}.jpg`;

      img.onload = () => {
        if (!isMounted) return;
        loadedImages.push(img);
        index += 1;
        loadNextImage();
      };

      img.onerror = () => {
        if (isMounted && loadedImages.length > 0) setImages(loadedImages);
      };
    };

    loadNextImage();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (images.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameIndex = 0;
    let animationFrameId: number;
    let lastTime = performance.now();
    const fps = isMobile ? 15 : 30;
    const fpsInterval = 1000 / fps;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawFrame(frameIndex);
    };

    function drawFrame(idx: number) {
      const safeIdx = Math.min(idx, images.length - 1);
      const img = images[safeIdx];
      if (!img || !canvas || !ctx) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const iw = img.width;
      const ih = img.height;
      const scale = Math.max(cw / iw, ch / ih);
      const x = (cw - iw * scale) / 2;
      const y = (ch - ih * scale) / 2;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, x, y, iw * scale, ih * scale);
    }

    window.addEventListener('resize', resizeCanvas);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawFrame(0);

    const animate = (time: number) => {
      const elapsed = time - lastTime;
      if (elapsed > fpsInterval) {
        lastTime = time - (elapsed % fpsInterval);
        // À la dernière photo : rester dessus (pas de boucle)
        if (frameIndex >= images.length - 1) {
          drawFrame(images.length - 1);
          return;
        }
        frameIndex += 1;
        drawFrame(frameIndex);
      }
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [images, isMobile]);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full transform-origin-center bg-black"
      style={{ scale: bgScale }}
      initial={{ scale: 1.1 }}
      animate={{ scale: 1 }}
      transition={{ duration: 2.5, ease: 'easeOut' }}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
    </motion.div>
  );
};

const HeroBanner = () => {
  const { t, i18n } = useTranslation();
  const title = t('hero.title');
  const words = useMemo(() => title.split(/(\s+)/).filter(Boolean), [title]);
  const { scrollY } = useScroll();
  const { isMobile } = useWindowSize();
  /** Per-letter spans break Arabic cursive joining — use word-level animation for RTL scripts. */
  const isRtl = i18n.language.startsWith('ar');
  const useWordLevelTitle = isMobile || isRtl;
  /** Remount hero copy when language changes so Framer Motion re-runs initial → animate (avoids stuck hidden state). */
  const langKey = i18n.language;

  const bgScale = useTransform(scrollY, [0, 1000], [1, 1.15]);
  const textYScroll = useTransform(scrollY, [0, 800], [0, 250]);
  const opacity = useTransform(scrollY, [0, 600], [1, 0]);

  const wordVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.5 + i * 0.08, duration: 0.6, ease: 'easeOut' as const },
    }),
  };

  const letterVariants = {
    hidden: { opacity: 0, y: 40, rotateX: -90 },
    visible: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: { duration: 1.2, ease: 'easeOut' as const },
    },
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.5 },
    },
  };

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1.2, ease: 'easeOut' as const, delay: 1.8 },
    },
  };

  return (
    <section className="relative w-full min-h-[100svh] sm:h-screen flex items-center justify-center overflow-hidden bg-black">
      <ImageSequenceCanvas bgScale={isMobile ? 1 : bgScale} isMobile={isMobile} />

      <motion.div
        key={langKey}
        dir={isRtl ? 'rtl' : 'ltr'}
        className="relative z-10 text-center px-4 sm:px-6 flex flex-col items-center mt-16 sm:mt-20"
        style={isMobile ? { opacity } : { y: textYScroll, opacity }}
      >
        <motion.h1
          key={`title-${langKey}`}
          lang={i18n.language}
          className="text-3xl sm:text-5xl md:text-8xl text-[#e4e1d5] tracking-tight mb-4 sm:mb-6 flex flex-wrap justify-center text-center font-serif drop-shadow-xl"
          variants={isMobile ? undefined : containerVariants}
          initial={isMobile ? false : 'hidden'}
          animate={isMobile ? false : 'visible'}
        >
          {useWordLevelTitle
            ? words.map((word, i) => (
              <motion.span
                key={`${langKey}-w-${i}-${word.slice(0, 12)}`}
                custom={i}
                variants={wordVariants}
                initial="hidden"
                animate="visible"
                className={
                  /^\s+$/.test(word)
                    ? 'inline w-2 sm:w-4'
                    : `inline-block ${isRtl ? 'ms-1 sm:ms-2' : 'mr-1 sm:mr-2'}`
                }
              >
                {word}
              </motion.span>
            ))
            : title.split('').map((char, index) => (
              <motion.span
                key={`${langKey}-c-${index}`}
                variants={letterVariants}
                className={char === ' ' ? 'w-4 md:w-8' : 'inline-block'}
              >
                {char}
              </motion.span>
            ))}
        </motion.h1>

        <motion.p
          key={`sub-${langKey}`}
          lang={i18n.language}
          className="text-sm sm:text-lg md:text-2xl text-[#e4e1d5]/90 font-light mb-7 sm:mb-12 drop-shadow-md max-w-xl font-sans tracking-wide leading-relaxed text-center"
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
        >
          <Trans
            i18nKey="hero.subtitle"
            components={{
              chiraz: <span dir="ltr" className="inline-block font-medium tracking-normal" />,
            }}
          />
        </motion.p>

        <motion.div
          key={`cta-${langKey}`}
          className="flex flex-col sm:flex-row gap-3 sm:gap-6 w-full sm:w-auto max-w-sm sm:max-w-none px-1 sm:px-2"
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
        >
          <Link
            to="/shop?category=chaussures"
            className="group relative overflow-hidden bg-[#e4e1d5] text-black px-5 sm:px-12 py-4 sm:py-5 font-medium text-[11px] sm:text-xs tracking-[0.16em] sm:tracking-[0.2em] transition-all hover:shadow-[0_0_40px_rgba(228,225,213,0.3)] min-h-[50px] flex items-center justify-center w-full sm:w-auto"
          >
            <span className="relative z-10 transition-colors duration-500 group-hover:text-[#e4e1d5]">{t('hero.ctaShoes')}</span>
            <div className="absolute inset-0 h-full w-full bg-black transform translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:translate-y-0" />
          </Link>
          <Link
            to="/shop?category=sandales"
            className="group relative overflow-hidden bg-transparent border border-[#e4e1d5] text-[#e4e1d5] px-5 sm:px-12 py-4 sm:py-5 font-medium text-[11px] sm:text-xs tracking-[0.16em] sm:tracking-[0.2em] transition-all hover:border-black min-h-[50px] flex items-center justify-center w-full sm:w-auto"
          >
            <span className="relative z-10 transition-colors duration-500">{t('hero.ctaSandals')}</span>
            <div className="absolute inset-0 h-full w-full bg-[#e4e1d5] transform -translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:translate-y-0" />
            <span className="absolute inset-0 z-10 flex items-center justify-center text-black opacity-0 transform translate-y-4 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0">{t('hero.ctaSandals')}</span>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroBanner;
