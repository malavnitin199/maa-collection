'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  onDecode: (text: string) => void;
  onClose: () => void;
};

function describeCameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError') return 'Camera permission was denied. Allow camera access and try again.';
  if (name === 'NotFoundError') return 'No camera found on this device.';
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Camera needs HTTPS (or localhost). Open the https:// address.';
  }
  return 'Could not start the camera.';
}

/** Uses the rear camera to read QR codes and 1D barcodes; closes after one decode. */
export function CameraScanner({ onDecode, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDecodeRef = useRef(onDecode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onDecodeRef.current = onDecode;
  });

  useEffect(() => {
    let cancelled = false;
    let controls: { stop: () => void } | undefined;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const video = videoRef.current;
        if (!video || cancelled) return;
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          video,
          (result) => {
            if (!result) return;
            controls?.stop();
            onDecodeRef.current(result.getText());
          },
        );
        if (cancelled) controls.stop();
      } catch (caught) {
        if (!cancelled) setError(describeCameraError(caught));
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Camera scan</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Close
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : (
        <>
          <video
            ref={videoRef}
            muted
            playsInline
            className="aspect-[4/3] w-full rounded-lg bg-black object-cover"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Point the camera at a QR code or barcode. It reads automatically.
          </p>
        </>
      )}
    </section>
  );
}
