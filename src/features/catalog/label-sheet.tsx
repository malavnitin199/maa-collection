'use client';

import { unstable_rethrow } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ActionSheet, sheetSecondary } from '@/components/ui/selection';
import { errorBox, muted } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import { productLabelsAction, type ProductLabel } from '@/server/actions/labels';
import { HangTag } from './hang-tag';

/** The 40 × 60 mm tag at 1.5×: readable on a phone, and its QR code scans from the screen. */
const ZOOM = 1.5;

const sizeChip = (on: boolean) =>
  `min-h-9 rounded-full px-3.5 text-sm font-semibold transition active:scale-95 ${
    on ? 'bg-brand-600 text-white shadow-sm' : 'bg-brand-50 text-brand-800 ring-1 ring-brand-200 ring-inset dark:bg-brand-950 dark:text-brand-100 dark:ring-brand-800'
  }`;

/**
 * The label sheet (ADR-070): the product's name, a chip per size when it has several, and that
 * size's hang tag exactly as it prints (shop, size, QR code, name, ART., barcode, MRP), shown
 * bigger. The tags are fetched when the sheet opens.
 */
export function LabelSheet({ ids, name, onClose }: { ids: readonly string[]; name: string; onClose: () => void }) {
  const t = useT();
  const [labels, setLabels] = useState<ProductLabel[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [at, setAt] = useState(0);
  const wanted = ids.join(',');

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const rows = await productLabelsAction(wanted.split(','));
        if (live) setLabels(rows);
      } catch (error) {
        unstable_rethrow(error);
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [wanted]);

  const na = t('common.na');
  const shown = labels && labels.length > 0 ? labels[Math.min(at, labels.length - 1)] : null;
  /** A size's chip: the size (N/A when none); a second item of the same size gets "· 2". */
  const chipText = (i: number) => {
    const size = labels![i].tag.size.trim();
    const before = labels!.slice(0, i).filter((l) => l.tag.size.trim().toLowerCase() === size.toLowerCase()).length;
    return `${size || na}${before > 0 ? ` · ${before + 1}` : ''}`;
  };

  return (
    <ActionSheet title={name} onClose={onClose}>
      {labels && labels.length > 1 && (
        <div role="group" aria-label={t('cat.design.sizes')} data-testid="label-sizes" className="flex flex-wrap gap-1.5">
          {labels.map((label, i) => (
            <button key={label.id} type="button" aria-pressed={label === shown} onClick={() => setAt(i)} className={sizeChip(label === shown)}>
              {chipText(i)}
            </button>
          ))}
        </div>
      )}
      <div data-testid="label-view" className="flex justify-center">
        {shown ? (
          <div style={{ zoom: ZOOM }}>
            <HangTag key={shown.id} product={shown.tag} sizes={shown.sizes} qrValue={shown.qr} priceCode={shown.priceCode} />
          </div>
        ) : failed ? (
          <p role="alert" className={`${errorBox} w-full`}>
            {t('cat.label.failed')}
          </p>
        ) : labels ? (
          <p className={`text-sm ${muted}`}>{t('cat.label.none')}</p>
        ) : (
          <div role="status" aria-label={t('cat.label.loading')} style={{ zoom: ZOOM }} className="h-[60mm] w-[40mm] animate-pulse rounded-[2mm] bg-zinc-100 dark:bg-zinc-800" />
        )}
      </div>
      <button type="button" onClick={onClose} className={sheetSecondary}>
        {t('cat.label.close')}
      </button>
    </ActionSheet>
  );
}
