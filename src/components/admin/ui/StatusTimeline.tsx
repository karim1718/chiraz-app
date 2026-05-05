import { Fragment } from 'react';
import { motion } from 'framer-motion';
import type { OrderStatus } from '../../../types/order';

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'nouveau', label: 'Nouveau' },
  { key: 'confirmé', label: 'Confirmé' },
  { key: 'en_preparation', label: 'En préparation' },
  { key: 'expédié', label: 'Expédié' },
  { key: 'livré', label: 'Livré' },
];

export interface StatusTimelineProps {
  currentStatus: string;
  completedStatuses: string[];
}

export default function StatusTimeline({
  currentStatus,
  completedStatuses,
}: StatusTimelineProps) {
  const done = new Set(completedStatuses);
  const flowIdx = STEPS.findIndex((s) => s.key === currentStatus);
  const inFlow = flowIdx >= 0;

  const lineAfterStepComplete = (stepIndex: number) => {
    if (stepIndex >= STEPS.length - 1) return false;
    if (currentStatus === 'livré') return true;
    if (inFlow && stepIndex < flowIdx) return true;
    const nextKey = STEPS[stepIndex + 1].key;
    return done.has(nextKey);
  };

  return (
    <div
      className="flex h-16 w-full items-center px-2 sm:px-4"
      role="list"
      aria-label="Progression de la commande"
    >
      {STEPS.map((step, index) => {
        let isFilled = false;
        let isCurrent = false;

        if (inFlow) {
          if (currentStatus === 'livré') {
            isFilled = true;
          } else if (index < flowIdx) {
            isFilled = true;
          } else if (index === flowIdx) {
            isCurrent = true;
          }
        } else {
          isFilled = done.has(step.key);
        }

        const circleClass = isFilled
          ? 'border-transparent bg-blue-600 text-white shadow-sm'
          : isCurrent
            ? 'border-2 border-blue-600 bg-white text-blue-600 shadow-sm'
            : 'border-2 border-gray-300 bg-white text-gray-400';

        return (
          <Fragment key={step.key}>
            <motion.div
              initial={false}
              animate={{ scale: isCurrent ? 1.06 : 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              title={step.label}
              className={[
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
                circleClass,
              ].join(' ')}
              role="listitem"
              aria-current={isCurrent ? 'step' : undefined}
            >
              {index + 1}
            </motion.div>

            {index < STEPS.length - 1 ? (
              <div className="mx-1 min-w-[0.75rem] flex-1">
                <div className="relative h-1 w-full overflow-hidden rounded-full bg-gray-300">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-blue-600"
                    initial={false}
                    animate={{
                      width: lineAfterStepComplete(index) ? '100%' : '0%',
                    }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
