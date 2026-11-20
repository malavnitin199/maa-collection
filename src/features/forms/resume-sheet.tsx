'use client';

import { primaryButton, secondaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';

/** Coming back to a form with a lot already filled in: continue, or start fresh (owner's rule, 2026-11-20). */
export function ResumeSheet({ asking, what, onKeep, onFresh }: { asking: boolean; what: 'collection' | 'item'; onKeep: () => void; onFresh: () => void }) {
  const t = useT();
  if (!asking) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="resume-title" data-testid="resume-sheet" className="fb-backdrop fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-4 backdrop-blur-[2px] sm:items-center">
      <div className="sel-sheet flex w-full max-w-sm flex-col gap-3 rounded-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900">
        <p id="resume-title" className="text-lg font-semibold">
          {t('type.resume.title')}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{t('type.resume.text')}</p>
        <button type="button" onClick={onKeep} className={`${primaryButton} py-3`} autoFocus>
          {t('type.resume.keep')}
        </button>
        <button type="button" onClick={onFresh} className={`${secondaryButton} py-3`}>
          {t(what === 'collection' ? 'type.resume.fresh.collection' : 'type.resume.fresh.item')}
        </button>
      </div>
    </div>
  );
}
