'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLanguageAction } from '@/server/actions/i18n';
import { headerChip } from '@/components/ui/styles';
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
      className={
        onBand
          ? headerChip
          : 'rounded-full border border-zinc-300 bg-white/70 px-3 py-1 text-sm font-semibold transition hover:border-brand-400 active:scale-95 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/60'
      }
    >
      {/* On the band: a small "A / अ" picture above the language you switch to. */}
      {onBand && (
        <span aria-hidden className="flex h-5 items-center text-[13px] leading-none font-bold">
          A<span className="mx-0.5 opacity-60">/</span>अ
        </span>
      )}
      {t('lang.switchTo')}
    </button>
  );
}
