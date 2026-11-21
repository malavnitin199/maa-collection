'use client';

import { useState, useTransition } from 'react';
import { Dropdown } from '@/components/ui/dropdown';
import { secondaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import { LangText } from '@/features/i18n/lang-text';
import { useDone } from '@/features/feedback/effects';
import { addCompanyAction, restoreCompanyAction, type CompanyResult } from '@/server/actions/admin';

type Company = { id: string; name: string };

const NEW = '__new';
const PREVIOUS = 'previous:';

/**
 * The company box on the add screens (plan v17): the companies in use, then
 * **Previous companies** (hidden ones — tap one to use it again) and
 * **+ New company…** (type a name; an existing name is reused, never doubled).
 * A compact `Dropdown`, not a <select> (2026-11-21: the phone's list filled the screen).
 * `name` adds a hidden input for forms that post FormData.
 */
export function CompanyPicker({
  label,
  companies: initialCompanies,
  previous: initialPrevious,
  value,
  onChange,
  emptyLabel,
  required = false,
  name,
  disabled = false,
}: {
  label: string;
  companies: Company[];
  previous: Company[];
  value: string;
  onChange: (id: string, name: string) => void;
  emptyLabel: string;
  required?: boolean;
  name?: string;
  disabled?: boolean;
}) {
  const t = useT();
  const [companies, setCompanies] = useState(initialCompanies);
  const [previous, setPrevious] = useState(initialPrevious);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const done = useDone();

  const use = (result: CompanyResult) => {
    if (!result.ok) {
      done.show({ kind: 'error', title: t('done.notSaved'), detail: result.error });
      return setError(result.error);
    }
    const company = result.company;
    if (adding) done.show({ title: t('done.companyAdded'), lines: [{ label: t('done.line.name'), value: company.name }] });
    setCompanies((list) => (list.some((c) => c.id === company.id) ? list : [...list, company].sort((a, b) => a.name.localeCompare(b.name))));
    setPrevious((list) => list.filter((c) => c.id !== company.id));
    setAdding(false);
    setNewName('');
    onChange(company.id, company.name);
  };

  const add = () => {
    setError(null);
    const typed = newName.trim();
    if (!typed) return;
    startBusy(async () => use(await addCompanyAction(typed)));
  };

  return (
    <div className="flex flex-col gap-2">
      {done.node}
      <Dropdown
        label={label}
        value={value}
        required={required}
        disabled={disabled || busy}
        placeholder={emptyLabel}
        searchPlaceholder={t('cat.company.search')}
        options={[
          ...companies.map((c) => ({ value: c.id, label: c.name })),
          ...previous.map((c) => ({ value: `${PREVIOUS}${c.id}`, label: c.name, group: t('cat.company.previous') })),
          { value: NEW, label: t('cat.company.new'), tone: 'action' as const },
        ]}
        onChange={(choice) => {
          setError(null);
          if (choice === NEW) return setAdding(true);
          if (choice.startsWith(PREVIOUS)) {
            const id = choice.slice(PREVIOUS.length);
            return startBusy(async () => use(await restoreCompanyAction(id)));
          }
          setAdding(false);
          onChange(choice, companies.find((c) => c.id === choice)?.name ?? '');
        }}
      />
      {name && <input type="hidden" name={name} value={value} />}
      {adding && (
        <div className="flex gap-2">
          <LangText
            autoFocus
            aria-label={t('cat.company.newName')}
            value={newName}
            onValueChange={setNewName}
            className="min-w-0 flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
              if (e.key === 'Escape') setAdding(false);
            }}
            placeholder={t('cat.company.newName')}
          />
          <button type="button" onClick={add} disabled={busy || !newName.trim()} className={`${secondaryButton} shrink-0`}>
            {busy ? t('cat.company.adding') : t('cat.company.add')}
          </button>
          <button type="button" onClick={() => setAdding(false)} aria-label={t('cat.company.cancel')} className={`${secondaryButton} shrink-0 px-3`}>
            ✕
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
