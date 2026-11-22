'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { input, muted } from '@/components/ui/styles';

export type DropdownOption = { value: string; label: string; group?: string; tone?: 'action' };

/**
 * A compact dropdown (owner's feedback 2026-11-21): a phone's own list for a
 * <select> opens over the whole screen; this one opens just under the box, at
 * most about half the screen tall, scrolls inside, and has a search line when
 * the list is long. Options can be grouped (a heading per group) and the last
 * ones can be actions (e.g. "+ New company…").
 */
export function Dropdown({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled = false,
  required = false,
  searchPlaceholder,
  testId,
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  searchPlaceholder?: string;
  testId?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const chosen = options.find((o) => o.value === value);
  const searchable = options.length > 8;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.tone === 'action' || o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  // Close on a tap outside.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const toggle = (next: boolean) => {
    setOpen(next);
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  };
  const pick = (option: DropdownOption) => {
    setOpen(false);
    button.current?.focus();
    onChange(option.value);
  };
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
      button.current?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return toggle(true);
      setActive((i) => (e.key === 'ArrowDown' ? Math.min(shown.length - 1, i + 1) : Math.max(0, i - 1)));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (shown[active]) pick(shown[active]);
    }
  };

  return (
    <div ref={box} className="relative flex min-w-0 flex-col gap-1 text-sm font-medium" onKeyDown={keys}>
      <span id={`${id}-label`}>{label}</span>
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-haspopup="listbox"
        disabled={disabled}
        data-testid={testId}
        onClick={() => toggle(!open)}
        className={`${input} flex items-center justify-between gap-2 text-left disabled:opacity-60`}
      >
        <span id={`${id}-value`} className={`truncate ${chosen ? '' : muted}`}>
          {chosen?.label ?? placeholder}
        </span>
        <svg aria-hidden viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} fill="currentColor">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>
      {/* Lets a form that posts refuse an empty choice, like a required <select>. */}
      {required && <input tabIndex={-1} aria-hidden required value={value} onChange={() => {}} className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0" />}
      {open && (
        <div className="absolute top-full right-0 left-0 z-40 mt-1 flex min-w-[min(18rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-surface shadow-xl ring-1 ring-zinc-200 dark:ring-zinc-700">
          {searchable && (
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="border-b border-zinc-200 bg-transparent px-3 py-2.5 text-sm outline-none dark:border-zinc-700"
            />
          )}
          <ul ref={list} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} className="max-h-[min(45vh,18rem)] overflow-y-auto overscroll-contain py-1">
            {shown.map((option, i) => {
              const heading = option.group && option.group !== shown[i - 1]?.group ? option.group : null;
              return (
                <li key={option.value} role="presentation">
                  {heading && <p className={`px-3 pt-2 pb-1 text-[11px] font-bold tracking-wide uppercase ${muted}`}>{heading}</p>}
                  <button
                    type="button"
                    role="option"
                    data-index={i}
                    data-group={option.group}
                    aria-selected={option.value === value}
                    onClick={() => pick(option)}
                    onPointerMove={() => setActive(i)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm ${i === active ? 'bg-brand-50 dark:bg-brand-950' : ''} ${
                      option.tone === 'action' ? 'font-semibold text-brand-700 dark:text-brand-300' : ''
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.value === value && <span aria-hidden>✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
