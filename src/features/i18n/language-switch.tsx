'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLanguageAction } from '@/server/actions/i18n';
import { useLocale, useT } from './i18n-provider';

/** One tap switches English ⇄ हिन्दी; the page re-renders in place (no reload). */
export function LanguageSwitch({ className = '' }: { className?: string }) {
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
      className={`rounded-full border border-zinc-300 px-2.5 py-0.5 text-sm font-medium transition-opacity disabled:opacity-50 dark:border-zinc-700 ${className}`}
    >
      {t('lang.switchTo')}
    </button>
  );
}
