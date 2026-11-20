'use client';

import { useSyncExternalStore } from 'react';
import { useT } from '@/features/i18n/i18n-provider';
import { scriptButton, type Script } from '@/features/i18n/lang-text';
import { speechInputSupported, useSpeechInput, type SpeechError } from '@/features/i18n/speech-input';
import type { MessageKey } from '@/lib/i18n';

const ERROR_KEY: Record<SpeechError, MessageKey> = { denied: 'type.micDenied', nothing: 'type.noSpeech', failed: 'type.micError' };
const supported = () => speechInputSupported();

/**
 * The microphone next to a box: tap, say the words, they land in the box
 * (added after what is already there). Hidden when the browser cannot listen.
 */
export function SpeakButton({ script, text, onText }: { script: Script; text: string; onText: (next: string) => void }) {
  const t = useT();
  const canListen = useSyncExternalStore(() => () => {}, supported, () => false);
  const join = (said: string) => (text.trim() ? `${text.trim()} ${said}` : said);
  const speech = useSpeechInput({ lang: script, onFinal: (said) => onText(join(said)) });
  if (!canListen) return null;
  const label = speech.listening ? t('type.listening') : t('type.speak');
  return (
    <>
      <button
        type="button"
        onClick={speech.listening ? speech.stop : speech.start}
        aria-label={label}
        title={label}
        aria-pressed={speech.listening}
        className={`${scriptButton} ${speech.listening ? 'mic-live border-red-400 text-red-600 dark:text-red-400' : ''}`}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
        </svg>
      </button>
      {speech.error && (
        <span role="alert" className="basis-full text-xs text-red-600 dark:text-red-400">
          {t(ERROR_KEY[speech.error])}
        </span>
      )}
    </>
  );
}
