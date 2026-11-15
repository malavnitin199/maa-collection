/**
 * Read-aloud for the Guide (plan v9) with the phone's own voice: the Web Speech
 * API (`speechSynthesis`) — Google voices on Android, Siri voices on iPhone.
 * No audio files: the voice reads exactly the text on the screen, in the
 * person's language. One thing speaks at a time across the page.
 */
import type { Locale } from '@/lib/i18n';

const LANG: Record<Locale, string> = { en: 'en-IN', hi: 'hi-IN' };

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

/** Best voice for the language: exact region first (en-IN / hi-IN), then any of that language. */
export function voiceFor(locale: Locale): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  const want = LANG[locale].toLowerCase();
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();
  return voices.find((v) => norm(v) === want) ?? voices.find((v) => norm(v).startsWith(want.slice(0, 2))) ?? null;
}

/** Voices load late on some phones: true once the list has arrived and has none for this language. */
export function missingVoice(locale: Locale): boolean {
  if (!speechSupported()) return true;
  const voices = window.speechSynthesis.getVoices();
  return voices.length > 0 && !voiceFor(locale);
}

/** Screen text → speakable text: drop emoji and arrows, turn symbols into pauses or words. */
export function forSpeech(text: string, locale: Locale): string {
  return text
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, ' ')
    .replace(/[✓✔✕✗✎✏]/g, ' ')
    .replace(/[→⟶➜›»]/g, ', ')
    .replace(/[·•]/g, ', ')
    .replace(/×/g, locale === 'hi' ? ' और ' : ' by ')
    .replace(/…/g, '.')
    .replace(/\s+([,.;:!?।])/g, '$1')
    .replace(/(,\s*)+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Kept in a module variable: Chrome drops `onend` if the utterance is garbage-collected.
let current: SpeechSynthesisUtterance | null = null;

/**
 * Speak one piece of text; `onEnd(true)` when it finished, `onEnd(false)` if it
 * was stopped or failed. Returns a function that stops it without calling onEnd.
 */
export function say(text: string, { locale, slow = false, onEnd }: { locale: Locale; slow?: boolean; onEnd?: (finished: boolean) => void }): () => void {
  if (!speechSupported()) {
    onEnd?.(false);
    return () => {};
  }
  const synth = window.speechSynthesis;
  if (current) {
    current.onend = null;
    current.onerror = null;
  }
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(forSpeech(text, locale));
  utterance.lang = LANG[locale];
  const voice = voiceFor(locale);
  if (voice) utterance.voice = voice;
  utterance.rate = slow ? 0.75 : 0.95;
  let done = false;
  const finish = (finished: boolean) => {
    if (done) return;
    done = true;
    if (current === utterance) current = null;
    onEnd?.(finished);
  };
  utterance.onend = () => finish(true);
  utterance.onerror = (e) => finish(e.error === 'interrupted' || e.error === 'canceled' ? false : true);
  current = utterance;
  synth.speak(utterance);
  return () => {
    utterance.onend = null;
    utterance.onerror = null;
    done = true;
    if (current === utterance) current = null;
    synth.cancel();
  };
}

export function stopSpeaking(): void {
  if (!speechSupported()) return;
  if (current) {
    current.onend = null;
    current.onerror = null;
    current = null;
  }
  window.speechSynthesis.cancel();
}

/*
 * One reader at a time, and "Listen to all": players announce themselves on
 * window events. `guide-voice-start` {id} stops every other player;
 * `guide-voice-play` {id} asks a lesson to start (queue); `guide-voice-ended` {id}
 * says a lesson finished by itself, so the queue moves on.
 */
export const VOICE_START = 'guide-voice-start';
export const VOICE_PLAY = 'guide-voice-play';
export const VOICE_ENDED = 'guide-voice-ended';

let queue: string[] = [];

export function announce(type: string, id: string): void {
  window.dispatchEvent(new CustomEvent(type, { detail: { id } }));
}

/** Play these lessons one after another. */
export function playQueue(ids: string[]): void {
  queue = [...ids];
  const first = queue.shift();
  if (first) announce(VOICE_PLAY, first);
}

export function clearQueue(): void {
  queue = [];
}

/** Called when a lesson finished by itself: start the next one in the queue, if any. */
export function nextInQueue(): void {
  const next = queue.shift();
  if (next) announce(VOICE_PLAY, next);
}
