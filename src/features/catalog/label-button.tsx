'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { IconQr } from '@/components/ui/icons';
import { useClearOnLeave } from '@/features/forms/fresh-on-return';
import { haptic } from '@/features/feedback/sounds';
import { useT } from '@/features/i18n/i18n-provider';

// The sheet (and the QR / barcode drawing it needs) loads on the first tap, not with the list.
const LabelSheet = dynamic(() => import('./label-sheet').then((m) => m.LabelSheet));

/**
 * Stocks card → the small QR button (owner's feedback 2026-11-23, ADR-070): opens the product's
 * label — its real hang tag with the QR code and barcode — in a sheet. It sits above the card's
 * link (a tap here never opens the product) and steps aside while selecting. The sheet closes
 * when the person leaves Stocks, so it is never open on coming back.
 */
export function LabelButton({ ids, name }: { ids: readonly string[]; name: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  useClearOnLeave(() => setOpen(false));
  return (
    <>
      <button
        type="button"
        data-testid="card-label"
        aria-label={t('cat.card.label', { name })}
        onClick={() => {
          haptic(8);
          setOpen(true);
        }}
        className="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-surface text-zinc-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 active:scale-90 active:bg-brand-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:text-brand-200 dark:active:bg-brand-950 [html[data-selecting]_&]:pointer-events-none [html[data-selecting]_&]:opacity-0"
      >
        <IconQr className="h-5 w-5" />
      </button>
      {open && <LabelSheet ids={ids} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}
