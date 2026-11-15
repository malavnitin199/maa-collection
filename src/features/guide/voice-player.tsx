'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { IconNext, IconPause, IconPlay, IconPrev, IconSound, IconStop } from '@/components/ui/icons';
import { useLocale, useT } from '@/features/i18n/i18n-provider';
import { useHydrated } from '@/features/scanning/scan-input';
import {
  announce,
  clearQueue,
  missingVoice,
  nextInQueue,
  playQueue,
  say,
  speechSupported,
  stopSpeaking,
  VOICE_ENDED,
  VOICE_PLAY,
  VOICE_START,
} from './voice';

/*
 * What a lesson reads: every element marked `data-voice` inside the lesson's
 * <section id=…>, in page order. Inside one, only `data-voice-text` parts are
 * read (so step numbers and the "Lesson 3 · 2 min" line are skipped).
 */
function voiceItems(lessonId: string): HTMLElement[] {
  return Array.from(document.getElementById(lessonId)?.querySelectorAll<HTMLElement>('[data-voice]') ?? []);
}

function spokenText(el: HTMLElement): string {
  const parts = Array.from(el.querySelectorAll<HTMLElement>('[data-voice-text]'));
  return (parts.length ? parts : [el])
    .map((n) => n.textContent?.trim() ?? '')
    .filter(Boolean)
    .join('. ');
}

function highlight(el: HTMLElement | null) {
  document.querySelectorAll('.voice-now').forEach((n) => {
    n.classList.remove('voice-now');
    n.removeAttribute('aria-current');
  });
  if (!el) return;
  el.classList.add('voice-now');
  el.setAttribute('aria-current', 'step');
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView?.({ block: 'center', behavior: still ? 'auto' : 'smooth' });
}

const control =
  'inline-flex h-10 w-10 items-center justify-center rounded-full text-brand-800 transition hover:bg-brand-100 active:scale-90 disabled:opacity-40 dark:text-brand-200 dark:hover:bg-zinc-800';

/**
 * ▶ Listen on a lesson: the phone reads the lesson in the person's language,
 * lighting up the step being read. Pause, back, next, stop, slow.
 */
export function LessonVoice({ id, title }: { id: string; title: string }) {
  const t = useT();
  const locale = useLocale();
  const hydrated = useHydrated();
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [slow, setSlow] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  const stopRef = useRef<() => void>(() => {});
  const stateRef = useRef(state);
  const slowRef = useRef(slow);
  // The next step starts from the voice's "finished" callback, through this ref.
  const playFromRef = useRef<(i: number) => void>(() => {});
  useEffect(() => {
    stateRef.current = state;
    slowRef.current = slow;
  });

  const finish = useCallback(() => {
    highlight(null);
    setState('idle');
    setIndex(0);
    announce(VOICE_ENDED, id);
    nextInQueue();
  }, [id]);

  const playFrom = useCallback(
    (i: number) => {
      const list = voiceItems(id);
      setTotal(list.length);
      if (i >= list.length) return finish();
      const at = Math.max(0, i);
      setIndex(at);
      setState('playing');
      stateRef.current = 'playing';
      setNoVoice(missingVoice(locale));
      highlight(list[at]);
      stopRef.current = say(spokenText(list[at]), {
        locale,
        slow: slowRef.current,
        onEnd: (finished) => {
          if (finished && stateRef.current === 'playing') playFromRef.current(at + 1);
        },
      });
    },
    [finish, id, locale],
  );
  useEffect(() => {
    playFromRef.current = playFrom;
  }, [playFrom]);

  const start = useCallback(
    (from = 0) => {
      announce(VOICE_START, id); // others stop
      playFrom(from);
    },
    [id, playFrom],
  );

  const stop = useCallback(() => {
    stopRef.current();
    highlight(null);
    setState('idle');
    setIndex(0);
  }, []);

  useEffect(() => {
    const onStart = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail.id !== id && stateRef.current !== 'idle') {
        stopRef.current();
        setState('idle');
        setIndex(0);
      }
    };
    const onPlay = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail.id === id) start(0);
    };
    window.addEventListener(VOICE_START, onStart);
    window.addEventListener(VOICE_PLAY, onPlay);
    return () => {
      window.removeEventListener(VOICE_START, onStart);
      window.removeEventListener(VOICE_PLAY, onPlay);
    };
  }, [id, start]);

  // Leaving the page stops the voice.
  useEffect(() => () => stopRef.current(), []);

  if (!hydrated || !speechSupported()) return null;

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={() => {
          clearQueue();
          start(0);
        }}
        aria-label={t('guide.listenTo', { title })}
        className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-700/25 transition hover:bg-brand-700 active:scale-95"
      >
        <IconPlay className="h-4 w-4" />
        {t('guide.listen')}
      </button>
    );
  }

  return (
    // Stays in view under the header while the lesson is read (only inside its own lesson).
    <div className="sticky top-[6.75rem] z-[5] flex flex-col gap-1 sm:top-24">
      <div role="group" aria-label={t('guide.player', { title })} className="flex w-fit flex-wrap items-center gap-0.5 rounded-full bg-brand-50 p-1 shadow-lg ring-1 shadow-brand-900/10 ring-brand-200 dark:bg-zinc-900 dark:ring-zinc-700">
        <span aria-hidden className="voice-wave mx-2 flex h-4 items-end gap-0.5 text-brand-600 dark:text-brand-300" data-on={state === 'playing'}>
          {[0, 1, 2, 3].map((b) => (
            <span key={b} className="w-1 rounded-full bg-current" style={{ '--d': `${b * 0.12}s` } as React.CSSProperties} />
          ))}
        </span>
        <button type="button" onClick={() => start(index - 1)} disabled={index === 0} aria-label={t('guide.prevStep')} title={t('guide.prevStep')} className={control}>
          <IconPrev className="h-5 w-5" />
        </button>
        {state === 'playing' ? (
          <button
            type="button"
            onClick={() => {
              stopRef.current();
              setState('paused');
            }}
            aria-label={t('guide.pause')}
            title={t('guide.pause')}
            className={`${control} bg-brand-600 text-white hover:bg-brand-700 dark:text-white`}
          >
            <IconPause className="h-5 w-5" />
          </button>
        ) : (
          <button type="button" onClick={() => start(index)} aria-label={t('guide.resume')} title={t('guide.resume')} className={`${control} bg-brand-600 text-white hover:bg-brand-700 dark:text-white`}>
            <IconPlay className="h-5 w-5" />
          </button>
        )}
        <button type="button" onClick={() => start(index + 1)} aria-label={t('guide.nextStep')} title={t('guide.nextStep')} className={control}>
          <IconNext className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            clearQueue();
            stop();
          }}
          aria-label={t('guide.stopVoice')}
          title={t('guide.stopVoice')}
          className={control}
        >
          <IconStop className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-pressed={slow}
          onClick={() => setSlow((s) => !s)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${slow ? 'bg-brand-600 text-white' : 'text-brand-800 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-zinc-800'}`}
        >
          {t('guide.slow')}
        </button>
        <span className="px-2 text-xs font-medium text-zinc-600 tabular-nums dark:text-zinc-300" aria-live="polite">
          {t('guide.stepOf', { n: index + 1, total })}
        </span>
      </div>
      {noVoice && <p className="text-xs text-amber-800 dark:text-amber-300">{t('guide.voiceMissing')}</p>}
    </div>
  );
}

/** "Listen to all" for one part of the Guide: plays its lessons one after another. */
export function ListenAll({ ids, label }: { ids: string[]; label: string }) {
  const t = useT();
  const hydrated = useHydrated();
  if (!hydrated || !speechSupported()) return null;
  return (
    <button
      type="button"
      onClick={() => playQueue(ids)}
      aria-label={t('guide.listenAllFor', { part: label })}
      className="inline-flex items-center gap-1.5 rounded-full border border-brand-300 px-3 py-1 text-sm font-semibold text-brand-800 transition hover:bg-brand-50 active:scale-95 dark:border-brand-800 dark:text-brand-200 dark:hover:bg-zinc-900"
    >
      <IconPlay className="h-3.5 w-3.5" />
      {t('guide.listenAll')}
    </button>
  );
}

/** Small speaker button: hear one thing (a part of the tag). Lights up its row. */
export function HearButton({ text, label }: { text: string; label: string }) {
  const locale = useLocale();
  const hydrated = useHydrated();
  const ref = useRef<HTMLButtonElement>(null);
  if (!hydrated || !speechSupported()) return null;
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        clearQueue();
        announce(VOICE_START, 'hear');
        stopSpeaking();
        const row = ref.current?.closest<HTMLElement>('[data-voice]') ?? null;
        highlight(row);
        say(text, { locale, onEnd: () => highlight(null) });
      }}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-brand-700 transition hover:bg-brand-100 active:scale-90 dark:text-brand-300 dark:hover:bg-zinc-800"
    >
      <IconSound className="h-5 w-5" />
    </button>
  );
}
