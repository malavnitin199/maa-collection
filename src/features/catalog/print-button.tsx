'use client';

import { secondaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';

export function PrintButton({ label }: { label?: string }) {
  const t = useT();
  return (
    <button type="button" onClick={() => window.print()} className={`${secondaryButton} print:hidden`}>
      {label ?? t('stk.print')}
    </button>
  );
}
