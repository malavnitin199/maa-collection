'use client';

import { unstable_rethrow, useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { IconCamera, IconPencil } from '@/components/ui/icons';
import { ActionSheet, sheetDanger, sheetPrimary, sheetSecondary } from '@/components/ui/selection';
import { errorBox } from '@/components/ui/styles';
import { useDone } from '@/features/feedback/effects';
import { haptic } from '@/features/feedback/sounds';
import { useT } from '@/features/i18n/i18n-provider';
import { removeProductPhotoAction, setProductPhotoAction } from '@/server/actions/admin';
import { photoForm, usePhotoPicker, type PickedPhoto } from './photo-slot';

/**
 * The product's one photo on its page (owner, 2026-11-23, ADR-068). A product has many sizes
 * but one picture. The box at the top of the page shows it; a tap opens a sheet with the big
 * photo and, for people with the Catalog right, 📷 Take photo · 🖼 From gallery (a new
 * photo replaces the old one on every size) and Remove photo (asked once more). With no
 * photo yet, the box itself says Add photo. The photo is made small on the phone first.
 */
export function ProductPhoto({ productId, src, name, sizes, canEdit }: { productId: string; src: string | null; name: string; sizes: number; canEdit: boolean }) {
  const t = useT();
  const router = useRouter();
  const done = useDone();
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedPhoto | null>(null);
  const [saving, startSaving] = useTransition();

  /** The picked photo's local address, freed once it is no longer needed. */
  const previewUrl = useRef<string | null>(null);
  const forget = () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setPicked(null);
  };
  const close = () => {
    // Not while a photo is being made small or saved: the save would finish unseen.
    if (saving || picker.busy) return;
    forget();
    setOpen(false);
    setAsking(false);
    setError(null);
  };
  const finish = (title: string, lines?: { label: string; value: string }[]) => {
    haptic(14);
    forget();
    setOpen(false);
    setAsking(false);
    done.show({ title, lines });
    router.refresh();
  };
  const failed = (message: string) => {
    forget();
    setError(message);
    done.show({ kind: 'error', title: t('done.notSaved'), detail: message });
  };

  const save = (photo: PickedPhoto | null) => {
    if (!photo) return;
    if (previewUrl.current && previewUrl.current !== photo.url) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = photo.url;
    setPicked(photo);
    setError(null);
    setAsking(false);
    startSaving(async () => {
      try {
        const result = await setProductPhotoAction(productId, photoForm(photo));
        if (!result.ok) return failed(result.error);
        finish(t(src ? 'ied.photo.changed' : 'ied.photo.added'), [{ label: t('ied.photo.sizes'), value: String(result.sizes) }]);
      } catch (error) {
        unstable_rethrow(error); // Next's own moves (e.g. to Log in) are not a lost connection
        failed(t('ied.photo.noNet')); // weak signal: the request or its answer was lost
        router.refresh(); // in case it did reach the shop
      }
    });
  };
  const remove = () =>
    startSaving(async () => {
      setError(null);
      try {
        const result = await removeProductPhotoAction(productId);
        if (!result.ok) return failed(result.error);
        finish(t('ied.photo.removed'));
      } catch (error) {
        unstable_rethrow(error);
        failed(t('ied.photo.noNet'));
        router.refresh();
      }
    });
  const picker = usePhotoPicker({ label: t('ied.photo.this'), photo: picked, onChange: save });

  const shown = picked?.url ?? src;
  if (!src && !canEdit) {
    return (
      <span data-testid="item-photo-na" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-sm font-semibold text-zinc-400 dark:bg-zinc-800">
        {t('common.na')}
      </span>
    );
  }

  return (
    <>
      {done.node}
      {picker.inputs}
      <div className="relative h-20 w-20 shrink-0">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own resized photos
          <img src={src} alt={name} className="h-full w-full rounded-2xl object-cover ring-1 ring-zinc-200 dark:ring-zinc-800" />
        ) : (
          <span
            data-testid="item-photo-add"
            className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-200"
          >
            <IconCamera className="h-6 w-6" />
            <span className="px-1 text-center text-[0.7rem] leading-tight font-bold">{t('ied.photo.add')}</span>
          </span>
        )}
        {src && canEdit && (
          <span aria-hidden className="absolute -right-1.5 -bottom-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white shadow-md ring-2 ring-surface">
            <IconPencil className="h-3.5 w-3.5" />
          </span>
        )}
        {/* The whole box is the button (the photo stays outside it, so it keeps its own name). */}
        <button
          type="button"
          data-testid="item-photo-button"
          aria-label={src ? (canEdit ? t('ied.photo.change') : t('ied.photo.open', { name })) : t('ied.photo.add')}
          onClick={() => {
            setError(null);
            picker.clearError();
            setOpen(true);
          }}
          className="absolute inset-0 rounded-2xl transition outline-none focus-visible:ring-2 focus-visible:ring-brand-500 active:scale-95 active:bg-black/5"
        />
      </div>

      {open && (
        <ActionSheet title={t('ied.photo.title')} onClose={close}>
          <div data-testid="photo-sheet" className="flex flex-col gap-3">
            {shown && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- our own resized photos, or the one just picked */}
                <img src={shown} alt={name} className={`max-h-[48vh] w-full rounded-2xl bg-zinc-100 object-contain dark:bg-zinc-900 ${saving ? 'opacity-60' : ''}`} />
                {saving && (
                  <span role="status" className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-slate-900/80 px-3 py-1 text-sm font-semibold text-white">
                    {t('ied.photo.saving')}
                  </span>
                )}
              </div>
            )}
            {!shown && saving && (
              <p role="status" className="text-center text-sm font-semibold">
                {t('ied.photo.saving')}
              </p>
            )}
            {canEdit && !asking && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={saving || picker.busy} onClick={picker.openCamera} className={sheetPrimary}>
                  {t('ied.photo.camera')}
                </button>
                <button type="button" disabled={saving || picker.busy} onClick={picker.openGallery} className={sheetSecondary}>
                  {t('ied.photo.gallery')}
                </button>
              </div>
            )}
            {(picker.error || error) && (
              <p role="alert" className={errorBox}>
                {picker.error ?? error}
              </p>
            )}
            {canEdit && src && !picked && !asking && (
              <button type="button" disabled={saving} onClick={() => setAsking(true)} className="min-h-11 text-base font-semibold text-red-600 disabled:opacity-50 dark:text-red-400">
                {t('ied.photo.remove')}
              </button>
            )}
            {asking && (
              <>
                <p className="text-center font-semibold">{sizes > 1 ? t('ied.photo.removeAsk.other', { n: sizes }) : t('ied.photo.removeAsk.one')}</p>
                <button type="button" disabled={saving} onClick={remove} className={sheetDanger}>
                  {saving ? t('common.saving') : t('ied.photo.removeYes')}
                </button>
                <button type="button" disabled={saving} onClick={() => setAsking(false)} className={sheetSecondary}>
                  {t('ied.photo.keep')}
                </button>
              </>
            )}
            {!asking && (
              <button type="button" disabled={saving || picker.busy} onClick={close} className={sheetSecondary}>
                {t('ied.photo.close')}
              </button>
            )}
          </div>
        </ActionSheet>
      )}
    </>
  );
}
