'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { IconGrid, IconRows } from '@/components/ui/icons';
import { muted } from '@/components/ui/styles';
import './tag-library.css';

/**
 * All tags (plan v13): Grid (each group's tags wrap onto lines) or Rows (each
 * group is one line you swipe sideways). Remembered on this phone. The tags
 * themselves are drawn on the server and passed in as children, so nothing
 * about them (e.g. purchase prices) is sent to the phone as data.
 */
export type TagView = 'grid' | 'rows';

const KEY = 'maa-tag-view';
const CHANGE = 'maa-tag-view-change';

function readView(): TagView {
  try {
    return localStorage.getItem(KEY) === 'rows' ? 'rows' : 'grid';
  } catch {
    return 'grid';
  }
}

function saveView(view: TagView) {
  try {
    localStorage.setItem(KEY, view);
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
  window.dispatchEvent(new Event(CHANGE));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function TagViews({
  labels,
  summary,
  children,
}: {
  labels: { view: string; grid: string; rows: string; swipeHint: string };
  /** Shown next to the switch (counts). */
  summary: ReactNode;
  children: ReactNode;
}) {
  const view = useSyncExternalStore(subscribe, readView, () => 'grid' as const);
  const options = [
    { value: 'grid' as const, label: labels.grid, Icon: IconGrid },
    { value: 'rows' as const, label: labels.rows, Icon: IconRows },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className={`text-sm ${muted}`}>{summary}</div>
        <div role="group" aria-label={labels.view} className="inline-flex rounded-full border border-zinc-300 bg-white/60 p-1 dark:border-zinc-700 dark:bg-zinc-900/60">
          {options.map(({ value, label, Icon }) => {
            const on = view === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                onClick={() => saveView(value)}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition active:scale-95 ${
                  on ? 'bg-brand-600 text-white shadow-sm' : 'text-zinc-600 hover:text-brand-700 dark:text-zinc-300 dark:hover:text-brand-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {view === 'rows' && <p className={`-mt-2 text-xs ${muted}`}>{labels.swipeHint}</p>}
      <div data-testid="tag-library" data-view={view} className="tag-library flex flex-col gap-7">
        {children}
      </div>
    </div>
  );
}
