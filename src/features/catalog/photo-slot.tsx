'use client';

import { useRef, useState } from 'react';
import { secondaryButton } from '@/components/ui/styles';
import { resizePhoto } from './resize-photo';

/** A photo picked on the phone, already made small (~100–250 KB JPEG). */
export type PickedPhoto = { blob: Blob; width: number; height: number; url: string };

/** The FormData that `addPhotoToItemsAction` expects. */
export function photoForm(photo: PickedPhoto): FormData {
  const form = new FormData();
  form.set('photo', new File([photo.blob], 'photo.jpg', { type: 'image/jpeg' }));
  form.set('width', String(photo.width));
  form.set('height', String(photo.height));
  return form;
}

/**
 * Optional photo while creating tags: 📷 camera or 🖼 gallery, a small preview
 * and ✕ to remove. The photo is resized on the phone before it is kept.
 */
export function PhotoSlot({
  label,
  photo,
  onChange,
  disabled,
}: {
  /** What the photo is of, e.g. "Blue" or "Product 2" (used in the button names). */
  label: string;
  photo: PickedPhoto | null;
  onChange: (photo: PickedPhoto | null) => void;
  disabled?: boolean;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(input: HTMLInputElement | null) {
    const file = input?.files?.[0];
    if (input) input.value = '';
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const { blob, width, height } = await resizePhoto(file);
      if (photo) URL.revokeObjectURL(photo.url);
      onChange({ blob, width, height, url: URL.createObjectURL(blob) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not use that photo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a resized photo */}
          <img src={photo.url} alt={`Photo for ${label}`} className="h-12 w-12 rounded-lg border border-zinc-200 object-cover dark:border-zinc-800" />
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              URL.revokeObjectURL(photo.url);
              onChange(null);
            }}
            className={`${secondaryButton} py-1.5`}
            aria-label={`Remove photo for ${label}`}
          >
            ✕ Remove
          </button>
        </>
      ) : (
        <>
          <button type="button" disabled={disabled || busy} onClick={() => camera.current?.click()} className={`${secondaryButton} py-1.5`} aria-label={`Take photo for ${label}`}>
            📷 Photo
          </button>
          <button type="button" disabled={disabled || busy} onClick={() => gallery.current?.click()} className={`${secondaryButton} py-1.5`} aria-label={`Choose photo for ${label} from gallery`}>
            🖼 Gallery
          </button>
          {busy && <span className="text-xs text-zinc-500">Preparing…</span>}
        </>
      )}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden aria-label={`Camera for ${label}`} onChange={(e) => pick(e.currentTarget)} />
      <input ref={gallery} type="file" accept="image/*" hidden aria-label={`Gallery for ${label}`} onChange={(e) => pick(e.currentTarget)} />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
