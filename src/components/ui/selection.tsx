'use client';

import { createContext, use, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { secondaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';

/**
 * Selecting many things at once (plan v17): Products, All tags, Companies and
 * Approvals use the same pieces. The list stays server-rendered; each card is
 * wrapped in a `SelectableItem` (with the ids it stands for — a design card
 * stands for all its items), and a `SelectionBar` at the bottom holds the
 * screen's own actions, which read the choice with `useSelection()`.
 */
type Selection = {
  selecting: boolean;
  start: () => void;
  stop: () => void;
  selected: string[];
  has: (ids: readonly string[]) => 'all' | 'some' | 'none';
  toggle: (ids: readonly string[]) => void;
  selectAll: () => void;
  clear: () => void;
  allIds: readonly string[];
};

const SelectionContext = createContext<Selection | null>(null);

export function useSelection(): Selection {
  const value = use(SelectionContext);
  if (!value) throw new Error('useSelection needs a SelectionProvider');
  return value;
}

export function SelectionProvider({ allIds, children }: { allIds: readonly string[]; children: ReactNode }) {
  const [selecting, setSelecting] = useState(false);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const value = useMemo<Selection>(() => {
    // Only ids still on the screen count (after a filter or a refresh).
    const visible = new Set(allIds);
    const selected = [...chosen].filter((id) => visible.has(id));
    return {
      selecting,
      start: () => setSelecting(true),
      stop: () => {
        setSelecting(false);
        setChosen(new Set());
      },
      selected,
      has: (ids) => {
        const n = ids.filter((id) => chosen.has(id)).length;
        return n === 0 ? 'none' : n === ids.length ? 'all' : 'some';
      },
      toggle: (ids) =>
        setChosen((current) => {
          const next = new Set(current);
          const allOn = ids.every((id) => next.has(id));
          for (const id of ids) {
            if (allOn) next.delete(id);
            else next.add(id);
          }
          return next;
        }),
      selectAll: () => setChosen(new Set(allIds)),
      clear: () => setChosen(new Set()),
      allIds,
    };
  }, [allIds, chosen, selecting]);
  return <SelectionContext value={value}>{children}</SelectionContext>;
}

/** "Select" / "Done" — turns the tick boxes on and off. */
export function SelectToggle({ testId }: { testId?: string }) {
  const t = useT();
  const { selecting, start, stop, allIds } = useSelection();
  if (allIds.length === 0) return null;
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={selecting}
      onClick={selecting ? stop : start}
      className={
        selecting
          ? 'inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-300 ring-1 ring-slate-700 transition active:scale-[0.97]'
          : secondaryButton
      }
    >
      {selecting ? t('sel.done') : t('sel.select')}
    </button>
  );
}

/**
 * One selectable card. While selecting, a tick box sits on its top-left corner
 * and the whole card ticks on a tap (its links don't open).
 */
export function SelectableItem({
  ids,
  label,
  children,
  inside = false,
}: {
  ids: readonly string[];
  label: string;
  children: ReactNode;
  /** Inside an existing positioned card (e.g. an Approvals card): add no box of its own, cover that card. */
  inside?: boolean;
}) {
  const t = useT();
  const { selecting, has, toggle } = useSelection();
  const state = has(ids);
  return (
    <div className={inside ? 'contents' : 'relative'} data-selected={selecting && state !== 'none' ? state : undefined}>
      {children}
      {selecting && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => toggle(ids)}
            className={`absolute inset-0 z-[1] rounded-2xl transition ${state === 'none' ? 'bg-white/0 hover:bg-brand-500/5' : 'bg-brand-500/10 ring-[3px] ring-brand-600'}`}
          />
          <input
            type="checkbox"
            aria-label={t('sel.item', { name: label })}
            checked={state === 'all'}
            ref={(box) => {
              if (box) box.indeterminate = state === 'some';
            }}
            onChange={() => toggle(ids)}
            className="absolute top-2 left-2 z-[2] h-6 w-6 cursor-pointer accent-brand-600"
          />
        </>
      )}
    </div>
  );
}

/**
 * The bar at the bottom while selecting: how many are chosen, Select all /
 * Clear, and the screen's own actions (children). Sits above the phone dock.
 */
export function SelectionBar({ children }: { children: ReactNode }) {
  const t = useT();
  const { selecting, selected, selectAll, clear, allIds } = useSelection();
  // The bar floats over the bottom of the list: leave that much room after the
  // list (and in scroll-padding), so the last items can scroll up above it.
  const bar = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const node = bar.current;
    if (!selecting || !node) return;
    const observer = new ResizeObserver(() => setHeight(node.getBoundingClientRect().height));
    observer.observe(node);
    return () => observer.disconnect();
  }, [selecting]);
  useEffect(() => {
    if (!selecting) return;
    document.documentElement.style.setProperty('--selection-bar', `${height + 16}px`);
    return () => {
      document.documentElement.style.removeProperty('--selection-bar');
    };
  }, [selecting, height]);
  if (!selecting) return null;
  return (
    <>
    <div aria-hidden data-testid="selection-space" style={{ height: height + 24 }} />
    <div
      ref={bar}
      role="region"
      aria-label={t('sel.bar')}
      data-testid="selection-bar"
      className="fixed inset-x-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-3xl flex-col gap-2 rounded-3xl border border-slate-700 bg-slate-900 p-3 text-white shadow-2xl sm:bottom-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span data-testid="selected-count" className="font-semibold">
          {t(selected.length === 1 ? 'sel.count.one' : 'sel.count.other', { n: selected.length })}
        </span>
        <span className="flex gap-2">
          <button type="button" onClick={selectAll} disabled={selected.length === allIds.length} className="rounded-full px-3 py-1 text-amber-300 hover:bg-white/10 disabled:opacity-40">
            {t('sel.all', { n: allIds.length })}
          </button>
          <button type="button" onClick={clear} disabled={selected.length === 0} className="rounded-full px-3 py-1 text-slate-300 hover:bg-white/10 disabled:opacity-40">
            {t('sel.clear')}
          </button>
        </span>
      </div>
      {children}
    </div>
    </>
  );
}

/** A button in the selection bar (light on the dark bar). */
export const barButton =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20 active:scale-95 disabled:opacity-40';
export const barDanger =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-red-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-95 disabled:opacity-40';
