import { motion } from 'framer-motion';
import type { IsOutOfStockFn } from '../../hooks/useProductStock';
import { useProductStock } from '../../hooks/useProductStock';

export const ALL_SIZES = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46];

interface SizeChipsBaseProps {
  selectedColor?: string;
  sizes: number[];
  selectedSize: number | null;
  onSelect: (size: number) => void;
  isOutOfStock: IsOutOfStockFn;
  stockLoading: boolean;
}

function SizeChipsBase({
  selectedColor,
  sizes,
  selectedSize,
  onSelect,
  isOutOfStock,
  stockLoading,
}: SizeChipsBaseProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${stockLoading ? 'opacity-70 transition-opacity' : ''}`}>
      {sizes.map((size) => {
        const isStockEmpty = isOutOfStock(size, selectedColor);
        const isSelected = selectedSize === size;

        return (
          <motion.button
            key={size}
            type="button"
            onClick={() => !isStockEmpty && onSelect(size)}
            disabled={isStockEmpty}
            whileHover={!isStockEmpty && !isSelected ? { scale: 1.05 } : {}}
            whileTap={!isStockEmpty ? { scale: 0.9, transition: { type: 'spring', stiffness: 500, damping: 15 } } : {}}
            animate={isSelected ? { scale: 1.08 } : { scale: 1 }}
            className={`relative w-12 h-12 min-h-[48px] rounded border text-sm font-medium transition-colors ${
              isStockEmpty
                ? 'border-[#E4E1D5]/15 text-[#E4E1D5]/40 cursor-not-allowed'
                : isSelected
                ? 'border-[#E4E1D5] bg-black text-[#E4E1D5] shadow-[0_0_15px_rgba(228,225,213,0.15)]'
                : 'border-[#E4E1D5]/30 bg-transparent text-[#E4E1D5]/90 hover:border-[#E4E1D5]/60'
            }`}
          >
            {size}
            {isStockEmpty && (
              <span
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                aria-hidden
              >
                <span className="w-full h-[1.5px] bg-[#E4E1D5]/40 rotate-45 origin-center" />
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

function SizeChipsWithStock({
  productId,
  ...rest
}: Omit<SizeChipsProps, 'isOutOfStock' | 'stockLoading'>) {
  const { isOutOfStock, isLoading } = useProductStock(productId);
  return (
    <SizeChipsBase
      {...rest}
      isOutOfStock={isOutOfStock}
      stockLoading={isLoading}
    />
  );
}

interface SizeChipsProps {
  productId: string;
  selectedColor?: string;
  sizes: number[];
  selectedSize: number | null;
  onSelect: (size: number) => void;
  /** When provided, skips internal stock fetch (avoids duplicate API calls). */
  isOutOfStock?: IsOutOfStockFn;
  stockLoading?: boolean;
}

export default function SizeChips({
  isOutOfStock: isOutOfStockProp,
  stockLoading: stockLoadingProp,
  productId,
  ...rest
}: SizeChipsProps) {
  if (isOutOfStockProp) {
    return (
      <SizeChipsBase
        {...rest}
        isOutOfStock={isOutOfStockProp}
        stockLoading={stockLoadingProp ?? false}
      />
    );
  }

  return <SizeChipsWithStock productId={productId} {...rest} />;
}
