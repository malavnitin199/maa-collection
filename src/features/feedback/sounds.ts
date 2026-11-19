/**
 * Scan / sale sounds made by the browser (Web Audio API) — no audio files.
 * Like payment apps: a short bright "ting" for a good scan, a rising two-tone
 * chime when a sale is done, a soft low buzz when a scan fails. Plus a short
 * vibration on phones. Everything is a no-op where the browser can't do it.
 * The on/off setting is per phone (default on).
 */

const SOUND_KEY = 'maa-sound';
const CHANGE = 'maa-sound-change';

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE));
}

export function subscribeSound(onChange: () => void): () => void {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener('storage', onChange);
  };
}

type AudioCtor = typeof AudioContext;
let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context ??= new Ctor();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

/** Phones only allow sound after a touch or key press: call this from one (e.g. the first tap on the page). */
export function unlockAudio(): void {
  audio();
}

type Tone = { freq: number; at: number; length: number; type?: OscillatorType; volume?: number; glideTo?: number };

function play(tones: Tone[]): void {
  const ctx = audio();
  if (!ctx) return;
  const start = ctx.currentTime + 0.01;
  for (const tone of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = start + tone.at;
    const end = t0 + tone.length;
    osc.type = tone.type ?? 'sine';
    osc.frequency.setValueAtTime(tone.freq, t0);
    if (tone.glideTo) osc.frequency.exponentialRampToValueAtTime(tone.glideTo, t0 + tone.length * 0.5);
    // Quick attack, smooth exponential fade: a bell-like "ting", no clicks.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(tone.volume ?? 0.2, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(end + 0.02);
  }
}

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported (e.g. iPhone): nothing to do.
  }
}

/** A short buzz for taps that change something (selecting an item, plan v17). Respects the phone's on/off setting. */
export function haptic(pattern: number | number[] = 10): void {
  if (soundEnabled()) vibrate(pattern);
}

export type Feedback = 'scan' | 'done' | 'error';

/** Sound + vibration for a moment at the counter (respects the phone's on/off setting). */
export function feedback(kind: Feedback): void {
  if (!soundEnabled()) return;
  if (kind === 'scan') {
    play([{ freq: 1568, at: 0, length: 0.16, volume: 0.18 }, { freq: 3136, at: 0, length: 0.08, volume: 0.04 }]);
    vibrate(35);
  } else if (kind === 'done') {
    play([
      { freq: 1046.5, at: 0, length: 0.22, volume: 0.2 },
      { freq: 1568, at: 0.13, length: 0.45, volume: 0.22 },
      { freq: 2093, at: 0.13, length: 0.3, volume: 0.05 },
    ]);
    vibrate([40, 60, 90]);
  } else {
    play([
      { freq: 220, at: 0, length: 0.14, type: 'triangle', volume: 0.16, glideTo: 180 },
      { freq: 196, at: 0.17, length: 0.16, type: 'triangle', volume: 0.14, glideTo: 160 },
    ]);
    vibrate([80, 50, 80]);
  }
}
