'use client';

import { useActionState, useState, type KeyboardEvent, type ReactNode } from 'react';
import { errorBox, okBox, secondaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import type { MessageKey } from '@/lib/i18n';
import { AGE_GROUPS, AGE_LABEL, FOR_GENDERS, FOR_LABEL, type ProductTags } from '@/lib/product-tags';
import type { FormState } from '@/server/actions/admin';

export type ItemTab = {
  id: string;
  label: string;
  content: ReactNode;
  /** Keep this panel in the printout even when another tab is open (the hang tag). */
  print?: boolean;
  /** Colour code (plan v17): each tab's panel has its own tint so it stands apart from the page. */
  tone?: Tone;
};

type Tone = 'brand' | 'accent' | 'neutral';
const TONE_PANEL: Record<Tone, string> = {
  brand: 'bg-brand-50 dark:bg-brand-950/50',
  accent: 'bg-zari/10 dark:bg-zari/10',
  neutral: 'bg-zinc-100 dark:bg-zinc-900/80',
};
const TONE_DOT: Record<Tone, string> = { brand: 'bg-white', accent: 'bg-zari', neutral: 'bg-zinc-300' };

/**
 * The top tab bar of an item (plan v17): Details · Colours · Other details on a
 * band in the theme's colour, the open one underlined in the accent; below it
 * the open tab's panel in its own tint (colour-coded), so this part reads as
 * separate from the must-haves above. Every panel stays mounted (its fields
 * keep what was typed); closed panels are hidden on screen. ←/→ move between tabs.
 */
export function ItemTabs({ tabs, idPrefix }: { tabs: ItemTab[]; idPrefix: string }) {
  const t = useT();
  const [open, setOpen] = useState(tabs[0]?.id);
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = tabs.findIndex((tab) => tab.id === open);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    setOpen(next.id);
    document.getElementById(`${idPrefix}-tab-${next.id}`)?.focus();
  };
  return (
    <div
      data-testid={`${idPrefix}-tabs`}
      className="flex flex-col overflow-hidden rounded-2xl shadow-sm ring-1 ring-brand-200 print:overflow-visible print:rounded-none print:shadow-none print:ring-0 dark:ring-brand-900"
    >
      <div
        role="tablist"
        aria-label={t('cat.tab.aria')}
        onKeyDown={move}
        className="flex gap-1 overflow-x-auto bg-brand-700 px-2 print:hidden dark:bg-brand-900"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`${idPrefix}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={open === tab.id}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={open === tab.id ? 0 : -1}
            onClick={() => setOpen(tab.id)}
            className={`flex shrink-0 items-center gap-1.5 border-b-[3px] px-4 pt-3 pb-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
              open === tab.id ? 'border-zari text-white' : 'border-transparent text-white/70 hover:text-white'
            }`}
          >
            <span aria-hidden className={`h-2 w-2 rounded-full ${TONE_DOT[tab.tone ?? 'brand']}`} />
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${idPrefix}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-tab-${tab.id}`}
          data-tone={tab.tone ?? 'brand'}
          className={`p-3 print:bg-transparent print:p-0 ${TONE_PANEL[tab.tone ?? 'brand']} ${open === tab.id ? '' : tab.print ? 'hidden print:block' : 'hidden'}`}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

/** One row of tap-tags; tapping the chosen one again clears it. */
function TagRow<T extends string>({ label, options, labels, value, onChange }: { label: string; options: readonly T[]; labels: Record<T, MessageKey>; value: T | null; onChange: (v: T | null) => void }) {
  const t = useT();
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(value === option ? null : option)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition active:scale-95 ${
            value === option
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
          }`}
        >
          {t(labels[option])}
        </button>
      ))}
    </div>
  );
}

/** "For: Girls · Boys · Both" and "Age: Adult · Child" (plan v17). Controlled; both optional. */
export function TagChooser({ value, onChange }: { value: ProductTags; onChange: (next: ProductTags) => void }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5">
      <TagRow label={t('cat.tag.for')} options={FOR_GENDERS} labels={FOR_LABEL} value={value.forGender} onChange={(forGender) => onChange({ ...value, forGender })} />
      <TagRow label={t('cat.tag.age')} options={AGE_GROUPS} labels={AGE_LABEL} value={value.ageGroup} onChange={(ageGroup) => onChange({ ...value, ageGroup })} />
    </div>
  );
}

/** Product page: change the tags of the whole design (every size and colour). */
export function DesignTagsForm({ action, initial, count }: { action: (state: FormState, formData: FormData) => Promise<FormState>; initial: ProductTags; count: number }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});
  const [value, setValue] = useState<ProductTags>(initial);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <TagChooser value={value} onChange={setValue} />
      <input type="hidden" name="forGender" value={value.forGender ?? ''} />
      <input type="hidden" name="ageGroup" value={value.ageGroup ?? ''} />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{t(count === 1 ? 'cat.tag.forWhole.one' : 'cat.tag.forWhole.other', { n: count })}</p>
      {state.error && (
        <p role="alert" className={errorBox}>
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className={okBox}>
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${secondaryButton} w-fit`}>
        {pending ? t('common.saving') : t('cat.tag.save')}
      </button>
    </form>
  );
}
