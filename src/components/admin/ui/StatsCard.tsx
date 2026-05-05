import type { LucideIcon } from 'lucide-react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

export type StatsCardVariant = 'blue' | 'green' | 'red' | 'amber';

export interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  variant?: StatsCardVariant;
}

const variantStyles: Record<StatsCardVariant, { circle: string; icon: string }> = {
  blue: {
    circle: 'bg-blue-100',
    icon: 'text-blue-600',
  },
  green: {
    circle: 'bg-green-100',
    icon: 'text-green-600',
  },
  red: {
    circle: 'bg-red-100',
    icon: 'text-red-600',
  },
  amber: {
    circle: 'bg-amber-100',
    icon: 'text-amber-600',
  },
};

export default function StatsCard({
  icon: Icon,
  label,
  value,
  trend,
  variant = 'blue',
}: StatsCardProps) {
  const styles = variantStyles[variant];

  const TrendIcon =
    trend === 'up'
      ? TrendingUp
      : trend === 'down'
        ? TrendingDown
        : trend === 'neutral'
          ? Minus
          : null;

  const trendColorClass =
    trend === 'up' || trend === 'down' ? styles.icon : 'text-neutral-500';

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${styles.circle}`}
          aria-hidden
        >
          <Icon className={`h-5 w-5 ${styles.icon}`} strokeWidth={2} />
        </div>
        {TrendIcon ? (
          <span className={`inline-flex items-center ${trendColorClass}`} aria-hidden>
            <TrendIcon className="h-4 w-4" strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-2xl font-semibold tracking-tight text-neutral-900">
          {value}
        </p>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {label}
        </p>
      </div>
    </div>
  );
}
