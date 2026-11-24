'use client';

import { useState } from 'react';
import { IconCamera } from '@/components/ui/icons';
import { ActionSheet, sheetPrimary, sheetSecondary } from '@/components/ui/selection';
import { errorBox } from '@/components/ui/styles';
import { haptic } from '@/features/feedback/sounds';
import { useT } from '@/features/i18n/i18n-provider';
import { usePhotoPicker, type PickedPhoto } from './photo-slot';

/**
 * New item's photo (owner, 2026-11-24, ADR-072): a small "Add photo" button on the details card.
 * A tap opens the same sheet as the product page — 📷 Take photo · 🖼 Gallery — and the picked
 * photo (made small on the phone) waits here until the item is saved; then it becomes the
 * product's one photo, for every size. Tap again to change or remove it. Optional.
 */
export function NewItemPhoto({ photo, onChange, disabled = false }: { photo: PickedPhoto | null; onChange: (photo: PickedPhoto | null) => void; disabled?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const picker = usePhotoPicker({
    label: t('ied.photo.this'),
    photo,
    onChange: (next) => {
      onChange(next);
      // Picked: back to the form, the button shows it.
      if (next) {
        haptic(14);
        setOpen(false);
      }
    },
  });
  const close = () => {
    if (picker.busy) return; // the photo is being made small: it would land unseen
    picker.clearError();
    setOpen(false);
  };
  return (
    <span data-testid="ni-photo" className="shrink-0">
      {picker.inputs}
      <button
        type="button"
        data-testid="ni-photo-button"
        data-has-photo={photo ? '' : undefined}
        disabled={disabled}
        onClick={() => {
          picker.clearError();
          setOpen(true);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-50 py-1 pr-3 pl-1 text-xs font-bold text-brand-700 ring-1 ring-brand-200 transition active:scale-95 disabled:opacity-50 dark:bg-brand-950 dark:text-brand-200 dark:ring-brand-800"
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview of a resized photo
          <img src={photo.url} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-brand-200 dark:ring-brand-800" />
        ) : (
          <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white">
            <IconCamera className="h-4 w-4" />
          </span>
        )}
        {photo ? t('ied.photo.change') : t('ied.photo.add')}
      </button>

      {open && (
        <ActionSheet title={t('ied.photo.title')} onClose={close}>
          <div data-testid="ni-photo-sheet" className="flex flex-col gap-3">
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element -- local preview of a resized photo
              <img src={photo.url} alt={t('stk.photo.alt', { label: t('ied.photo.this') })} className="max-h-[48vh] w-full rounded-2xl bg-zinc-100 object-contain dark:bg-zinc-900" />
            )}
            {picker.busy && (
              <p role="status" className="text-center text-sm font-semibold">
                {t('stk.photo.preparing')}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={picker.busy} onClick={picker.openCamera} className={sheetPrimary}>
                {t('ied.photo.camera')}
              </button>
              <button type="button" disabled={picker.busy} onClick={picker.openGallery} className={sheetSecondary}>
                {t('ied.photo.gallery')}
              </button>
            </div>
            {picker.error && (
              <p role="alert" className={errorBox}>
                {picker.error}
              </p>
            )}
            {photo && (
              <button
                type="button"
                disabled={picker.busy}
                onClick={() => {
                  picker.remove();
                  setOpen(false);
                }}
                className="min-h-11 text-base font-semibold text-red-600 disabled:opacity-50 dark:text-red-400"
              >
                {t('ied.photo.remove')}
              </button>
            )}
            <button type="button" disabled={picker.busy} onClick={close} className={sheetSecondary}>
              {t('ied.photo.close')}
            </button>
          </div>
        </ActionSheet>
      )}
    </span>
  );
}
