'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useT } from '@/features/i18n/i18n-provider';
import { setSoundEnabled, soundEnabled, subscribeSound, unlockAudio } from './sounds';

/** 🔊/🔇 in the header: scan sounds and vibration on this phone. Also unlocks audio on the first tap. */
export function SoundToggle() {
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
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={t('sound.label')}
      title={on ? t('sound.on') : t('sound.off')}
      onClick={() => setSoundEnabled(!on)}
      className="text-lg leading-none"
    >
      <span aria-hidden>{on ? '🔊' : '🔇'}</span>
    </button>
  );
}
