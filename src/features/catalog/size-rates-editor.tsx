'use client';

import { Fragment, useState } from 'react';
import { muted, secondaryButton } from '@/components/ui/styles';
import { sizeFieldName } from '@/lib/size-prices';

// Narrow boxes for a phone (16px text: no zoom on focus). Green = this size's own price.
const box = 'w-full min-w-0 rounded-lg border px-2 py-2 text-base tabular-nums';
const defaultBox = `${box} border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900`;
const ownBox = `${box} border-emerald-600 bg-emerald-50 font-semibold dark:border-emerald-500 dark:bg-emerald-950`;

/** Rates as typed, in rupees. */
export type RatesText = { mrp: string; price: string; cost: string };
/** Each size's own rates as typed, keyed by size; an empty box = the default. */
export type OwnRatesText = Record<string, Partial<RatesText>>;

export function hasOwnText(own: Partial<RatesText> | undefined): boolean {
  return Boolean(own?.mrp?.trim() || own?.price?.trim() || own?.cost?.trim());
}

const FIELD_LABEL = { mrp: 'MRP', price: 'selling price', cost: 'purchase price' } as const;

/**
 * "Price by size": one row per size with MRP / selling / purchase boxes. An
 * empty box shows the default in grey; a typed number is that size's own price
 * for all its colours. Colour never changes the price.
 */
export function SizeRatesEditor({
  sizes,
  defaults,
  own,
  onChange,
  showCost,
  named = false,
}: {
  /** Sizes in display order. */
  sizes: string[];
  defaults: RatesText;
  own: OwnRatesText;
  onChange: (next: OwnRatesText) => void;
  /** Purchase price boxes — only with the "costs" right. */
  showCost: boolean;
  /** Give the boxes form field names (forms sent as FormData). */
  named?: boolean;
}) {
  const ownSizes = sizes.filter((size) => hasOwnText(own[size]));
  const [open, setOpen] = useState(ownSizes.length > 0);
  const fields = showCost ? (['mrp', 'price', 'cost'] as const) : (['mrp', 'price'] as const);
  const placeholder = (size: string, field: keyof RatesText) => {
    if (field === 'mrp') return defaults.mrp;
    // No selling price = sells at this size's MRP.
    if (field === 'price') return defaults.price.trim() || own[size]?.mrp?.trim() || defaults.mrp;
    return defaults.cost.trim() || '—';
  };

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      data-testid="size-rates"
      className="rounded-lg border border-zinc-200 dark:border-zinc-800"
    >
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2.5 text-sm font-medium">
        Price by size (optional)
        {ownSizes.length > 0 && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            {ownSizes.length} size{ownSizes.length === 1 ? '' : 's'} with own price
          </span>
        )}
      </summary>
      <div className="flex flex-col gap-2 px-3 pb-3">
        <p className={`text-xs ${muted}`}>
          Grey = the default above, for all sizes. Type a number to give one size its own price — it applies to every colour of
          that size. Clear the box to go back to the default.
        </p>
        <div className={`grid items-center gap-1.5 ${showCost ? 'grid-cols-[3rem_repeat(3,minmax(0,1fr))]' : 'grid-cols-[3rem_repeat(2,minmax(0,1fr))]'}`}>
          <span className={`text-xs ${muted}`}>Size</span>
          <span className={`text-xs ${muted}`}>MRP ₹</span>
          <span className={`text-xs ${muted}`}>Selling ₹</span>
          {showCost && <span className={`text-xs ${muted}`}>Purchase ₹</span>}
          {sizes.map((size) => {
            const mine = hasOwnText(own[size]);
            return (
              <Fragment key={size}>
                <span className={`break-words text-sm font-semibold ${mine ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                  {named && <input type="hidden" name="rateSize" value={size} />}
                  {size}
                </span>
                {fields.map((field) => {
                  const value = own[size]?.[field] ?? '';
                  return (
                    <input
                      key={field}
                      name={named ? sizeFieldName(field, size) : undefined}
                      inputMode="decimal"
                      value={value}
                      onChange={(e) => onChange({ ...own, [size]: { ...own[size], [field]: e.target.value } })}
                      placeholder={placeholder(size, field)}
                      aria-label={`Size ${size} ${FIELD_LABEL[field]}`}
                      className={value.trim() ? ownBox : defaultBox}
                    />
                  );
                })}
              </Fragment>
            );
          })}
        </div>
        {ownSizes.length > 0 && (
          <button type="button" onClick={() => onChange({})} className={`${secondaryButton} self-start`}>
            All sizes back to default
          </button>
        )}
      </div>
    </details>
  );
}
