'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { errorBox, muted, secondaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import { deleteImageAction, makeMainImageAction, uploadProductImageAction } from '@/server/actions/admin';
import { resizePhoto } from './resize-photo';

type Photo = { id: string; src: string };

/** Hidden file inputs behind two big buttons: rear camera, or gallery (several at once). */
export function PhotoPickers({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const t = useT();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const pick = (input: HTMLInputElement | null) => {
    const files = Array.from(input?.files ?? []);
    if (input) input.value = '';
    if (files.length) onFiles(files);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" disabled={disabled} onClick={() => camera.current?.click()} className={`${secondaryButton} py-3 text-base`}>
        📷 {t('cat.photo.take')}
      </button>
      <button type="button" disabled={disabled} onClick={() => gallery.current?.click()} className={`${secondaryButton} py-3 text-base`}>
        🖼 {t('cat.photo.gallery')}
      </button>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden aria-label={t('cat.photo.take')} onChange={(e) => pick(e.currentTarget)} />
      <input ref={gallery} type="file" accept="image/*" multiple hidden aria-label={t('cat.photo.choose')} onChange={(e) => pick(e.currentTarget)} />
    </div>
  );
}

export function PhotoManager({ productId, photos, canEdit }: { productId: string; photos: Photo[]; canEdit: boolean }) {
  const t = useT();
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function upload(files: File[]) {
    setError(null);
    startTransition(async () => {
      for (const [index, file] of files.entries()) {
        setProgress(t('cat.photo.adding', { n: index + 1, total: files.length }));
        try {
          const { blob, width, height } = await resizePhoto(file);
          const form = new FormData();
          form.set('photo', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
          form.set('width', String(width));
          form.set('height', String(height));
          const result = await uploadProductImageAction(productId, form);
          if (result.error) {
            setError(result.error);
            break;
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : t('cat.photo.couldNotAdd'));
          break;
        }
      }
      setProgress(null);
      router.refresh();
    });
  }

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {photos.length === 0 ? (
        <p className={`text-sm ${muted}`}>{t('cat.photo.none')}{canEdit && ` ${t('cat.photo.addHint')}`}</p>
      ) : (
        <ul data-testid="product-photos" className="grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <li key={photo.id} className="flex flex-col gap-1">
              <div className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element -- our own resized photos, served with caching */}
                <img src={photo.src} alt={t('cat.photo.alt', { n: index + 1 })} className="h-full w-full object-cover" loading="lazy" />
                {index === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{t('cat.photo.main')}</span>
                )}
              </div>
              {canEdit && (
                <div className="flex justify-between text-xs">
                  {index > 0 ? (
                    <button type="button" disabled={busy} onClick={() => run(() => makeMainImageAction(photo.id))} className="text-emerald-700 dark:text-emerald-400">
                      {t('cat.photo.makeMain')}
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(t('cat.photo.confirmDelete'))) run(() => deleteImageAction(photo.id));
                    }}
                    className="text-red-600"
                    aria-label={t('cat.photo.deleteN', { n: index + 1 })}
                  >
                    {t('cat.photo.delete')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && <PhotoPickers onFiles={upload} disabled={busy} />}
      {progress && <p className={`text-sm ${muted}`}>{progress}</p>}
      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
    </div>
  );
}
