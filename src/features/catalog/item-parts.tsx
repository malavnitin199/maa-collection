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
};

/**
 * The top tab bar of an item (plan v17): Details · Colours · Other details, an
 * underline on the open one. Every panel stays mounted (its fields keep what
 * was typed); closed panels are hidden on screen. ←/→ move between tabs.
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
    <div className="flex flex-col">
      <div
        role="tablist"
        aria-label={t('cat.tab.aria')}
        onKeyDown={move}
        className="flex gap-1 overflow-x-auto border-b border-zinc-200 print:hidden dark:border-zinc-800"
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
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
              open === tab.id ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300' : 'border-transparent text-zinc-500 dark:text-zinc-400'
            }`}
          >
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
          className={`pt-4 ${open === tab.id ? '' : tab.print ? 'hidden print:block' : 'hidden'}`}
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
