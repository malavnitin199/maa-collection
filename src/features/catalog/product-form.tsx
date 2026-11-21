'use client';

import { useActionState, useState } from 'react';
import { errorBox, input, muted, okBox, primaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import { LangText } from '@/features/i18n/lang-text';
import type { ProductTags } from '@/lib/product-tags';
import type { FormState } from '@/server/actions/admin';
import { CompanyPicker } from './company-picker';
import { TagChooser } from './item-parts';

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
  /** Adding only: hidden companies the owner can bring back from the company box. */
  previousSuppliers?: { id: string; name: string }[];
  /** Show the purchase (code) price field — only for people with the "costs" right. */
  showCost?: boolean;
};

function Field({ label, name, defaultValue, hint, inputMode, required = true, words = false }: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
  inputMode?: 'decimal' | 'numeric';
  required?: boolean;
  /** Words (a name, a colour): typed in Hindi or English, or spoken. */
  words?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {label}
        {words ? (
          <LangText name={name} defaultValue={defaultValue} required={required} />
        ) : (
          <input name={name} defaultValue={defaultValue} inputMode={inputMode} required={required} className={input} />
        )}
      </label>
      {hint && <span className={`text-xs ${muted}`}>{hint}</span>}
    </div>
  );
}

export function ProductForm({ action, mode, initial, categories, suppliers, previousSuppliers = [], showCost = true }: Props) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});
  const [barcodeMode, setBarcodeMode] = useState<'generate' | 'manufacturer'>('generate');
  // Who it is for (plan v17), only when adding: on the product page the design-wide tags sit above this form.
  const [tags, setTags] = useState<ProductTags>({ forGender: null, ageGroup: null });
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? '');

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('cat.form.name')} name="name" defaultValue={initial?.name} words />
        <Field label={t('item.brand')} name="brand" defaultValue={initial?.brand} words required={false} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('item.category')}
          <select name="categoryId" required defaultValue={initial?.categoryId ?? ''} className={input}>
            <option value="">{t('cat.form.chooseCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </label>
        {mode === 'new' ? (
          <CompanyPicker
            label={t('cat.form.supplierOptional')}
            companies={suppliers}
            previous={previousSuppliers}
            value={supplierId}
            emptyLabel={t('cat.form.noSupplier')}
            name="supplierId"
            onChange={(id) => setSupplierId(id)}
          />
        ) : (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('cat.form.supplierOptional')}
            <select name="supplierId" defaultValue={initial?.supplierId ?? ''} className={input}>
              <option value="">{t('cat.form.noSupplier')}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode === 'new' && (
          <div className="sm:col-span-2">
            <TagChooser value={tags} onChange={setTags} />
            <input type="hidden" name="forGender" value={tags.forGender ?? ''} />
            <input type="hidden" name="ageGroup" value={tags.ageGroup ?? ''} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('cat.form.size')} name="size" defaultValue={initial?.size} required={false} />
          {/* Colour only when editing on the product page (owner, 2026-11-22). */}
          {mode !== 'new' && <Field label={t('cat.form.colour')} name="color" defaultValue={initial?.color} words required={false} />}
        </div>
        <Field label={t('cat.mrpRupees')} name="mrp" inputMode="decimal" defaultValue={initial?.mrp} />
        <Field
          label={t('cat.form.price')}
          name="price"
          inputMode="decimal"
          defaultValue={initial?.price}
          hint={t('cat.form.priceHint')}
        />
        {showCost && (
          <Field
            label={t('cat.form.cost')}
            name="cost"
            inputMode="decimal"
            required={false}
            defaultValue={initial?.cost}
            hint={t('cat.form.costHint')}
          />
        )}
        {mode === 'new' && <Field label={t('cat.form.openingStock')} name="openingStock" inputMode="numeric" defaultValue="0" />}
      </div>

      {mode === 'new' && (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1 font-medium">{t('item.barcode')}</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="barcodeMode" value="generate" checked={barcodeMode === 'generate'} onChange={() => setBarcodeMode('generate')} />
            {t('cat.form.generate')}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="barcodeMode" value="manufacturer" checked={barcodeMode === 'manufacturer'} onChange={() => setBarcodeMode('manufacturer')} />
            {t('cat.form.manufacturer')}
          </label>
          {barcodeMode === 'manufacturer' && (
            <input
              name="barcode"
              inputMode="numeric"
              maxLength={13}
              placeholder={t('cat.form.barcodePlaceholder')}
              className={`${input} max-w-sm font-mono`}
            />
          )}
        </fieldset>
      )}

      {mode === 'edit' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} />
          {t('cat.form.active')}
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
        {pending ? t('common.saving') : mode === 'new' ? t('cat.form.submitNew') : t('cat.saveChanges')}
      </button>
    </form>
  );
}
