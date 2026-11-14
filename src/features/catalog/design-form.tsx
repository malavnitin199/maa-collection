'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { card, errorBox, input, link, muted, primaryButton, secondaryButton } from '@/components/ui/styles';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { formatPaise } from '@/lib/money';
import { createDesignAction } from '@/server/actions/admin';

type Option = { id: string; name: string };
type CategoryOption = Option & { code: string };

const SIZE_GROUPS = [
  { label: 'Clothing', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
  { label: 'Waist / chest', sizes: ['26', '28', '30', '32', '34', '36', '38', '40', '42', '44'] },
  { label: 'Other', sizes: ['Free'] },
];

function Chip({ selected, onClick, children, label }: { selected: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={`min-w-12 rounded-full border px-3 py-2 text-sm font-medium ${
        selected
          ? 'border-emerald-600 bg-emerald-600 text-white'
          : 'border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200'
      }`}
    >
      {children}
    </button>
  );
}

export function DesignForm({
  suppliers,
  categories,
  initialSupplierId,
}: {
  suppliers: Option[];
  categories: CategoryOption[];
  initialSupplierId?: string;
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(initialSupplierId ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState(() => suppliers.find((s) => s.id === initialSupplierId)?.name ?? '');
  const [sizes, setSizes] = useState<string[]>([]);
  const [customSize, setCustomSize] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [colorText, setColorText] = useState('');
  const [mrp, setMrp] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [quantityEach, setQuantityEach] = useState('1');
  const [billNumber, setBillNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  // Same id while the form is unchanged: a double tap or retry saves once.
  const operationId = useRef<string | null>(null);
  const touched = () => {
    operationId.current = null;
  };

  const toggleSize = (size: string) => {
    touched();
    setSizes((current) => (current.includes(size) ? current.filter((s) => s !== size) : [...current, size]));
  };
  const addCustomSize = () => {
    const value = customSize.trim();
    if (value && !sizes.some((s) => s.toLowerCase() === value.toLowerCase())) setSizes([...sizes, value]);
    setCustomSize('');
    touched();
  };
  const addColor = () => {
    const values = colorText.split(',').map((c) => c.trim()).filter(Boolean);
    const next = [...colors];
    for (const value of values) if (!next.some((c) => c.toLowerCase() === value.toLowerCase())) next.push(value);
    setColors(next);
    setColorText('');
    touched();
  };

  const allColors = colorText.trim() ? [...colors, ...colorText.split(',').map((c) => c.trim()).filter(Boolean)] : colors;
  const combos = sizes.length * allColors.length;
  const qty = /^\d+$/.test(quantityEach) ? Number(quantityEach) : 0;
  const mrpPaise = rupeesToPaise(mrp);
  const pricePaise = price.trim() ? rupeesToPaise(price) : mrpPaise;
  const costPaise = rupeesToPaise(cost);
  const category = categories.find((c) => c.id === categoryId);

  function save() {
    setError(null);
    operationId.current ??= crypto.randomUUID();
    const opId = operationId.current;
    startSaving(async () => {
      const result = await createDesignAction({
        operationId: opId,
        supplierId,
        categoryId,
        name,
        brand,
        sizes,
        colors: allColors,
        mrp,
        price,
        cost,
        quantityEach,
        billNumber,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/admin/labels/print?receipt=${result.receiptId}&created=${result.created}`);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onChange={touched}
      className="flex flex-col gap-5"
    >
      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-semibold">1. From whom, what kind</h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Supplier
          <select
            required
            value={supplierId}
            onChange={(e) => {
              const next = suppliers.find((s) => s.id === e.target.value);
              const previous = suppliers.find((s) => s.id === supplierId);
              if (!brand || brand === previous?.name) setBrand(next?.name ?? '');
              setSupplierId(e.target.value);
            }}
            className={input}
          >
            <option value="">Choose supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {suppliers.length === 0 && (
          <p className="text-sm">
            No suppliers yet.{' '}
            <Link href="/admin/suppliers" className={link}>
              Add one first →
            </Link>
          </p>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium">
          Category
          <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input}>
            <option value="">Choose category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </label>
        <p className={`text-xs ${muted}`}>
          Missing a category?{' '}
          <Link href="/admin/categories" className={link}>
            Add it here
          </Link>
          .
        </p>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-semibold">2. The design</h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Design / product name
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cotton Straight Kurta" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Brand
          <input required value={brand} onChange={(e) => setBrand(e.target.value)} className={input} />
        </label>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-semibold">3. Sizes and colours</h2>
        {SIZE_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1.5">
            <span className={`text-xs ${muted}`}>{group.label}</span>
            <div className="flex flex-wrap gap-2">
              {group.sizes.map((size) => (
                <Chip key={size} selected={sizes.includes(size)} onClick={() => toggleSize(size)} label={`Size ${size}`}>
                  {size}
                </Chip>
              ))}
            </div>
          </div>
        ))}
        {sizes.filter((s) => !SIZE_GROUPS.some((g) => g.sizes.includes(s))).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sizes
              .filter((s) => !SIZE_GROUPS.some((g) => g.sizes.includes(s)))
              .map((size) => (
                <Chip key={size} selected onClick={() => toggleSize(size)} label={`Size ${size}`}>
                  {size} ✕
                </Chip>
              ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={customSize}
            onChange={(e) => setCustomSize(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomSize();
              }
            }}
            placeholder="Other size, e.g. 5-6Y"
            aria-label="Other size"
            className={`w-full ${input}`}
          />
          <button type="button" onClick={addCustomSize} className={secondaryButton}>
            Add size
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Colours</span>
          {colors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <Chip
                  key={color}
                  selected
                  label={`Remove colour ${color}`}
                  onClick={() => {
                    setColors(colors.filter((c) => c !== color));
                    touched();
                  }}
                >
                  {color} ✕
                </Chip>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={colorText}
              onChange={(e) => setColorText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addColor();
                }
              }}
              placeholder="e.g. Blue, Red"
              aria-label="Colour"
              className={`w-full ${input}`}
            />
            <button type="button" onClick={addColor} className={secondaryButton}>
              Add colour
            </button>
          </div>
        </div>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-semibold">4. Rates and pieces</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            MRP (₹)
            <input required inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Selling price (₹)
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={mrp || 'same as MRP'} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Purchase price (₹)
            <input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="code price, optional" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Pieces each
            <input inputMode="numeric" value={quantityEach} onChange={(e) => setQuantityEach(e.target.value)} className={input} />
          </label>
        </div>
        <p className={`text-xs ${muted}`}>
          &ldquo;Pieces each&rdquo; = pieces of every size in every colour. Purchase (code) price is admin-only; salesmen never see it.
        </p>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Supplier bill no. (optional)
          <input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} className={input} />
        </label>
      </section>

      <section data-testid="design-preview" className={`${card} flex flex-col gap-2 bg-zinc-50 dark:bg-zinc-900`}>
        <h2 className="font-semibold">Preview</h2>
        {combos === 0 ? (
          <p className={`text-sm ${muted}`}>Pick at least one size and add at least one colour.</p>
        ) : (
          <>
            <p className="text-sm">
              <strong>{combos}</strong> new item{combos === 1 ? '' : 's'} ({allColors.length} colour{allColors.length === 1 ? '' : 's'} ×{' '}
              {sizes.length} size{sizes.length === 1 ? '' : 's'}), each with its own barcode
              {category && ` and SKU MAA-${category.code}-…`}. <strong>{combos * qty}</strong> pieces in total
              {costPaise !== null && costPaise > 0 && <> · purchase value {formatPaise(combos * qty * costPaise)}</>}.
            </p>
            {mrpPaise !== null && pricePaise !== null && pricePaise > mrpPaise && (
              <p className="text-sm text-red-600">Selling price is above MRP.</p>
            )}
            <ul className={`flex flex-wrap gap-1 text-xs ${muted}`}>
              {allColors.flatMap((c) =>
                sizes.map((s) => (
                  <li key={`${c}-${s}`} className="rounded bg-white px-2 py-0.5 dark:bg-zinc-800">
                    {c} · {s}
                  </li>
                )),
              )}
            </ul>
          </>
        )}
      </section>

      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
      <button type="submit" disabled={saving || combos === 0} className={`${primaryButton} py-3 text-lg`}>
        {saving ? 'Saving…' : `Save ${combos || ''} item${combos === 1 ? '' : 's'} and print labels`}
      </button>
    </form>
  );
}
