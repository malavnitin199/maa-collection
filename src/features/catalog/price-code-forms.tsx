'use client';

import { useActionState, useState } from 'react';
import { errorBox, input, muted, okBox, primaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import { codeWordProblemKey } from '@/lib/i18n/modules/owner';
import { codeWordProblem, decodePriceCode, encodePriceCode, normalizeCodeWord } from '@/lib/price-code';
import type { FormState } from '@/server/actions/admin';

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function PriceCodeForm({ action, initial }: { action: Action; initial: { word: string; print: boolean } }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});
  const [word, setWord] = useState(initial.word);
  const valid = word.trim() !== '' && !codeWordProblem(word);
  const letters = normalizeCodeWord(word);
  const problem = codeWordProblem(word);
  const problemKey = problem ? codeWordProblemKey(problem) : undefined;
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('own.set.codeWord')}
        <input
          name="priceCodeWord"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={14}
          placeholder={t('own.set.codeWordPlaceholder')}
          className={`${input} font-mono uppercase tracking-widest`}
        />
      </label>
      {word.trim() && !valid && <p className="text-sm text-red-600">{problemKey ? t(problemKey) : problem}</p>}
      {valid && (
        <div data-testid="code-key" className="grid grid-cols-10 gap-1 text-center font-mono text-sm">
          {letters.split('').map((letter, i) => (
            <span key={letter} className="rounded bg-zinc-100 py-1 dark:bg-zinc-800">
              {letter}
              <span className={`block text-xs ${muted}`}>{(i + 1) % 10}</span>
            </span>
          ))}
        </div>
      )}
      {valid && <p className={`text-xs ${muted}`}>{t('own.set.example', { code: encodePriceCode(45000, word) })}</p>}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="printPriceCode" defaultChecked={initial.print} className="h-5 w-5" />
        {t('own.set.printCode')}
      </label>
      {state.error && <p role="alert" className={errorBox}>{state.error}</p>}
      {state.message && <p role="status" className={okBox}>{state.message}</p>}
      <button type="submit" disabled={pending} className={`${primaryButton} py-3`}>
        {pending ? t('common.saving') : t('own.set.save')}
      </button>
    </form>
  );
}

export function PriceCodeDecoder({ word }: { word: string }) {
  const t = useT();
  const [code, setCode] = useState('');
  const rupees = code.trim() ? decodePriceCode(code, word) : null;
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {t('own.set.decodeTag')}
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoCapitalize="characters"
        placeholder={t('own.set.decodePlaceholder')}
        className={`${input} font-mono uppercase tracking-widest`}
      />
      <span data-testid="decoded" className="text-base">
        {code.trim() ? (rupees === null ? t('own.set.notValid') : `= ₹${rupees.toLocaleString('en-IN')}`) : ' '}
      </span>
    </label>
  );
}
