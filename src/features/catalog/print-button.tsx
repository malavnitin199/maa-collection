'use client';

import { secondaryButton } from '@/components/ui/styles';

export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={`${secondaryButton} print:hidden`}>
      {label}
    </button>
  );
}
