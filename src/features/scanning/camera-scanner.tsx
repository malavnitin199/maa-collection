'use client';

import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useT } from '@/features/i18n/i18n-provider';
import type { MessageKey } from '@/lib/i18n';

type Props = {
  onDecode: (text: string) => void;
  onClose: () => void;
  /** Stay on after a read and report every new tag (several items on one bill). */
  keepOpen?: boolean;
  /** Shown under the picture, e.g. the last item added and its price box. */
  footer?: ReactNode;
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

/** A read of the same code this soon again is the same tag still in view, not a second piece. */
const SAME_CODE_MS = 2500;
/** After any read, a short pause so the person can move to the next tag. */
const PAUSE_MS = 900;

/**
 * Uses the rear camera to read QR codes and 1D barcodes, on the whole screen
 * (owner's feedback 2026-11-21: easier to aim). Closes after one read, unless
 * `keepOpen` (several items on one bill): then every read is reported and the
 * camera stays on; `footer` shows under the picture (what was added, a price box…).
 */
export function CameraScanner({ onDecode, onClose, keepOpen = false, footer }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDecodeRef = useRef(onDecode);
  const onCloseRef = useRef(onClose);
  const keepOpenRef = useRef(keepOpen);
  const dialogRef = useRef<HTMLElement>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [flash, setFlash] = useState(0);
  const t = useT();
  const titleId = useId();
  const [engine, setEngine] = useState<Engine | null>(null);

  useEffect(() => {
    onDecodeRef.current = onDecode;
    onCloseRef.current = onClose;
    keepOpenRef.current = keepOpen;
  });

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
    // The page under the camera does not scroll while it is open.
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
      } else if (event.key === 'Tab') {
        // Keep focus inside the camera screen.
        const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button, input, select, a[href]') ?? [])].filter((el) => !el.hasAttribute('disabled'));
        if (items.length === 0) return;
        const at = items.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : at === -1 || at === items.length - 1 ? 0 : at + 1;
        event.preventDefault();
        items[next].focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let decoded = false;
    let stream: MediaStream | undefined;
    let stopDecoding: (() => void) | undefined;
    let last: { code: string; at: number } | null = null;

    const release = () => {
      stopDecoding?.();
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    // Readers can report a frame before startDecoding resolves, and keep
    // reporting afterwards: act on the first read only — or, kept open, on each
    // new tag after a short pause.
    const handleText = (text: string) => {
      if (decoded || cancelled) return;
      if (keepOpenRef.current) {
        const now = Date.now();
        if (last && (now - last.at < PAUSE_MS || (last.code === text && now - last.at < SAME_CODE_MS))) return;
        last = { code: text, at: now };
        setFlash((n) => n + 1);
        navigator.vibrate?.(30);
        onDecodeRef.current(text);
        return;
      }
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
    <section
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-testid="camera-screen"
      className="fixed inset-0 z-[100] flex flex-col bg-black text-white outline-none"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {!error && <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" />}
        {/* Aim here: a wide box in the middle, the rest dimmed; it flashes green on each read. */}
        {!error && (
          <div
            aria-hidden
            key={flash}
            className={`pointer-events-none absolute inset-x-[7%] top-1/2 aspect-[16/10] max-h-[55%] -translate-y-1/2 rounded-2xl border-[3px] shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] ${flash ? 'cam-hit border-emerald-400' : 'border-white/90'}`}
          >
            <span className="cam-line absolute inset-x-3 top-1/2 h-0.5 rounded bg-red-500/80" />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold">
              {t('scan.cameraTitle')}
            </h2>
            <p className="text-sm text-white/80">
              {t(keepOpen ? 'scan.cameraHintMany' : 'scan.cameraHint')}{' '}
              {engine && (
                <span data-testid="scan-engine" className="text-white/60">
                  ({t(engine === 'native' ? 'scan.engineNative' : 'scan.engineWeb')})
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-white/15 px-4 py-2 text-sm font-semibold ring-1 ring-white/40 backdrop-blur active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {t('scan.close')}
          </button>
        </div>
        {error && (
          <p role="alert" className="absolute inset-x-4 top-1/3 rounded-2xl bg-red-950/80 p-4 text-center text-sm text-red-100">
            {t(error)}
          </p>
        )}
      </div>
      {footer && <div className="shrink-0 bg-zinc-950 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
    </section>,
    document.body,
  );
}
