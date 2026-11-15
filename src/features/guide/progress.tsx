'use client';

import { useSyncExternalStore } from 'react';

// Which lessons this person has ticked, kept on this phone only (a convenience; nothing breaks without it).
const KEY = 'maa-guide-done';
const EVENT = 'maa-guide-change';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function snapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

function parse(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function useDone() {
  const done = parse(useSyncExternalStore(subscribe, snapshot, () => '[]'));
  const toggle = (id: string) => {
    const next = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Private window / storage blocked: the tick just isn't remembered.
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return { done, toggle };
}

const noop = () => () => {};

export function LessonDone({ id, title }: { id: string; title: string }) {
  const { done, toggle } = useDone();
  // Disabled until the page is interactive, so an early tap is never lost.
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const checked = done.includes(id);
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={`${checked ? 'Learned' : 'Mark as learned'}: ${title}`}
      disabled={!ready}
      onClick={() => toggle(id)}
      className={`self-start rounded-full border px-4 py-2 text-sm font-medium ${
        checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200'
      }`}
    >
      {checked ? '✓ Learned' : 'Mark as learned'}
    </button>
  );
}

export function GuideProgress({ ids }: { ids: string[] }) {
  const { done } = useDone();
  const count = ids.filter((id) => done.includes(id)).length;
  return (
    <div className="flex items-center gap-3 text-sm" data-testid="guide-progress">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-emerald-600 transition-[width]" style={{ width: `${(count / ids.length) * 100}%` }} />
      </div>
      <span className="tabular-nums">
        {count} of {ids.length} learned
      </span>
    </div>
  );
}

export function LessonTick({ id }: { id: string }) {
  const { done } = useDone();
  return done.includes(id) ? <span className="text-emerald-600">✓</span> : null;
}
