import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { useBodyScrollLock } from '../../hooks';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  maxHeight?: '50vh' | '85vh' | '90vh';
  showHandle?: boolean;
  dragToDismiss?: boolean;
}

export default function BottomSheet({
  open,
  onClose,
  children,
  title,
  maxHeight = '85vh',
  showHandle = true,
  dragToDismiss = true,
}: BottomSheetProps) {
  const [dragY, setDragY] = useState(0);
  useBodyScrollLock(open);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (!dragToDismiss) return;
    if (info.offset.y > 80 || info.velocity.y > 300) onClose();
    setDragY(0);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: dragY }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            drag={dragToDismiss ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDrag={(_, info) => setDragY(Math.max(0, info.offset.y))}
            onDragEnd={handleDragEnd}
            className="fixed left-0 right-0 bottom-0 z-50 bg-[#0a0a0a] border-t border-[#E4E1D5]/10 rounded-t-2xl flex flex-col"
            style={{ maxHeight }}
          >
            {showHandle && (
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1 rounded-full bg-[#E4E1D5]/30" aria-hidden />
              </div>
            )}
            {title && (
              <h3 className="font-serif text-lg text-[#E4E1D5] px-4 pb-4">
                {title}
              </h3>
            )}
            <div className="overflow-y-auto flex-1 overscroll-contain px-4 pb-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
