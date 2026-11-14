'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { card, errorBox, input, link, muted, primaryButton, secondaryButton } from '@/components/ui/styles';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { formatPaise } from '@/lib/money';
import { createQuickAction } from '@/server/actions/admin';

type Option = { id: string; name: string };
type Row = { key: number; name: string; size: string; color: string; mrp: string; price: string; cost: string; quantity: string; more: boolean };

let nextKey = 1;
const emptyRow = (): Row => ({ key: nextKey++, name: '', size: '', color: '', mrp: '', price: '', cost: '', quantity: '1', more: false });

export function QuickAddForm({
  suppliers,
  categories,
  initialSupplierId,
}: {
  suppliers: Option[];
  categories: (Option & { code: string })[];
  initialSupplierId?: string;
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(initialSupplierId ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [rows, setRows] = useState<Row[]>(() => [emptyRow()]);
  const [error, setError] = useState<string | null>(null);
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
    setRows((current) => [...current, copyFrom ? { ...copyFrom, key: nextKey++, name: '' } : emptyRow()]);
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
      router.push(`/admin/labels/print?receipt=${result.receiptId}&created=${result.created}`);
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
          Company (supplier)
          <select required value={supplierId} onChange={(e) => { setSupplierId(e.target.value); touched(); }} className={input}>
            <option value="">Choose company…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Category
          <select required value={categoryId} onChange={(e) => { setCategoryId(e.target.value); touched(); }} className={input}>
            <option value="">Choose category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Brand
            <input value={brand} onChange={(e) => { setBrand(e.target.value); touched(); }} placeholder={supplierName ?? 'company name'} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Bill no.
            <input value={billNumber} onChange={(e) => { setBillNumber(e.target.value); touched(); }} placeholder="optional" className={input} />
          </label>
        </div>
        <p className={`text-xs ${muted}`}>
          Missing something?{' '}
          <Link href="/admin/suppliers" className={link}>
            Add a company
          </Link>{' '}
          ·{' '}
          <Link href="/admin/categories" className={link}>
            Add a category
          </Link>
        </p>
      </section>

      <ol data-testid="quick-rows" className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <li key={row.key} className={`${card} flex flex-col gap-2`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Product {index + 1}</span>
              <span className="flex gap-3 text-sm">
                <button type="button" onClick={() => addRow(row)} className={link}>
                  Copy
                </button>
                <button type="button" onClick={() => removeRow(row.key)} className="text-red-600" aria-label={`Remove product ${index + 1}`}>
                  Remove
                </button>
              </span>
            </div>
            <input
              aria-label={`Product ${index + 1} name`}
              value={row.name}
              onChange={(e) => update(row.key, { name: e.target.value })}
              placeholder="Product name, e.g. Georgette Saree"
              className={input}
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ['mrp', 'MRP ₹', 'MRP', 'decimal', '0'],
                  ['price', 'Selling ₹ (shown)', 'selling price', 'decimal', row.mrp || 'same as MRP'],
                  ['cost', 'Purchase ₹ (code)', 'purchase price', 'decimal', 'optional'],
                  ['quantity', 'Pieces', 'pieces', 'numeric', '0'],
                ] as const
              ).map(([field, title, aria, mode, placeholder]) => (
                <label key={field} className={`flex flex-col gap-0.5 text-xs font-medium ${muted}`}>
                  {title}
                  <input
                    aria-label={`Product ${index + 1} ${aria}`}
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
                <input aria-label={`Product ${index + 1} size`} value={row.size} onChange={(e) => update(row.key, { size: e.target.value })} placeholder="Size (Free)" className={input} />
                <input aria-label={`Product ${index + 1} colour`} value={row.color} onChange={(e) => update(row.key, { color: e.target.value })} placeholder="Colour (Assorted)" className={input} />
              </div>
            ) : (
              <button type="button" onClick={() => update(row.key, { more: true })} className={`w-fit text-xs ${link}`}>
                + size / colour
              </button>
            )}
          </li>
        ))}
      </ol>

      <button type="button" onClick={() => addRow()} className={`${secondaryButton} py-3`}>
        + Add product
      </button>

      <p data-testid="quick-summary" className={`text-sm ${muted}`}>
        {filled.length} product{filled.length === 1 ? '' : 's'} · {pieces} piece{pieces === 1 ? '' : 's'}
        {purchaseValue > 0 && ` · purchase value ${formatPaise(purchaseValue)}`}
      </p>
      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
      <button type="submit" disabled={saving || filled.length === 0} className={`${primaryButton} py-3 text-lg`}>
        {saving ? 'Saving…' : `Save ${filled.length || ''} product${filled.length === 1 ? '' : 's'} and print labels`}
      </button>
    </form>
  );
}
