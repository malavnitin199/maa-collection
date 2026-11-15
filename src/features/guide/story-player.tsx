'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  IconBoxes,
  IconCamera,
  IconChart,
  IconChevron,
  IconGrid,
  IconPalette,
  IconPrinter,
  IconRupee,
  IconScan,
  IconSound,
  IconMute,
  IconStockAdd,
  IconSwap,
  IconTag,
  IconUsers,
  IconCheckList,
  IconPhone,
} from '@/components/ui/icons';
import { primaryButton, secondaryButton } from '@/components/ui/styles';
import { useLocale, useT } from '@/features/i18n/i18n-provider';
import { useHydrated } from '@/features/scanning/scan-input';
import type { MessageKey } from '@/lib/i18n';
import { PracticeSale } from './practice-sale';
import { useDone } from './progress';
import { PhoneScene } from './scenes';
import { AUDIENCES, pick, STORIES, type Audience, type Story } from './stories';
import { missingVoice, say, speechSupported, stopSpeaking } from './voice';
import './guide.css';

const ICONS: Record<string, (p: { className?: string }) => React.ReactNode> = {
  start: IconPhone,
  look: IconPalette,
  tag: IconTag,
  sell: IconScan,
  qr: IconGrid,
  exchange: IconSwap,
  'new-design': IconStockAdd,
  'old-stock': IconCamera,
  print: IconPrinter,
  restock: IconBoxes,
  inventory: IconCheckList,
  prices: IconRupee,
  team: IconUsers,
  'sales-team': IconChart,
  reports: IconChart,
};

/*
 * Which lesson is open lives in the address (#sell), so links like /guide#sell
 * open it and the phone's Back button closes it. #for-owner picks a part.
 */
const NAV = 'maa-guide-nav';
function subscribeNav(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAV, onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAV, onChange);
  };
}
const currentHash = () => window.location.hash.slice(1);
function go(hash: string, mode: 'push' | 'replace') {
  const url = `${window.location.pathname}${window.location.search}#${hash}`;
  if (mode === 'push') window.history.pushState({ guide: true }, '', url);
  else window.history.replaceState(null, '', url);
  window.dispatchEvent(new Event(NAV));
}

// "Voice" on/off is remembered on this phone.
const VOICE_KEY = 'maa-guide-voice';
const VOICE_EVENT = 'maa-guide-voice-change';
function subscribeVoice(onChange: () => void) {
  window.addEventListener(VOICE_EVENT, onChange);
  return () => window.removeEventListener(VOICE_EVENT, onChange);
}
function voiceSnapshot(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) !== 'off';
  } catch {
    return true;
  }
}
function setVoice(on: boolean) {
  try {
    localStorage.setItem(VOICE_KEY, on ? 'on' : 'off');
  } catch {
    // Not remembered in a private window.
  }
  window.dispatchEvent(new Event(VOICE_EVENT));
}

/** "Tap **Sell**" → Tap <strong>Sell</strong>. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((part, i) =>
        i % 2 ? (
          <strong key={i} className="text-brand-700 dark:text-brand-300">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** The Guide: choose your part, tap a lesson, watch it step by step. */
export function GuideBrowser({ defaultAudience }: { defaultAudience: Audience }) {
  const t = useT();
  const locale = useLocale();
  const hydrated = useHydrated();
  const hash = useSyncExternalStore(subscribeNav, currentHash, () => '');
  const [chosen, setChosen] = useState<Audience | null>(null);
  const { done } = useDone();

  const story = STORIES.find((s) => s.id === hash) ?? null;
  const fromHash = hash.startsWith('for-') ? AUDIENCES.find((a) => `for-${a}` === hash) : undefined;
  const audience = chosen ?? story?.audience ?? fromHash ?? defaultAudience;
  const lessons = STORIES.filter((s) => s.audience === audience);

  const close = useCallback(() => {
    if (!story) return;
    // Opened from a tile: Back returns to the list. Opened from a link: stay on the Guide.
    if (window.history.state?.guide) window.history.back();
    else go(`for-${story.audience}`, 'replace');
  }, [story]);

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t('guide.for')} className="flex flex-wrap gap-2">
        {AUDIENCES.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={a === audience}
            onClick={() => {
              setChosen(a);
              go(`for-${a}`, 'replace');
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 ${
              a === audience ? 'bg-brand-600 text-white shadow-md shadow-brand-700/25' : 'border border-zinc-300 bg-white/60 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200'
            }`}
          >
            {t(`aud.${a}` as MessageKey)}
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="guide-lessons">
        {lessons.map((lesson) => {
          const Icon = ICONS[lesson.id] ?? IconTag;
          const learned = done.includes(lesson.id);
          return (
            <li key={lesson.id}>
              <button
                type="button"
                disabled={!hydrated}
                onClick={() => go(lesson.id, 'push')}
                className="group relative flex h-full w-full flex-col items-start gap-2 rounded-3xl bg-surface p-4 text-left shadow-sm ring-1 shadow-brand-900/[0.06] ring-zinc-200/80 transition hover:-translate-y-0.5 active:scale-[0.97] dark:ring-zinc-800"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-900/60 dark:text-brand-200">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="text-base leading-tight font-bold">{pick(lesson.title, locale)}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('guide.steps', { n: lesson.steps.length })}</span>
                {learned && (
                  <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white" title={t('guide.learned')}>
                    ✓
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {hydrated && story && createPortal(<StoryPlayer key={story.id} story={story} onClose={close} />, document.body)}
    </div>
  );
}

function StoryPlayer({ story, onClose }: { story: Story; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const { done, toggle } = useDone();
  const voiceWanted = useSyncExternalStore(subscribeVoice, voiceSnapshot, () => true);
  const canSpeak = speechSupported();
  const voiceOn = voiceWanted && canSpeak;
  // 0 … steps-1 = a step; steps.length = the last card (tip, try it, done).
  const [index, setIndex] = useState(0);
  const [practising, setPractising] = useState(false);
  const total = story.steps.length;
  const step = index < total ? story.steps[index] : null;
  const title = pick(story.title, locale);
  const swipe = useRef<number | null>(null);
  const next = useRef<HTMLButtonElement>(null);

  const goTo = useCallback((i: number) => setIndex(Math.max(0, Math.min(total, i))), [total]);

  // The voice reads the step; when it finishes, the story moves on by itself.
  useEffect(() => {
    if (!voiceOn || practising) return;
    const text = step ? pick(step.say, locale) : `${pick(story.goal, locale)} ${story.tip ? pick(story.tip, locale) : ''}`;
    let timer = 0;
    const stop = say(text, {
      locale,
      onEnd: (finished) => {
        if (finished && step) timer = window.setTimeout(() => setIndex((i) => Math.min(total, i + 1)), 900);
      },
    });
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [index, voiceOn, practising, locale, step, story, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') goTo(index + 1);
      else if (e.key === 'ArrowLeft') goTo(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, index, onClose]);

  // The page behind doesn't scroll while a lesson is open; the voice stops when it closes.
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    next.current?.focus();
    return () => {
      document.body.style.overflow = before;
      stopSpeaking();
    };
  }, []);

  const finish = () => {
    if (!done.includes(story.id)) toggle(story.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="story"
        onPointerDown={(e) => {
          swipe.current = e.clientX;
        }}
        onPointerUp={(e) => {
          const from = swipe.current;
          swipe.current = null;
          if (from === null || practising) return;
          const dx = e.clientX - from;
          if (dx < -60) goTo(index + 1);
          else if (dx > 60) goTo(index - 1);
        }}
        className="flex w-full max-w-md flex-col gap-3 overflow-y-auto bg-[var(--background)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-[var(--foreground)] sm:max-h-[46rem] sm:rounded-[2rem] sm:shadow-2xl"
      >
        {/* Progress: one bar per step, like a story. */}
        <div className="flex gap-1" aria-hidden>
          {story.steps.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= index ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xl text-brand-900 dark:text-brand-100">{title}</h2>
          <div className="flex items-center gap-1">
            {step && (
              <span className="px-1 text-sm font-semibold text-zinc-500 tabular-nums dark:text-zinc-400" data-testid="story-count">
                {t('guide.stepOf', { n: index + 1, total })}
              </span>
            )}
            {canSpeak && (
              <button
                type="button"
                aria-pressed={voiceOn}
                aria-label={t('guide.voice')}
                title={t('guide.voice')}
                onClick={() => {
                  if (voiceOn) stopSpeaking();
                  setVoice(!voiceOn);
                }}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition active:scale-90 ${voiceOn ? 'bg-brand-600 text-white' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}
              >
                {voiceOn ? <IconSound className="h-5 w-5" /> : <IconMute className="h-5 w-5" />}
              </button>
            )}
            <button type="button" onClick={onClose} aria-label={t('guide.close')} title={t('guide.close')} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-lg text-zinc-700 transition active:scale-90 dark:bg-zinc-800 dark:text-zinc-200">
              ✕
            </button>
          </div>
        </div>

        {practising ? (
          <PracticeSale />
        ) : step ? (
          <>
            <div key={index} aria-hidden className="st-enter flex flex-1 items-center justify-center py-1">
              <div className="st-stage">
                <PhoneScene scene={step.scene} locale={locale} />
              </div>
            </div>
            <p key={`t${index}`} aria-live="polite" data-testid="story-text" className="st-enter min-h-[4.5rem] text-center text-2xl leading-snug font-bold">
              <Rich text={pick(step.text, locale)} />
            </p>
          </>
        ) : (
          <div className="st-enter flex flex-1 flex-col items-center justify-center gap-4 py-4 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-4xl font-bold text-white shadow-lg shadow-brand-700/30">✓</span>
            <p className="text-2xl leading-snug font-bold" data-testid="story-text">
              {pick(story.goal, locale)}
            </p>
            {story.tip && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">💡 {pick(story.tip, locale)}</p>}
            <div className="flex flex-wrap justify-center gap-2">
              {story.practice && (
                <button type="button" onClick={() => setPractising(true)} className={secondaryButton}>
                  {t('prac.title')}
                </button>
              )}
              {story.open && (
                <Link href={story.open.href} className={secondaryButton}>
                  {pick(story.open.label, locale)} →
                </Link>
              )}
            </div>
          </div>
        )}
        {voiceOn && missingVoice(locale) && <p className="text-center text-xs text-amber-800 dark:text-amber-300">{t('guide.voiceMissing')}</p>}

        <div className="mt-auto grid grid-cols-[auto_1fr] gap-2">
          <button
            type="button"
            onClick={() => (practising ? setPractising(false) : goTo(index - 1))}
            disabled={!practising && index === 0}
            aria-label={t('guide.prevStep')}
            className={`${secondaryButton} px-5 py-3`}
          >
            <IconChevron className="h-5 w-5 rotate-180" />
            {t('guide.back')}
          </button>
          {step && !practising ? (
            <button ref={next} type="button" onClick={() => goTo(index + 1)} aria-label={t('guide.nextStep')} className={`${primaryButton} py-3 text-lg`}>
              {t('guide.next')}
              <IconChevron className="h-5 w-5" />
            </button>
          ) : (
            <button ref={next} type="button" onClick={finish} className={`${primaryButton} py-3 text-lg`}>
              {t('guide.gotIt')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
