'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { headerIcon } from '@/components/ui/styles';
import { IconMoon, IconPhone, IconSun } from '@/components/ui/icons';
import { useT } from '@/features/i18n/i18n-provider';
import type { MessageKey } from '@/lib/i18n';
import { applyAppearance, DEFAULT_THEME, readAppearance, THEME_SWATCH, THEMES, type Mode, type Theme } from './appearance';

const EVENT = 'maa-appearance-change';
const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
};
// Snapshot as one string so useSyncExternalStore sees a stable value.
const snapshot = () => {
  const { theme, mode } = readAppearance();
  // What the screen shows now (Same as phone resolves to day or night).
  const dark = document.documentElement.dataset.mode === 'dark' ? 'dark' : 'light';
  return `${theme}|${mode}|${dark}`;
};

const MODE_OPTIONS: { mode: Mode; label: MessageKey; Icon: typeof IconSun }[] = [
  { mode: 'light', label: 'look.light', Icon: IconSun },
  { mode: 'dark', label: 'look.dark', Icon: IconMoon },
  { mode: 'system', label: 'look.system', Icon: IconPhone },
];

/**
 * Palette button in the header: pick one of five dye themes (swatches look
 * like a dyed cloth with its zari edge) and day / night / same as phone.
 * Applies instantly; remembered on this phone.
 */
export function AppearanceMenu() {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  // Where the button is, so the pop-over (bigger screens) opens right under it.
  const [anchor, setAnchor] = useState({ top: 64, right: 16 });
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [theme, , shown] = useSyncExternalStore(subscribe, snapshot, () => `${DEFAULT_THEME}|system|light`).split('|') as [Theme, Mode, 'light' | 'dark'];
  const ModeIcon = shown === 'dark' ? IconMoon : IconSun;

  // Close on Escape or a tap outside.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={t('look.open')}
        title={t('look.open')}
        onClick={() => {
          const r = button.current?.getBoundingClientRect();
          if (r) setAnchor({ top: r.bottom + 8, right: window.innerWidth - r.right });
          setOpen((o) => !o);
        }}
        className={headerIcon}
      >
        <ModeIcon className="h-5 w-5" />
        {/* The theme's colour, as a small dyed dot. */}
        <span
          aria-hidden
          className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full ring-2 ring-brand-800 dark:ring-brand-950"
          style={{ background: THEME_SWATCH[theme].accent }}
        />
      </button>
      {/* Rendered on <body>: the header is its own layer under the bottom dock, and the
          sheet must cover the dock on phones. */}
      {open &&
        createPortal(
          <>
            <div aria-hidden className="fixed inset-0 z-40 bg-black/30 sm:hidden" />
            <div
              ref={panel}
              id={id}
              role="dialog"
              aria-label={t('look.title')}
              style={{ '--look-top': `${anchor.top}px`, '--look-right': `${anchor.right}px` } as React.CSSProperties}
              className="look-panel fixed inset-x-3 bottom-3 z-50 rounded-3xl pb-[calc(1rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:top-[var(--look-top)] sm:right-[var(--look-right)] sm:bottom-auto sm:w-72 sm:pb-4 border border-zinc-200 bg-surface p-4 text-zinc-900 shadow-2xl dark:border-zinc-700 dark:text-zinc-100"
            >
              <AppearanceOptions />
              <button type="button" onClick={() => setOpen(false)} className="mt-4 w-full rounded-full py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-zinc-800">
                {t('look.close')}
              </button>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

/** The theme swatches and Day / Night / Same as phone, shared by this pop-over and the header's ⋯ menu (plan v17). */
export function AppearanceOptions() {
  const t = useT();
  const [theme, mode] = useSyncExternalStore(subscribe, snapshot, () => `${DEFAULT_THEME}|system|light`).split('|') as [Theme, Mode, 'light' | 'dark'];
  return (
    <>
    <p className="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase dark:text-zinc-400">{t('look.theme')}</p>
    <div role="radiogroup" aria-label={t('look.theme')} className="mt-2 grid grid-cols-3 gap-x-2 gap-y-3">
      {THEMES.map((name) => {
        const swatch = THEME_SWATCH[name];
        const selected = name === theme;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(`theme.${name}` as MessageKey)}
            onClick={() => applyAppearance({ theme: name, mode })}
            className="group flex flex-col items-center gap-1"
          >
            <span
              className={`relative block h-11 w-11 overflow-hidden rounded-full transition group-active:scale-90 ${
                selected ? 'ring-[3px] ring-zinc-900 ring-offset-2 ring-offset-white dark:ring-zinc-100 dark:ring-offset-zinc-900' : 'ring-1 ring-black/10'
              }`}
              style={{ background: swatch.main }}
            >
              {/* The zari edge of the cloth. */}
              <span className="absolute inset-x-0 bottom-0 h-2.5" style={{ background: swatch.accent }} />
              {selected && (
                <svg viewBox="0 0 24 24" className="absolute inset-0 m-auto h-5 w-5" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 12.5l4 4L18 8" />
                </svg>
              )}
            </span>
            <span className="text-[11px] leading-tight font-medium">{t(`theme.${name}` as MessageKey)}</span>
          </button>
        );
      })}
    </div>

    <p className="mt-4 text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase dark:text-zinc-400">{t('look.mode')}</p>
    <div role="radiogroup" aria-label={t('look.mode')} className="mt-2 grid grid-cols-3 gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-800">
      {MODE_OPTIONS.map(({ mode: option, label, Icon }) => {
        const selected = option === mode;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => applyAppearance({ theme, mode: option })}
            className={`flex items-center justify-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold transition ${
              selected ? 'bg-brand-600 text-white shadow' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4" />
            {t(label)}
          </button>
        );
      })}
    </div>
    </>
  );
}
