'use client';

import { useEffect } from 'react';
import { applyAppearance, readAppearance } from './appearance';

/** With "follow the phone", switch day/night when the phone does (e.g. at sunset). */
export function AppearanceSync() {
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const onChange = () => {
      const current = readAppearance();
      if (current.mode === 'system') applyAppearance(current);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return null;
}
