'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { headerIcon } from '@/components/ui/styles';
import { IconMute, IconSound } from '@/components/ui/icons';
import { useT } from '@/features/i18n/i18n-provider';
import { setSoundEnabled, soundEnabled, subscribeSound, unlockAudio } from './sounds';

/** 🔊/🔇 in the header: scan sounds and vibration on this phone. Also unlocks audio on the first tap. */
export function SoundToggle({ row }: { row?: string } = {}) {
  const t = useT();
  const on = useSyncExternalStore(subscribeSound, soundEnabled, () => true);
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  // In the header's ⋯ menu (plan v17): a full-width row (`row` = its classes) with the state on the right.
  if (row) {
    return (
      <button type="button" aria-pressed={on} aria-label={t('sound.label')} onClick={() => setSoundEnabled(!on)} className={row}>
        {on ? <IconSound className="h-5 w-5 text-brand-600 dark:text-brand-300" /> : <IconMute className="h-5 w-5 text-zinc-400" />}
        <span className="flex-1">{t('sound.label')}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${on ? 'bg-brand-600 text-white' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'}`}>
          {on ? t('sound.on') : t('sound.off')}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={t('sound.label')}
      title={on ? t('sound.on') : t('sound.off')}
      onClick={() => setSoundEnabled(!on)}
      className={`${headerIcon} ${on ? '' : 'opacity-70'}`}
    >
      {on ? <IconSound className="h-5 w-5" /> : <IconMute className="h-5 w-5" />}
    </button>
  );
}
