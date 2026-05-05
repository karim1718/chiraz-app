import type { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-[#6B7280]"
        aria-hidden
      >
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <div className="max-w-md space-y-2">
        <h3 className="text-lg font-semibold text-[#6B7280]">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-[#6B7280]">{subtitle}</p>
      </div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
