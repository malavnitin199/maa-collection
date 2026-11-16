'use client';

import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '@/features/i18n/i18n-provider';
import type { MessageKey } from '@/lib/i18n';

type Props = {
  onDecode: (text: string) => void;
  onClose: () => void;
};

type Engine = 'native' | 'zxing';

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'environment',
  // Thin barcode bars need pixels: without a size hint many phones send 640×480,
  // which blurs EAN-13 bars together (QR codes survive, barcodes don't).
  width: { ideal: 1920 },
  height: { ideal: 1080 },
};

// Browser-native BarcodeDetector (Chrome on Android, via the phone's own scanner).
// Not in TypeScript's DOM types yet, so declare the small part we use.
type NativeDetector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
type NativeDetectorClass = {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats(): Promise<string[]>;
};
const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'];

// zxing DecodeHintType values (the enum isn't re-exported by @zxing/browser).
const HINT_POSSIBLE_FORMATS = 2;
const HINT_TRY_HARDER = 3;

function describeCameraError(error: unknown): MessageKey {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError') return 'scan.errDenied';
  if (name === 'NotFoundError') return 'scan.errNoCamera';
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'scan.errHttps';
  return 'scan.errStart';
}

async function createNativeDetector(): Promise<NativeDetector | null> {
  const Detector = (window as unknown as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
  if (!Detector) return null;
  try {
    const supported = await Detector.getSupportedFormats();
    const formats = NATIVE_FORMATS.filter((format) => supported.includes(format));
    if (!formats.includes('ean_13') || !formats.includes('qr_code')) return null;
    return new Detector({ formats });
  } catch {
    return null;
  }
}

async function enableContinuousFocus(stream: MediaStream) {
  const [track] = stream.getVideoTracks();
  try {
    const capabilities = track?.getCapabilities?.() as { focusMode?: string[] } | undefined;
    if (capabilities?.focusMode?.includes('continuous')) {
      await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] });
    }
  } catch {
    // Focus control is optional; the camera's default focus still works.
  }
}

/** Decodes frames from a playing video until stopped; reports every read via onText. */
async function startDecoding(
  video: HTMLVideoElement,
  onText: (text: string) => void,
): Promise<{ engine: Engine; stop: () => void }> {
  const native = await createNativeDetector();
  if (native) {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (stopped) return;
      try {
        if (video.readyState >= 2) {
          const [code] = await native.detect(video);
          if (code?.rawValue && !stopped) onText(code.rawValue);
        }
      } catch {
        // A single failed frame is fine; try the next one.
      }
      if (!stopped) timer = setTimeout(tick, 80);
    };
    void tick();
    return {
      engine: 'native',
      stop: () => {
        stopped = true;
        clearTimeout(timer);
      },
    };
  }

  // Fallback (e.g. iPhone Safari): zxing, fed with our own frames. We don't use
  // zxing's own video loop because its TRY_HARDER rotation is broken in
  // @zxing/browser 0.2.1 (it rotates the pixels but keeps the old width/height),
  // and it decodes only the full, unzoomed frame.
  const { BrowserMultiFormatReader, BarcodeFormat } = await import('@zxing/browser');
  const hints = new Map<number, unknown>([
    [
      HINT_POSSIBLE_FORMATS,
      [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE],
    ],
    // Scan many rows of each frame, not just a few.
    [HINT_TRY_HARDER, true],
  ]);
  const reader = new BrowserMultiFormatReader(hints);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is not available.');

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  const tick = () => {
    if (stopped) return;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width && height) {
      // Rotate through three views, one per tick, to keep each tick fast.
      drawView(context, canvas, video, width, height, FRAME_VIEWS[attempt++ % FRAME_VIEWS.length]);
      try {
        onText(reader.decodeFromCanvas(canvas).getText());
      } catch {
        // Nothing found in this view; try the next one.
      }
    }
    if (!stopped) timer = setTimeout(tick, 50);
  };
  tick();
  return {
    engine: 'zxing',
    stop: () => {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

// full: the whole frame. zoom: the guide-box band, enlarged 2× so small or
// distant barcodes have wider bars. sideways: the frame turned 90°, for a
// barcode held vertically.
const FRAME_VIEWS = ['full', 'zoom', 'sideways'] as const;
type FrameView = (typeof FRAME_VIEWS)[number];
const MAX_CANVAS_SIDE = 2400;

function drawView(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  width: number,
  height: number,
  view: FrameView,
) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  if (view === 'full') {
    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0);
  } else if (view === 'zoom') {
    const cropWidth = width * 0.9;
    const cropHeight = Math.min(height, width * 0.45);
    const scale = Math.min(2, MAX_CANVAS_SIDE / cropWidth);
    canvas.width = Math.round(cropWidth * scale);
    canvas.height = Math.round(cropHeight * scale);
    context.drawImage(
      video,
      (width - cropWidth) / 2,
      (height - cropHeight) / 2,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  } else {
    canvas.width = height;
    canvas.height = width;
    context.translate(height, 0);
    context.rotate(Math.PI / 2);
    context.drawImage(video, 0, 0);
  }
}

/** Uses the rear camera to read QR codes and 1D barcodes; closes after one decode. */
export function CameraScanner({ onDecode, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDecodeRef = useRef(onDecode);
  const onCloseRef = useRef(onClose);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const t = useT();
  const titleId = useId();
  const [engine, setEngine] = useState<Engine | null>(null);

  useEffect(() => {
    onDecodeRef.current = onDecode;
  });

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        closeButtonRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let decoded = false;
    let stream: MediaStream | undefined;
    let stopDecoding: (() => void) | undefined;

    const release = () => {
      stopDecoding?.();
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    // Readers can report a frame before startDecoding resolves, and keep
    // reporting afterwards: act on the first read only.
    const handleText = (text: string) => {
      if (decoded || cancelled) return;
      decoded = true;
      release();
      onDecodeRef.current(text);
    };

    (async () => {
      try {
        const video = videoRef.current;
        if (!video) return;
        stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS, audio: false });
        if (cancelled) return release();
        video.srcObject = stream;
        await video.play();
        await enableContinuousFocus(stream);
        if (cancelled) return release();
        const started = await startDecoding(video, handleText);
        stopDecoding = started.stop;
        if (cancelled || decoded) return release();
        setEngine(started.engine);
      } catch (caught) {
        release();
        if (!cancelled) setError(describeCameraError(caught));
      }
    })();

    return () => {
      cancelled = true;
      release();
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-2xl border border-zinc-200 bg-surface p-4 text-zinc-900 shadow-2xl dark:border-zinc-700 dark:text-zinc-100 sm:max-h-[calc(100dvh-3rem)]"
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="font-semibold">{t('scan.cameraTitle')}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {t('scan.close')}
          </button>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {t(error)}
          </p>
        ) : (
          <>
            <div className="relative overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-[8%] top-1/2 h-[38%] -translate-y-1/2 rounded-lg border-2 border-brand-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
              />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('scan.cameraHint')}{' '}
              {engine && (
                <span data-testid="scan-engine">
                  ({t(engine === 'native' ? 'scan.engineNative' : 'scan.engineWeb')})
                </span>
              )}
            </p>
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}
