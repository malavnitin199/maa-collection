'use client';

import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { useT } from '@/features/i18n/i18n-provider';

export type ItemTab = {
  id: string;
  label: string;
  content: ReactNode;
  /** Keep this panel in the printout even when another tab is open (the hang tag). */
  print?: boolean;
  /** Colour code (plan v17): each tab's panel has its own tint so it stands apart from the page. */
  tone?: Tone;
};

/**
 * Owner's choice (plan v17): this part has its own fixed "slate & amber" look,
 * deliberately not the app's theme, so it always reads as a separate section.
 */
type Tone = 'sky' | 'amber' | 'slate';
const TONE_PANEL: Record<Tone, string> = {
  sky: 'bg-sky-50 dark:bg-slate-900',
  amber: 'bg-amber-50 dark:bg-amber-950/40',
  slate: 'bg-slate-100 dark:bg-slate-900/80',
};
const TONE_DOT: Record<Tone, string> = { sky: 'bg-sky-400', amber: 'bg-amber-400', slate: 'bg-slate-400' };

/**
 * The top tab bar of an item (plan v17): Details · Colours · Other details on a
 * dark slate band, the open one underlined in amber; below it the open tab's
 * panel in its own tint (light blue / amber / grey) — a style of its own, not
 * the app's theme, so this part reads as separate from the must-haves above. Every panel stays mounted (its fields
 * keep what was typed); closed panels are hidden on screen. ←/→ move between tabs.
 */
export function ItemTabs({ tabs, idPrefix }: { tabs: ItemTab[]; idPrefix: string }) {
  const t = useT();
  const [open, setOpen] = useState(tabs[0]?.id);
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = tabs.findIndex((tab) => tab.id === open);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    setOpen(next.id);
    document.getElementById(`${idPrefix}-tab-${next.id}`)?.focus();
  };
  return (
    <div
      data-testid={`${idPrefix}-tabs`}
      className="flex flex-col overflow-hidden rounded-2xl shadow-md shadow-slate-900/10 ring-1 ring-slate-300 print:overflow-visible print:rounded-none print:shadow-none print:ring-0 dark:ring-slate-700"
    >
      <div
        role="tablist"
        aria-label={t('cat.tab.aria')}
        onKeyDown={move}
        className="flex gap-1 overflow-x-auto bg-slate-900 px-2 print:hidden dark:bg-slate-950"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`${idPrefix}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={open === tab.id}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={open === tab.id ? 0 : -1}
            onClick={() => setOpen(tab.id)}
            className={`flex shrink-0 items-center gap-1.5 border-b-[3px] px-4 pt-3 pb-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
              open === tab.id ? 'border-amber-400 text-white' : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            <span aria-hidden className={`h-2 w-2 rounded-full ${TONE_DOT[tab.tone ?? 'sky']}`} />
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${idPrefix}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-tab-${tab.id}`}
          data-tone={tab.tone ?? 'sky'}
          className={`p-3 print:bg-transparent print:p-0 ${TONE_PANEL[tab.tone ?? 'sky']} ${open === tab.id ? '' : tab.print ? 'hidden print:block' : 'hidden'}`}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
