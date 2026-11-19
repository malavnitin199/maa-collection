'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconDots } from '@/components/ui/icons';
import { headerIcon } from '@/components/ui/styles';
import { AppearanceOptions } from '@/features/appearance/appearance-menu';
import { useT } from '@/features/i18n/i18n-provider';

/** A full-width row inside the ⋯ menu (Sound, Guide, Log out). */
export const menuRow =
  'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-zinc-800 transition hover:bg-brand-50 active:scale-[0.99] dark:text-zinc-100 dark:hover:bg-zinc-800';

/**
 * The header's ⋯ menu (plan v17): the header keeps only the shop's name, अ / A
 * and this button. Inside: colours and day / night, then the rows passed as
 * children (Sound, Guide, Log out). A sheet on phones, a pop-over on wider
 * screens; closes on Escape, a tap outside, or moving to another screen.
 */
export function HeaderMenu({ children }: { children: ReactNode }) {
  const t = useT();
  const id = useId();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedOn, setOpenedOn] = useState(pathname);
  const [anchor, setAnchor] = useState({ top: 64, right: 16 });
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  // A new screen closes the menu (the header stays mounted across screens).
  if (open && pathname !== openedOn) setOpen(false);

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
        aria-label={t('menu.open')}
        title={t('menu.open')}
        onClick={() => {
          const r = button.current?.getBoundingClientRect();
          if (r) setAnchor({ top: r.bottom + 8, right: window.innerWidth - r.right });
          setOpenedOn(pathname);
          setOpen((o) => !o);
        }}
        className={headerIcon}
      >
        <IconDots className="h-6 w-6" />
      </button>
      {open &&
        createPortal(
          <>
            <div aria-hidden className="fixed inset-0 z-40 bg-black/30 sm:hidden" />
            <div
              ref={panel}
              id={id}
              role="dialog"
              aria-label={t('menu.open')}
              style={{ '--look-top': `${anchor.top}px`, '--look-right': `${anchor.right}px` } as React.CSSProperties}
              className="look-panel fixed inset-x-3 bottom-3 z-50 max-h-[85vh] overflow-y-auto rounded-3xl border border-zinc-200 bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-zinc-900 shadow-2xl sm:inset-x-auto sm:top-[var(--look-top)] sm:right-[var(--look-right)] sm:bottom-auto sm:w-80 sm:pb-4 dark:border-zinc-700 dark:text-zinc-100"
            >
              <AppearanceOptions />
              <div className="mt-4 flex flex-col gap-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">{children}</div>
              <button type="button" onClick={() => setOpen(false)} className="mt-3 w-full rounded-full py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-zinc-800">
                {t('look.close')}
              </button>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
