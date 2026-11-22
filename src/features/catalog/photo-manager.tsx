'use client';

import { useRef } from 'react';
import { secondaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';

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

