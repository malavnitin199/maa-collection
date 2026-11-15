'use client';

import { useSyncExternalStore } from 'react';
import { useT } from '@/features/i18n/i18n-provider';

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

export function useDone() {
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

export function GuideProgress({ ids }: { ids: string[] }) {
  const { done } = useDone();
  const t = useT();
  const count = ids.filter((id) => done.includes(id)).length;
  return (
    <div className="flex items-center gap-3 text-sm" data-testid="guide-progress">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${(count / ids.length) * 100}%` }} />
      </div>
      <span className="tabular-nums">
        {t('guide.progress', { done: count, total: ids.length })}
      </span>
    </div>
  );
}
