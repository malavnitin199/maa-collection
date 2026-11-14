'use client';

import { useActionState, useState } from 'react';
import { errorBox, input, muted, okBox, primaryButton } from '@/components/ui/styles';
import type { FormState } from '@/server/actions/admin';

export type ProductFormValues = {
  name: string;
  brand: string;
  category: string;
  size: string;
  color: string;
  mrp: string;
  price: string;
  cost: string;
  active: boolean;
};

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  mode: 'new' | 'edit';
  initial?: ProductFormValues;
  categories: string[];
};

function Field({ label, name, defaultValue, hint, inputMode, required = true }: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
  inputMode?: 'decimal' | 'numeric';
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {label}
        <input
          name={name}
          defaultValue={defaultValue}
          inputMode={inputMode}
          required={required}
          list={name === 'category' ? 'category-options' : undefined}
          className={input}
        />
      </label>
      {hint && <span className={`text-xs ${muted}`}>{hint}</span>}
    </div>
  );
}

export function ProductForm({ action, mode, initial, categories }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [barcodeMode, setBarcodeMode] = useState<'generate' | 'manufacturer'>('generate');

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Product name" name="name" defaultValue={initial?.name} />
        <Field label="Brand" name="brand" defaultValue={initial?.brand} />
        <Field label="Category" name="category" defaultValue={initial?.category} hint="e.g. Kurta, Saree, Jeans. Used in the SKU." />
        <datalist id="category-options">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Size" name="size" defaultValue={initial?.size} />
          <Field label="Colour" name="color" defaultValue={initial?.color} />
        </div>
        <Field label="MRP (₹)" name="mrp" inputMode="decimal" defaultValue={initial?.mrp} />
        <Field
          label="Selling price (₹)"
          name="price"
          inputMode="decimal"
          defaultValue={initial?.price}
          hint="Prefilled at the counter; staff can bargain lower. Must be ≤ MRP."
        />
        <Field
          label="Cost price (₹, optional)"
          name="cost"
          inputMode="decimal"
          required={false}
          defaultValue={initial?.cost}
          hint="Admin only. Used for profit; never shown to salesmen."
        />
        {mode === 'new' && <Field label="Opening stock (pieces)" name="openingStock" inputMode="numeric" defaultValue="0" />}
      </div>

      {mode === 'new' && (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1 font-medium">Barcode</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="barcodeMode" value="generate" checked={barcodeMode === 'generate'} onChange={() => setBarcodeMode('generate')} />
            Generate a new barcode for this product
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="barcodeMode" value="manufacturer" checked={barcodeMode === 'manufacturer'} onChange={() => setBarcodeMode('manufacturer')} />
            Use the barcode already on the tag (manufacturer EAN-13)
          </label>
          {barcodeMode === 'manufacturer' && (
            <input
              name="barcode"
              inputMode="numeric"
              maxLength={13}
              placeholder="13 digits — type it or scan it into this box"
              className={`${input} max-w-sm font-mono`}
            />
          )}
        </fieldset>
      )}

      {mode === 'edit' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} />
          Active (unticked products cannot be scanned or sold)
        </label>
      )}

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
      <button type="submit" disabled={pending} className={`${primaryButton} w-fit`}>
        {pending ? 'Saving…' : mode === 'new' ? 'Add product and generate label' : 'Save changes'}
      </button>
    </form>
  );
}
