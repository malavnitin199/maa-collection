'use client';

import { createContext, use, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose, IconSelect } from '@/components/ui/icons';
import { haptic } from '@/features/feedback/sounds';
import { useT } from '@/features/i18n/i18n-provider';

/**
 * Selecting many things at once (plan v17), built like a phone app:
 * - **Select** (or a long-press on any card) starts selection mode;
 * - a dark bar takes the place of the header: ✕ · "3 selected" · **Select all**;
 * - every card shows a big round tick that pops in; a tap anywhere on the card ticks it;
 * - the menu dock steps aside and a bottom bar holds the screen's actions as icon tiles;
 * - actions open a bottom sheet; results show as a short message that fades away.
 * Lists stay server-rendered: each card is wrapped in a `SelectableItem` with the
 * ids it stands for (a design card stands for all its items). Screens put their own
 * actions inside `SelectionBar` and read the choice with `useSelection()`.
 */
type Toast = { id: number; kind: 'ok' | 'error'; text: string };

type Selection = {
  selecting: boolean;
  /** Starts selection mode; with ids, those start ticked (long-press). */
  start: (ids?: readonly string[]) => void;
  stop: () => void;
  selected: string[];
  has: (ids: readonly string[]) => 'all' | 'some' | 'none';
  toggle: (ids: readonly string[]) => void;
  /** Everything on the screen, or nothing if everything is already ticked. */
  toggleAll: () => void;
  clear: () => void;
  allIds: readonly string[];
  /** A short message over the bottom bar (green = done, red = a problem). */
  notify: (kind: Toast['kind'], text: string) => void;
};

const SelectionContext = createContext<Selection | null>(null);
const LONG_PRESS_MS = 450;

export function useSelection(): Selection {
  const value = use(SelectionContext);
  if (!value) throw new Error('useSelection needs a SelectionProvider');
  return value;
}

export function SelectionProvider({ allIds, children }: { allIds: readonly string[]; children: ReactNode }) {
  const [selecting, setSelecting] = useState(false);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const toastId = useRef(0);

  // Selection mode: the dock steps aside (CSS on html[data-selecting]); Escape leaves it
  // unless a sheet is open (the sheet closes first).
  useEffect(() => {
    if (!selecting) return;
    const root = document.documentElement;
    root.dataset.selecting = 'true';
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[data-action-sheet]')) return;
      setSelecting(false);
      setChosen(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => {
      delete root.dataset.selecting;
      window.removeEventListener('keydown', onKey);
    };
  }, [selecting]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast((current) => (current?.id === toast.id ? null : current)), toast.kind === 'ok' ? 3200 : 6500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const value = useMemo<Selection>(() => {
    // Only ids still on the screen count (after a filter or a refresh).
    const visible = new Set(allIds);
    const selected = [...chosen].filter((id) => visible.has(id));
    const allOn = allIds.length > 0 && selected.length === allIds.length;
    return {
      selecting,
      start: (ids) => {
        setSelecting(true);
        setChosen(new Set(ids ?? []));
      },
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
          const on = ids.every((id) => next.has(id));
          for (const id of ids) {
            if (on) next.delete(id);
            else next.add(id);
          }
          return next;
        }),
      toggleAll: () => setChosen(allOn ? new Set() : new Set(allIds)),
      clear: () => setChosen(new Set()),
      allIds,
      notify: (kind, text) => setToast({ id: ++toastId.current, kind, text }),
    };
  }, [allIds, chosen, selecting]);

  return (
    <SelectionContext value={value}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role={toast.kind === 'ok' ? 'status' : 'alert'}
          data-testid="selection-toast"
          className={`sel-toast fixed left-1/2 z-50 flex w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl ${
            toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
          style={{ bottom: 'calc(var(--selection-bar, 0px) + 1rem + env(safe-area-inset-bottom))' }}
        >
          <span aria-hidden className="text-base">
            {toast.kind === 'ok' ? '✓' : '!'}
          </span>
          {toast.text}
        </div>
      )}
    </SelectionContext>
  );
}

/** "Select" — the way in (a long-press on a card works too). Hidden while selecting: the top bar has ✕. */
export function SelectToggle({ testId }: { testId?: string }) {
  const t = useT();
  const { selecting, start, allIds } = useSelection();
  if (allIds.length === 0 || selecting) return null;
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={() => start()}
      className="inline-flex min-h-10 items-center gap-2 rounded-full border-2 border-brand-600 bg-surface px-4 text-sm font-bold text-brand-700 shadow-sm transition hover:bg-brand-50 active:scale-95 dark:border-brand-400 dark:text-brand-200 dark:hover:bg-brand-950"
    >
      <IconSelect className="h-5 w-5" />
      {t('sel.select')}
    </button>
  );
}

/** The circle with the tick inside (shared by the cards and Select all). */
function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path className="sel-check-mark" d="M6.5 12.5l3.8 3.8 7.2-7.6" />
      <path className="sel-check-dash" d="M7.5 12h9" />
    </svg>
  );
}

/**
 * The round tick: an empty ring, a filled circle with a tick that draws itself,
 * or a dash when only some items of a design are chosen. A real checkbox for
 * screen readers and keyboards (Space / Enter).
 */
export function SelectCheck({ state, label, onToggle, className = '' }: { state: 'all' | 'some' | 'none'; label: string; onToggle: () => void; className?: string }) {
  return (
    <span
      role="checkbox"
      tabIndex={0}
      aria-checked={state === 'all' ? 'true' : state === 'some' ? 'mixed' : 'false'}
      aria-label={label}
      data-state={state}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`sel-check ${className}`}
    >
      <CheckMark />
    </span>
  );
}

/**
 * One selectable card. While selecting: a big round tick on its top-left, the
 * whole card ticks on a tap (its links don't open), chosen cards get a ring.
 * Not selecting: a long-press (or right-click) starts selection with this card.
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
  const { selecting, has, toggle, start } = useSelection();
  const state = has(ids);
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  // After a long-press, the click that follows must not open the card's link.
  const swallowClick = useRef(false);

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  const begin = () => {
    press.current = null;
    swallowClick.current = true;
    start(ids);
    haptic(18);
  };
  const flip = () => {
    toggle(ids);
    haptic(8);
  };

  return (
    <div
      className={`${inside ? 'contents' : 'relative rounded-2xl'} select-none [-webkit-touch-callout:none]`}
      data-selected={selecting && state !== 'none' ? state : undefined}
      onPointerDown={(e) => {
        swallowClick.current = false;
        if (selecting || e.button !== 0) return;
        const { clientX: x, clientY: y } = e;
        press.current = { timer: window.setTimeout(begin, LONG_PRESS_MS), x, y };
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancelPress();
      }}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
      onContextMenu={(e) => {
        // Android's long-press menu and a desktop right-click: select instead.
        e.preventDefault();
        if (!selecting && !swallowClick.current) begin();
      }}
      onClickCapture={(e) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {children}
      {selecting && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={flip}
            className={`absolute inset-0 z-[1] rounded-2xl transition ${
              state === 'none' ? 'bg-slate-900/0 hover:bg-brand-500/5 active:bg-brand-500/10' : 'bg-brand-500/10 ring-[3px] ring-brand-600 ring-inset dark:ring-brand-400'
            }`}
          />
          <SelectCheck state={state} label={t('sel.item', { name: label })} onToggle={flip} className="absolute top-2.5 left-2.5 z-[2]" />
        </>
      )}
    </div>
  );
}

/**
 * While selecting: the top bar (✕ · how many · Select all) and the bottom bar
 * with the screen's actions (children: an `ActionGrid` of `ActionTile`s). The
 * page keeps room under the list so the last cards can scroll above the bar.
 */
export function SelectionBar({ children }: { children: ReactNode }) {
  const t = useT();
  const { selecting, selected, toggleAll, stop, allIds } = useSelection();
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
    document.documentElement.style.setProperty('--selection-bar', `${height}px`);
    return () => {
      document.documentElement.style.removeProperty('--selection-bar');
    };
  }, [selecting, height]);
  if (!selecting) return null;
  const n = selected.length;
  const all = allIds.length > 0 && n === allIds.length ? 'all' : n > 0 ? 'some' : 'none';
  return (
    <>
      <div aria-hidden data-testid="selection-space" style={{ height: height + 24 }} />

      <div role="toolbar" aria-label={t('sel.bar')} data-testid="selection-top" className="sel-top fixed inset-x-0 top-0 z-40 bg-slate-900 pt-[env(safe-area-inset-top)] text-white shadow-xl shadow-slate-950/30">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-2 sm:px-4">
          <button type="button" onClick={stop} aria-label={t('sel.close')} title={t('sel.close')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 active:scale-90">
            <IconClose className="h-6 w-6" />
          </button>
          <p data-testid="selected-count" aria-live="polite" className="min-w-0 flex-1 truncate text-lg font-bold">
            {n === 0 ? t('sel.none') : t(n === 1 ? 'sel.count.one' : 'sel.count.other', { n })}
          </p>
          <button
            type="button"
            role="checkbox"
            aria-checked={all === 'all' ? 'true' : all === 'some' ? 'mixed' : 'false'}
            aria-label={t('sel.allLabel')}
            onClick={() => {
              toggleAll();
              haptic(10);
            }}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-white/10 py-1.5 pr-4 pl-1.5 text-sm font-bold ring-1 ring-white/15 transition hover:bg-white/15 active:scale-95"
          >
            <span className="sel-check sel-check-dark pointer-events-none" data-state={all}>
              <CheckMark />
            </span>
            {t('sel.allCount', { n: allIds.length })}
          </button>
        </div>
      </div>

      <div
        ref={bar}
        role="region"
        aria-label={t('sel.actions')}
        data-testid="selection-bar"
        className="sel-bottom fixed inset-x-0 bottom-0 z-40 rounded-t-[1.75rem] bg-slate-900 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-white shadow-[0_-12px_40px_rgb(2_6_23/0.35)] sm:inset-x-4 sm:bottom-4 sm:mx-auto sm:max-w-3xl sm:rounded-[1.75rem]"
      >
        <div aria-hidden className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-white/25 sm:hidden" />
        {n === 0 && <p className="mb-2 px-1 text-center text-xs font-medium text-slate-300">{t('sel.hint')}</p>}
        {children}
      </div>
    </>
  );
}

/** A big action in the bottom bar: a clear icon above a word. */
export function ActionTile({
  icon,
  label,
  onClick,
  disabled = false,
  tone = 'plain',
  wide = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'plain' | 'danger' | 'success';
  /** Takes the whole row (a screen with one or two actions). */
  wide?: boolean;
}) {
  const tones = {
    plain: 'bg-white/10 text-white ring-1 ring-white/10 hover:bg-white/15',
    danger: 'bg-red-600 text-white hover:bg-red-500',
    success: 'bg-emerald-600 text-white hover:bg-emerald-500',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[0.8rem] leading-tight font-bold transition active:scale-95 disabled:opacity-35 disabled:active:scale-100 ${tones[tone]} ${wide ? 'col-span-2 flex-row gap-2 text-sm' : ''}`}
    >
      <span aria-hidden className="[&>svg]:h-6 [&>svg]:w-6">
        {icon}
      </span>
      {label}
    </button>
  );
}

/** The tiles inside the bottom bar: four across on a phone, one row on wider screens. */
export function ActionGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-4 gap-2 sm:auto-cols-fr sm:grid-flow-col">{children}</div>;
}

/**
 * A bottom sheet for one action (a centred card on wider screens): title,
 * content, then the big buttons. Escape or a tap outside closes it.
 */
export function ActionSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div data-action-sheet className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div aria-hidden className="sel-fade absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="action-sheet"
        className="sel-sheet relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-[1.75rem] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-zinc-900 shadow-2xl sm:rounded-[1.75rem] dark:text-zinc-100"
      >
        <div aria-hidden className="mx-auto -mt-1 mb-3 h-1.5 w-11 rounded-full bg-zinc-300 sm:hidden dark:bg-zinc-700" />
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="mt-4 flex flex-col gap-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** The sheet's big buttons. */
export const sheetPrimary =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 text-base font-bold text-white shadow-md shadow-brand-700/25 transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50';
export const sheetDanger =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 text-base font-bold text-white shadow-md shadow-red-700/25 transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-50';
export const sheetSecondary =
  'inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-zinc-300 px-5 text-base font-semibold text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800';
