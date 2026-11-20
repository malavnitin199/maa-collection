'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Speak to fill a box (owner's feedback 2026-11-20): the browser's speech
 * recognition (Chrome / Samsung Internet / Safari on the phone; the audio goes
 * through the browser's own service). Hindi or English by `lang`. One phrase
 * per tap; interim words show while speaking.
 */
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionMaker = new () => Recognition;

function maker(): RecognitionMaker | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionMaker; webkitSpeechRecognition?: RecognitionMaker };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechInputSupported(): boolean {
  return maker() !== null;
}

export type SpeechError = 'denied' | 'nothing' | 'failed';

export function useSpeechInput({ lang, onFinal, onInterim }: { lang: 'hi' | 'en'; onFinal: (text: string) => void; onInterim?: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<SpeechError | null>(null);
  const current = useRef<Recognition | null>(null);
  const latest = useRef({ onFinal, onInterim });
  useEffect(() => {
    latest.current = { onFinal, onInterim };
  });
  useEffect(() => {
    const live = current;
    return () => live.current?.abort();
  }, []);

  const stop = () => {
    current.current?.stop();
  };
  const start = () => {
    const Maker = maker();
    if (!Maker) return;
    if (current.current) return stop();
    const recognition = new Maker();
    recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    let heard = '';
    recognition.onresult = (e) => {
      let interim = '';
      heard = '';
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) heard += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (interim) latest.current.onInterim?.(interim);
    };
    recognition.onerror = (e) => {
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : e.error === 'no-speech' ? 'nothing' : e.error === 'aborted' ? null : 'failed');
    };
    recognition.onend = () => {
      current.current = null;
      setListening(false);
      const text = heard.trim();
      if (text) latest.current.onFinal(text);
    };
    current.current = recognition;
    setError(null);
    setListening(true);
    try {
      recognition.start();
    } catch {
      current.current = null;
      setListening(false);
      setError('failed');
    }
  };
  return { listening, error, start, stop, clearError: () => setError(null) };
}
