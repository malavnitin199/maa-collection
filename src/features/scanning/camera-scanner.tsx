'use client';

import { useEffect, useRef, useState } from 'react';

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

function describeCameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError') return 'Camera permission was denied. Allow camera access and try again.';
  if (name === 'NotFoundError') return 'No camera found on this device.';
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Camera needs HTTPS (or localhost). Open the https:// address.';
  }
  return 'Could not start the camera.';
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

  const { BrowserMultiFormatReader, BarcodeFormat } = await import('@zxing/browser');
  const hints = new Map<number, unknown>([
    [
      HINT_POSSIBLE_FORMATS,
      [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE],
    ],
    // Scan many rows and also try the image rotated: finds small, tilted or sideways barcodes.
    [HINT_TRY_HARDER, true],
  ]);
  const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
  const controls = await reader.decodeFromVideoElement(video, (result) => {
    if (result) onText(result.getText());
  });
  return { engine: 'zxing', stop: () => controls.stop() };
}

/** Uses the rear camera to read QR codes and 1D barcodes; closes after one decode. */
export function CameraScanner({ onDecode, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDecodeRef = useRef(onDecode);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<Engine | null>(null);

  useEffect(() => {
    onDecodeRef.current = onDecode;
  });

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
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-[8%] top-1/2 h-[38%] -translate-y-1/2 rounded-lg border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
            />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Hold the barcode flat inside the box, about 15–20 cm away, until it is sharp. It reads
            automatically.{' '}
            {engine && (
              <span data-testid="scan-engine">
                ({engine === 'native' ? "phone's built-in scanner" : 'web scanner'})
              </span>
            )}
          </p>
        </>
      )}
    </section>
  );
}
