'use client';

import { useState, useTransition } from 'react';
import { IconLogout } from '@/components/ui/icons';
import { useT } from '@/features/i18n/i18n-provider';
import { plural } from '@/lib/i18n';
import { forgetCatalogue } from '@/offline/catalogue';
import { forgetSavedPages } from '@/offline/helper';
import { logoutAction } from '@/server/actions/auth';
import { useOutbox } from './hooks';

/**
 * ⋯ menu → Log out (plan v18). Sales still waiting on this phone are kept (they
 * are sent at the next login), so this only warns. Logging out also removes the
 * counter page and the items' copy saved on the phone for offline use.
 */
export function LogoutRow({ staffId, className }: { staffId: string; className: string }) {
  const t = useT();
  const outbox = useOutbox();
  const unsent = outbox.filter((s) => s.recordedBy === staffId).length;
  const [warning, setWarning] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const logOut = () =>
    startBusy(async () => {
      setProblem(null);
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return setProblem(t('off.logout.needsInternet'));
      await Promise.all([forgetSavedPages(), forgetCatalogue()]);
      try {
        await logoutAction();
      } catch {
        setProblem(t('off.logout.needsInternet'));
      }
    });

  if (warning) {
    return (
      <div data-testid="logout-warning" className="flex flex-col gap-2 rounded-2xl bg-amber-50 p-3 dark:bg-amber-950/60">
        <p className="text-sm font-medium text-amber-950 dark:text-amber-100">{plural(t, 'off.logout.warn', unsent)}</p>
        {problem && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{problem}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setWarning(false)} className="min-h-10 rounded-xl border border-zinc-300 text-sm font-semibold dark:border-zinc-700">
            {t('common.cancel')}
          </button>
          <button type="button" disabled={busy} onClick={logOut} className="min-h-10 rounded-xl bg-red-600 text-sm font-bold text-white disabled:opacity-60">
            {t('off.logout.anyway')}
          </button>
        </div>
      </div>
    );
  }
  return (
    <>
      <button type="button" disabled={busy} onClick={() => (unsent > 0 ? setWarning(true) : logOut())} className={`${className} text-red-700 dark:text-red-300`}>
        <IconLogout className="h-5 w-5" />
        {t('nav.logout')}
      </button>
      {problem && <p role="alert" className="px-3 text-sm font-semibold text-red-700 dark:text-red-300">{problem}</p>}
    </>
  );
}
