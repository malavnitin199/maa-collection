'use client';

import { useActionState, useState } from 'react';
import { errorBox, input, muted, okBox, primaryButton } from '@/components/ui/styles';
import type { FormState } from '@/server/actions/admin';

export type ProductFormValues = {
  name: string;
  brand: string;
  categoryId: string;
  supplierId: string;
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
  categories: { id: string; name: string; code: string }[];
  suppliers: { id: string; name: string }[];
  /** Show the purchase (code) price field — only for people with the "costs" right. */
  showCost?: boolean;
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
            className={input}
        />
      </label>
      {hint && <span className={`text-xs ${muted}`}>{hint}</span>}
    </div>
  );
}

export function ProductForm({ action, mode, initial, categories, suppliers, showCost = true }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [barcodeMode, setBarcodeMode] = useState<'generate' | 'manufacturer'>('generate');

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Product name" name="name" defaultValue={initial?.name} />
        <Field label="Brand" name="brand" defaultValue={initial?.brand} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Category
          <select name="categoryId" required defaultValue={initial?.categoryId ?? ''} className={input}>
            <option value="">Choose category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Supplier (optional)
          <select name="supplierId" defaultValue={initial?.supplierId ?? ''} className={input}>
            <option value="">No supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
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
        {showCost && (
          <Field
            label="Purchase price / code price (₹, optional)"
            name="cost"
            inputMode="decimal"
            required={false}
            defaultValue={initial?.cost}
            hint="What you paid. Admin only, never shown to salesmen; can print on tags as a letter code (Settings)."
          />
        )}
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
