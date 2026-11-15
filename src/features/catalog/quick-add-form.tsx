'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { card, errorBox, input, link, muted, primaryButton, secondaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { formatPaise } from '@/lib/money';
import { addPhotoToItemsAction, createQuickAction } from '@/server/actions/admin';
import { photoForm, PhotoSlot, type PickedPhoto } from './photo-slot';

type Option = { id: string; name: string };
type Row = { key: number; name: string; size: string; color: string; mrp: string; price: string; cost: string; quantity: string; more: boolean; photo: PickedPhoto | null };

let nextKey = 1;
const emptyRow = (): Row => ({ key: nextKey++, name: '', size: '', color: '', mrp: '', price: '', cost: '', quantity: '1', more: false, photo: null });

export function QuickAddForm({
  suppliers,
  categories,
  initialSupplierId,
  showCost = true,
}: {
  suppliers: Option[];
  categories: (Option & { code: string; sizes?: string[] })[];
  initialSupplierId?: string;
  /** Purchase (code) price field — only with the "costs" right. */
  showCost?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(initialSupplierId ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [rows, setRows] = useState<Row[]>(() => [emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  // Same id while nothing changes: a double tap or retry saves once.
  const operationId = useRef<string | null>(null);
  const touched = () => {
    operationId.current = null;
  };

  const update = (key: number, patch: Partial<Row>) => {
    touched();
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const addRow = (copyFrom?: Row) => {
    touched();
    setRows((current) => [...current, copyFrom ? { ...copyFrom, key: nextKey++, name: '', photo: null } : emptyRow()]);
  };
  const removeRow = (key: number) => {
    touched();
    setRows((current) => (current.length === 1 ? [emptyRow()] : current.filter((r) => r.key !== key)));
  };

  const filled = rows.filter((r) => r.name.trim());
  const pieces = filled.reduce((n, r) => n + (/^\d+$/.test(r.quantity) ? Number(r.quantity) : 0), 0);
  const purchaseValue = filled.reduce((sum, r) => {
    const cost = rupeesToPaise(r.cost);
    return sum + (cost ?? 0) * (/^\d+$/.test(r.quantity) ? Number(r.quantity) : 0);
  }, 0);
  const supplierName = suppliers.find((s) => s.id === supplierId)?.name;

  function save() {
    setError(null);
    setProgress(null);
    operationId.current ??= crypto.randomUUID();
    const opId = operationId.current;
    startSaving(async () => {
      const result = await createQuickAction({
        operationId: opId,
        supplierId,
        categoryId,
        brand,
        billNumber,
        rows: rows.map(({ name, size, color, mrp, price, cost, quantity }) => ({ name, size, color, mrp, price, cost, quantity })),
      });
      if (!result.ok) return setError(result.error);
      // Items are saved (same order as the filled cards); now the optional photos.
      let photoFailed = false;
      const saved = rows.filter((r) => r.name.trim());
      for (const [i, row] of saved.entries()) {
        const item = result.items[i];
        if (!row.photo || !item) continue;
        setProgress(t('stk.quick.savingPhoto', { n: i + 1 }));
        const added = await addPhotoToItemsAction([item.id], photoForm(row.photo));
        if (added.error) photoFailed = true;
      }
      router.push(`/admin/labels/print?receipt=${result.receiptId}&created=${result.created}${photoFailed ? '&photos=failed' : ''}`);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-4"
    >
      <section className={`${card} flex flex-col gap-3`}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('stk.quick.company')}
          <select required value={supplierId} onChange={(e) => { setSupplierId(e.target.value); touched(); }} className={input}>
            <option value="">{t('stk.quick.chooseCompany')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('stk.category')}
          <select required value={categoryId} onChange={(e) => { setCategoryId(e.target.value); touched(); }} className={input}>
            <option value="">{t('stk.chooseCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('stk.brand')}
            <input value={brand} onChange={(e) => { setBrand(e.target.value); touched(); }} placeholder={supplierName ?? t('stk.quick.companyName')} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('stk.quick.billNo')}
            <input value={billNumber} onChange={(e) => { setBillNumber(e.target.value); touched(); }} placeholder={t('stk.optionalWord')} className={input} />
          </label>
        </div>
        {/* Size suggestions from the chosen category. */}
        <datalist id="category-sizes">
          {(categories.find((c) => c.id === categoryId)?.sizes ?? []).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <p className={`text-xs ${muted}`}>
          {t('stk.quick.missing')}{' '}
          <Link href="/admin/suppliers" className={link}>
            {t('stk.quick.addCompany')}
          </Link>{' '}
          ·{' '}
          <Link href="/admin/categories" className={link}>
            {t('stk.quick.addCategory')}
          </Link>
        </p>
      </section>

      <ol data-testid="quick-rows" className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <li key={row.key} className={`${card} flex flex-col gap-2`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{t('stk.quick.product', { n: index + 1 })}</span>
              <span className="flex gap-3 text-sm">
                <button type="button" onClick={() => addRow(row)} className={link}>
                  {t('stk.quick.copy')}
                </button>
                <button type="button" onClick={() => removeRow(row.key)} className="text-red-600" aria-label={t('stk.quick.removeAria', { n: index + 1 })}>
                  {t('stk.remove')}
                </button>
              </span>
            </div>
            <input
              aria-label={t('stk.quick.nameAria', { n: index + 1 })}
              value={row.name}
              onChange={(e) => update(row.key, { name: e.target.value })}
              placeholder={t('stk.quick.namePlaceholder')}
              className={input}
            />
            <PhotoSlot label={t('stk.quick.productLower', { n: index + 1 })} photo={row.photo} disabled={saving} onChange={(photo) => update(row.key, { photo })} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ['mrp', 'MRP ₹', 'stk.quick.aria.mrp', 'decimal', '0'],
                  ['price', t('stk.quick.selling'), 'stk.quick.aria.price', 'decimal', row.mrp || t('stk.sameAsMrp')],
                  ...(showCost ? ([['cost', t('stk.quick.purchase'), 'stk.quick.aria.cost', 'decimal', t('stk.optionalWord')]] as const) : []),
                  ['quantity', t('stk.quick.pieces'), 'stk.quick.aria.quantity', 'numeric', '0'],
                ] as const
              ).map(([field, title, aria, mode, placeholder]) => (
                <label key={field} className={`flex flex-col gap-0.5 text-xs font-medium ${muted}`}>
                  {title}
                  <input
                    aria-label={t(aria, { n: index + 1 })}
                    inputMode={mode}
                    value={row[field]}
                    onChange={(e) => update(row.key, { [field]: e.target.value })}
                    placeholder={placeholder}
                    className={`${input} text-zinc-900 dark:text-zinc-100`}
                  />
                </label>
              ))}
            </div>
            {row.more ? (
              <div className="grid grid-cols-2 gap-2">
                <input aria-label={t('stk.quick.aria.size', { n: index + 1 })} list="category-sizes" value={row.size} onChange={(e) => update(row.key, { size: e.target.value })} placeholder={t('stk.quick.sizePlaceholder')} className={input} />
                <input aria-label={t('stk.quick.aria.colour', { n: index + 1 })} value={row.color} onChange={(e) => update(row.key, { color: e.target.value })} placeholder={t('stk.quick.colourPlaceholder')} className={input} />
              </div>
            ) : (
              <button type="button" onClick={() => update(row.key, { more: true })} className={`w-fit text-xs ${link}`}>
                {t('stk.quick.sizeColour')}
              </button>
            )}
          </li>
        ))}
      </ol>

      <button type="button" onClick={() => addRow()} className={`${secondaryButton} py-3`}>
        {t('stk.quick.addProduct')}
      </button>

      <p data-testid="quick-summary" className={`text-sm ${muted}`}>
        {t(filled.length === 1 ? 'stk.quick.products.one' : 'stk.quick.products.other', { n: filled.length })} ·{' '}
        {t(pieces === 1 ? 'stk.quick.pieceCount.one' : 'stk.quick.pieceCount.other', { n: pieces })}
        {purchaseValue > 0 && ` · ${t('stk.quick.purchaseValue', { value: formatPaise(purchaseValue) })}`}
      </p>
      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
      <button type="submit" disabled={saving || filled.length === 0} className={`${primaryButton} py-3 text-lg`}>
        {saving ? (progress ?? t('common.saving')) : t(filled.length === 1 ? 'stk.quick.save.one' : 'stk.quick.save.other', { n: filled.length || '' })}
      </button>
    </form>
  );
}
