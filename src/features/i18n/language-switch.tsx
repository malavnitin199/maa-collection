'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLanguageAction } from '@/server/actions/i18n';
import { useLocale, useT } from './i18n-provider';

/** One tap switches English ⇄ हिन्दी; the page re-renders in place (no reload). */
/** `onBand`: white style for the coloured header band. */
export function LanguageSwitch({ onBand = false }: { onBand?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label={t('lang.switchLabel')}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setLanguageAction(locale === 'en' ? 'hi' : 'en');
          router.refresh();
        })
      }
      className={`rounded-full border px-3 py-1 text-sm font-semibold transition active:scale-95 disabled:opacity-50 ${
        onBand ? 'border-white/25 bg-white/10 text-white hover:bg-white/20' : 'border-zinc-300 bg-white/70 hover:border-brand-400 dark:border-zinc-700 dark:bg-zinc-900/60'
      }`}
    >
      {t('lang.switchTo')}
    </button>
  );
}
