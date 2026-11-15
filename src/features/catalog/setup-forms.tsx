'use client';

import { useActionState, useState } from 'react';
import { errorBox, input, muted, okBox, primaryButton } from '@/components/ui/styles';
import { SIZE_PRESETS } from '@/lib/size-lists';
import type { FormState } from '@/server/actions/admin';

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

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
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Text label="Company name" name="name" required defaultValue={initial?.name} placeholder="e.g. XYZ Textiles" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label="Contact person (optional)" name="contactName" defaultValue={initial?.contactName} />
        <Text label="Phone (optional)" name="phone" type="tel" inputMode="tel" defaultValue={initial?.phone} />
      </div>
      <Text
        label="GSTIN (optional)"
        name="gstin"
        defaultValue={initial?.gstin}
        maxLength={15}
        autoCapitalize="characters"
        hint="15 characters, for purchase bills later."
      />
      <Text label="Notes (optional)" name="notes" defaultValue={initial?.notes} placeholder="e.g. delivers on Mondays, 30-day credit" />
      {initial && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={initial.active} className="h-5 w-5" />
          Active (inactive suppliers are hidden when adding stock)
        </label>
      )}
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={`${primaryButton} py-3`}>
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}

/** A category's sizes, typed in shop order, with one-tap presets. */
function SizesField({ initial }: { initial?: readonly string[] }) {
  const [value, setValue] = useState((initial ?? []).join(', '));
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Sizes (in shop order)
        <input name="sizes" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. S, M, L, XL, XXL" className={input} />
      </label>
      <div role="group" aria-label="Size presets" className="flex flex-wrap gap-2">
        {SIZE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setValue(preset.sizes.join(', '))}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p className={`text-xs ${muted}`}>
        Tags print all these sizes with a tick box each (this piece&apos;s size marked), and new stock offers them first. Leave
        empty if sizes vary.
      </p>
    </div>
  );
}

export function CategoryForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: { name: string; code: string; active: boolean; sizes?: readonly string[] };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Text label="Category name" name="name" required defaultValue={initial?.name} placeholder="e.g. Lehenga" />
        <Text
          label="Code"
          name="code"
          required={Boolean(initial)}
          defaultValue={initial?.code}
          maxLength={3}
          autoCapitalize="characters"
          placeholder="auto"
          className={`${input} uppercase`}
        />
      </div>
      <p className={`text-xs ${muted}`}>The code goes into new SKUs (e.g. MAA-LE-001). Leave it empty to pick one automatically.</p>
      <SizesField initial={initial?.sizes} />
      {initial && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={initial.active} className="h-5 w-5" />
          Active
        </label>
      )}
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={`${primaryButton} py-3`}>
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
