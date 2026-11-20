'use client';

import { useActionState, useState } from 'react';
import { errorBox, input, muted, okBox, primaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import { LangText } from '@/features/i18n/lang-text';
import { useFormDone } from '@/features/feedback/effects';
import type { MessageKey } from '@/lib/i18n';
import { SECTION_ICONS, type SectionIcon } from '@/lib/sections';
import { SIZE_PRESETS } from '@/lib/size-lists';
import { SectionArt } from './section-art';
import type { FormState } from '@/server/actions/admin';

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/** Preset buttons whose names have words (the others are just sizes). */
const PRESET_LABELS: Record<string, MessageKey> = { 'Ladies 26–32': 'cat.sizes.presetLadies', 'Gents 28–36': 'cat.sizes.presetGents' };

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className={errorBox}>{state.error}</p>;
  if (state.message) return <p role="status" className={okBox}>{state.message}</p>;
  return null;
}

/** A text field. Words (names, notes) can be typed in Hindi or English (`LangText`); `plain` keeps a simple box (codes, numbers). */
function Text({
  label,
  name,
  defaultValue,
  required,
  hint,
  plain,
  ...rest
}: { label: string; name: string; defaultValue?: string | null; required?: boolean; hint?: string; plain?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'onChange' | 'value'>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {label}
        {plain || (rest.type && rest.type !== 'text') ? (
          <input name={name} defaultValue={defaultValue ?? ''} required={required} className={input} {...rest} />
        ) : (
          <LangText name={name} defaultValue={defaultValue} required={required} force={rest.lang === 'hi' ? 'hi' : undefined} {...rest} />
        )}
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
  location?: string | null;
  active: boolean;
};

export function SupplierForm({ action, initial, submitLabel }: { action: Action; initial?: SupplierValues; submitLabel: string }) {
  const t = useT();
  const field = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
  const done = useFormDone(action, {
    notSaved: t('done.notSaved'),
    describe: (fd) => ({
      title: t(initial ? 'done.companySaved' : 'done.companyAdded'),
      lines: [
        { label: t('done.line.name'), value: field(fd, 'name') },
        { label: t('done.line.contact'), value: field(fd, 'contactName') },
        { label: t('done.line.phone'), value: field(fd, 'phone') },
        { label: t('done.line.location'), value: field(fd, 'location') },
      ].filter((line) => line.value),
    }),
  });
  const [state, formAction, pending] = useActionState(done.action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {done.node}
      <Text label={t('cat.supf.companyName')} name="name" required defaultValue={initial?.name} placeholder={t('cat.supf.companyPlaceholder')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label={t('cat.supf.contact')} name="contactName" defaultValue={initial?.contactName} />
        <Text label={t('cat.supf.phone')} name="phone" type="tel" inputMode="tel" defaultValue={initial?.phone} />
      </div>
      <Text
        label={t('cat.supf.gstin')}
        name="gstin"
        plain
        defaultValue={initial?.gstin}
        maxLength={15}
        autoCapitalize="characters"
        hint={t('cat.supf.gstinHint')}
      />
      <Text label={t('cat.supf.location')} name="location" defaultValue={initial?.location} maxLength={80} />
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

/** A section to put a category under (plan v19), named in the person's language. */
export type SectionChoice = { id: string; name: string };

export function CategoryForm({
  action,
  initial,
  submitLabel,
  sections,
  defaultSectionId,
}: {
  action: Action;
  initial?: { name: string; nameHi?: string | null; code: string; active: boolean; sizes?: readonly string[]; sectionId?: string | null };
  submitLabel: string;
  /** Plan v19: the sections it can go under; none = the shop has no sections yet (set-up not run). */
  sections?: SectionChoice[];
  /** The section chosen on the screen (a new category goes there). */
  defaultSectionId?: string | null;
}) {
  const t = useT();
  const field = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
  const done = useFormDone(action, {
    notSaved: t('done.notSaved'),
    describe: (fd) => ({
      title: t(initial ? 'done.saved' : 'done.categoryAdded'),
      lines: [
        { label: t('done.line.name'), value: field(fd, 'name') },
        { label: t('done.line.hindi'), value: field(fd, 'nameHi') },
        { label: t('done.line.section'), value: sections?.find((s) => s.id === field(fd, 'sectionId'))?.name ?? '' },
        { label: t('done.line.code'), value: field(fd, 'code').toUpperCase() },
        { label: t('done.line.sizes'), value: field(fd, 'sizes') },
      ].filter((line) => line.value),
    }),
  });
  const [state, formAction, pending] = useActionState(done.action, {});
  const sectionId = initial ? (initial.sectionId ?? '') : (defaultSectionId ?? '');
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {done.node}
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label={t('sec.typeNameHi')} name="nameHi" defaultValue={initial?.nameHi} lang="hi" maxLength={40} />
        {sections && sections.length > 0 && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('sec.under')}
            <select name="sectionId" required defaultValue={sectionId} className={input}>
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
      </div>
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

/** The pictures a section can have, as big radio tiles (the chosen one is ringed). */
function PictureField({ initial }: { initial: SectionIcon }) {
  const t = useT();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium">{t('sec.picture')}</legend>
      <div className="flex flex-wrap gap-2">
        {SECTION_ICONS.map((icon) => (
          <label key={icon} className="relative">
            <input type="radio" name="icon" value={icon} defaultChecked={icon === initial} className="peer sr-only" />
            <span
              aria-hidden
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-300 text-brand-700 transition peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:ring-2 peer-checked:ring-brand-500/40 peer-focus-visible:ring-4 dark:border-zinc-700 dark:text-brand-300 dark:peer-checked:bg-brand-950"
            >
              <SectionArt icon={icon} className="h-9 w-9" />
            </span>
            <span className="sr-only">{t(`sec.icon.${icon}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Categories (plan v19): a section's names (English / Hindi), picture and whether
 * New item shows it. Hidden sections keep their categories and items — nothing is deleted.
 */
export function SectionForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: { name: string; nameHi: string | null; icon: SectionIcon; active: boolean };
  submitLabel: string;
}) {
  const t = useT();
  const field = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
  const done = useFormDone(action, {
    notSaved: t('done.notSaved'),
    describe: (fd) => ({
      title: t(initial ? 'done.saved' : 'done.sectionAdded'),
      lines: [
        { label: t('done.line.name'), value: field(fd, 'name') },
        { label: t('done.line.hindi'), value: field(fd, 'nameHi') },
      ].filter((line) => line.value),
    }),
  });
  const [state, formAction, pending] = useActionState(done.action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {done.node}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label={t('sec.name')} name="name" required defaultValue={initial?.name} maxLength={30} />
        <Text label={t('sec.nameHi')} name="nameHi" defaultValue={initial?.nameHi} lang="hi" maxLength={40} />
      </div>
      <PictureField initial={initial?.icon ?? 'hanger'} />
      {initial && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={initial.active} className="h-5 w-5" />
          {t('sec.inUse')}
        </label>
      )}
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={`${primaryButton} py-3`}>
        {pending ? t('common.saving') : submitLabel}
      </button>
    </form>
  );
}

/** Categories with no sections yet: the owner's one-time set-up button (ADR-033). */
export function SetUpSectionsForm({ action }: { action: Action }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-sm">{t('sec.setup.text')}</p>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={`${primaryButton} py-3`}>
        {pending ? t('common.saving') : t('sec.setup.button')}
      </button>
    </form>
  );
}

/** Needs sorting → "Move under" a section: one pick, one tap. */
export function MoveTypeForm({ action, sections, typeName }: { action: Action; sections: SectionChoice[]; typeName: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
          {t('sec.moveUnder')}
          <select name="sectionId" required defaultValue="" aria-label={`${t('sec.moveUnder')} ${typeName}`} className={input}>
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
        <button type="submit" disabled={pending} className={`${primaryButton} py-2.5`}>
          {pending ? t('common.saving') : t('sec.move')}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
