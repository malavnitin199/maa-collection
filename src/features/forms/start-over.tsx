'use client';

import { secondaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';

/** The "Start again" chip at the top of a long form: asks once when something is typed, then clears it all. */
export function StartOver({ onStartOver, dirty, testId = 'start-over', small = false }: { onStartOver: () => void; dirty: boolean; testId?: string; small?: boolean }) {
  const t = useT();
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={() => {
        if (dirty && !window.confirm(t('type.startOverAsk'))) return;
        onStartOver();
      }}
      className={small ? `${secondaryButton.replace('px-4 py-2 text-sm', '')} px-2.5 py-1 text-[11px]` : `${secondaryButton} px-3 py-1.5 text-xs`}
    >
      ↺ {t('type.startOver')}
    </button>
  );
}
