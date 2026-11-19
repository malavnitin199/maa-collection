'use client';

import { useActionState, useState } from 'react';
import { errorBox, input, muted, okBox, primaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import type { MessageKey } from '@/lib/i18n';
import { SIZE_PRESETS } from '@/lib/size-lists';
import type { FormState } from '@/server/actions/admin';

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/** Preset buttons whose names have words (the others are just sizes). */
const PRESET_LABELS: Record<string, MessageKey> = { 'Ladies 26–32': 'cat.sizes.presetLadies', 'Gents 28–36': 'cat.sizes.presetGents' };

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className={errorBox}>{state.error}</p>;
  if (state.message) return <p role="status" className={okBox}>{state.message}</p>;
  return null;
}

function Text({
  label,
  name,
  defaultValue,
  required,
  hint,
  ...rest
}: { label: string; name: string; defaultValue?: string | null; required?: boolean; hint?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'defaultValue'>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {label}
        <input name={name} defaultValue={defaultValue ?? ''} required={required} className={input} {...rest} />
      </label>
      {hint && <span className={`text-xs ${muted}`}>{hint}</span>}
    </div>
  );
}

export type SupplierValues = {
  name: string;
  contactName: string | null;
  phone: string | null;
  gstin: string | null;
  notes: string | null;
  active: boolean;
};

export function SupplierForm({ action, initial, submitLabel }: { action: Action; initial?: SupplierValues; submitLabel: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Text label={t('cat.supf.companyName')} name="name" required defaultValue={initial?.name} placeholder={t('cat.supf.companyPlaceholder')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label={t('cat.supf.contact')} name="contactName" defaultValue={initial?.contactName} />
        <Text label={t('cat.supf.phone')} name="phone" type="tel" inputMode="tel" defaultValue={initial?.phone} />
      </div>
      <Text
        label={t('cat.supf.gstin')}
        name="gstin"
        defaultValue={initial?.gstin}
        maxLength={15}
        autoCapitalize="characters"
        hint={t('cat.supf.gstinHint')}
      />
      <Text label={t('cat.supf.notes')} name="notes" defaultValue={initial?.notes} placeholder={t('cat.supf.notesPlaceholder')} />
      {initial && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={initial.active} className="h-5 w-5" />
          {t('cat.supf.active')}
        </label>
      )}
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={`${primaryButton} py-3`}>
        {pending ? t('common.saving') : submitLabel}
      </button>
    </form>
  );
}

/** A category's sizes, typed in shop order, with one-tap presets. */
function SizesField({ initial }: { initial?: readonly string[] }) {
  const t = useT();
  const [value, setValue] = useState((initial ?? []).join(', '));
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('cat.sizes.label')}
        <input name="sizes" value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('cat.sizes.placeholder')} className={input} />
      </label>
      <div role="group" aria-label={t('cat.sizes.presets')} className="flex flex-wrap gap-2">
        {SIZE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setValue(preset.sizes.join(', '))}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
          >
            {PRESET_LABELS[preset.label] ? t(PRESET_LABELS[preset.label]) : preset.label}
          </button>
        ))}
      </div>
      <p className={`text-xs ${muted}`}>
        {t('cat.sizes.hint')}
      </p>
    </div>
  );
}

export function CategoryForm({
  action,
  initial,
  submitLabel,
  sections,
}: {
  action: Action;
  initial?: { name: string; code: string; active: boolean; sizes?: readonly string[]; sectionId?: string | null };
  submitLabel: string;
  /** Plan v19: who the category is for (Man / Woman / Girl / Boy …), names in the person's language. */
  sections?: { id: string; name: string }[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {sections && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('sec.formLabel')}
          <select name="sectionId" required defaultValue={initial?.sectionId ?? ''} className={input}>
            <option value="" disabled>
              {t('sec.choose')}
            </option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Text label={t('cat.catf.name')} name="name" required defaultValue={initial?.name} placeholder={t('cat.catf.namePlaceholder')} />
        <Text
          label={t('cat.catf.code')}
          name="code"
          required={Boolean(initial)}
          defaultValue={initial?.code}
          maxLength={3}
          autoCapitalize="characters"
          placeholder={t('cat.catf.codePlaceholder')}
          className={`${input} uppercase`}
        />
      </div>
      <p className={`text-xs ${muted}`}>{t('cat.catf.codeHint')}</p>
      <SizesField initial={initial?.sizes} />
      {initial && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={initial.active} className="h-5 w-5" />
          {t('cat.catf.active')}
        </label>
      )}
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={`${primaryButton} py-3`}>
        {pending ? t('common.saving') : submitLabel}
      </button>
    </form>
  );
}

/** Categories (plan v19): a section's name, picture and whether it is in use (hidden ones leave New item; nothing is deleted). */
export function SectionForm({
  action,
  initial,
  pictures,
}: {
  action: Action;
  initial: { name: string; icon: string; active: boolean };
  /** Picture keys with their names in the person's language. */
  pictures: { key: string; label: string }[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <Text label={t('ns.addSection.name')} name="name" required defaultValue={initial.name} maxLength={30} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('ns.addSection.picture')}
          <select name="icon" defaultValue={initial.icon} className={input}>
            {pictures.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={initial.active} className="h-5 w-5" />
        {t('sec.inUse')}
      </label>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={`${primaryButton} py-3`}>
        {pending ? t('common.saving') : t('cat.cat.save')}
      </button>
    </form>
  );
}
