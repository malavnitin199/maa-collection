'use client';

import Link from 'next/link';
import { useT } from '@/features/i18n/i18n-provider';
import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
const keyFor = (id: string) => `maa-tip-dismissed-${id}`;

function isDismissed(id: string): boolean {
  try {
    return localStorage.getItem(keyFor(id)) === '1';
  } catch {
    return false;
  }
}

/**
 * A small "first time here?" card linking to the right Help section.
 * Hidden once dismissed (remembered on this phone; never shown before hydration).
 */
export function FirstTimeTip({ id, text, helpHref }: { id: string; text: string; helpHref: string }) {
  const t = useT();
  const dismissed = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => isDismissed(id),
    () => true,
  );
  if (dismissed) return null;
  return (
    <div role="note" className="flex items-start justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100">
      <span>
        <strong>{t('tip.firstTime')}</strong> {text}{' '}
        <Link href={helpHref} className="font-medium underline underline-offset-2">
          {t('tip.showMe')}
        </Link>
      </span>
      <button
        type="button"
        aria-label={t('tip.hide')}
        onClick={() => {
          try {
            localStorage.setItem(keyFor(id), '1');
          } catch {
            // Storage blocked: the tip just shows again next time.
          }
          listeners.forEach((l) => l());
        }}
        className="shrink-0 text-sky-700 dark:text-sky-300"
      >
        ✕
      </button>
    </div>
  );
}
