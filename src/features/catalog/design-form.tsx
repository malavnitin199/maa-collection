'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { card, errorBox, input, link, muted, primaryButton, secondaryButton } from '@/components/ui/styles';
import { hasOwnText, SizeRatesEditor, type OwnRatesText } from '@/features/catalog/size-rates-editor';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { formatPaise } from '@/lib/money';
import { ratesForSize, sortSizes } from '@/lib/size-prices';
import { createDesignAction } from '@/server/actions/admin';

type Option = { id: string; name: string };
type CategoryOption = Option & { code: string; sizes?: string[] };

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
  showCost = true,
}: {
  suppliers: Option[];
  categories: CategoryOption[];
  initialSupplierId?: string;
  /** Purchase (code) price field — only with the "costs" right. */
  showCost?: boolean;
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
  // Sizes' own rates (kept while a size is unticked; only ticked sizes are saved).
  const [sizeOwn, setSizeOwn] = useState<OwnRatesText>({});
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
  const category = categories.find((c) => c.id === categoryId);
  // The category's sizes come first; every other size stays one tap away under "More sizes".
  const categorySizes = category?.sizes ?? [];
  const inCategory = (size: string) => categorySizes.some((c) => c.toLowerCase() === size.toLowerCase());
  const otherGroups = SIZE_GROUPS.map((g) => ({ ...g, sizes: g.sizes.filter((size) => !inCategory(size)) })).filter((g) => g.sizes.length > 0);
  const isListed = (size: string) => inCategory(size) || SIZE_GROUPS.some((g) => g.sizes.includes(size));
  const sizeGroups = (
    <>
      {otherGroups.map((group) => (
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
    </>
  );

  // Price by size needs 2+ sizes; what the preview shows is exactly what is sent.
  const orderedSizes = sortSizes(sizes);
  const bySize = sizes.length >= 2;
  const ownRows = bySize
    ? orderedSizes
        .filter((size) => hasOwnText(sizeOwn[size]))
        .map((size) => ({ size, mrp: sizeOwn[size].mrp ?? '', price: sizeOwn[size].price ?? '', cost: showCost ? (sizeOwn[size].cost ?? '') : '' }))
    : [];
  const paise = (text: string) => (text.trim() ? rupeesToPaise(text) : null);
  const defaults = { mrpPaise: paise(mrp), pricePaise: paise(price), costPaise: paise(cost) };
  const sizeRows = orderedSizes.map((size) => {
    const own = ownRows.find((r) => r.size === size);
    return {
      size,
      own: Boolean(own),
      ...ratesForSize(defaults, own && { mrpPaise: paise(own.mrp), pricePaise: paise(own.price), costPaise: paise(own.cost) }),
    };
  });
  const purchaseValue = sizeRows.reduce((sum, r) => sum + (r.costPaise ?? 0), 0) * allColors.length * qty;
  const aboveMrp = sizeRows.filter((r) => r.mrpPaise !== null && r.pricePaise !== null && r.pricePaise > r.mrpPaise).map((r) => r.size);
  const money = (value: number | null) => (value === null ? '—' : formatPaise(value));

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
        sizeRates: ownRows,
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
        {category && categorySizes.length > 0 ? (
          <>
            <div data-testid="category-size-chips" className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                Sizes for {category.name}
                <button
                  type="button"
                  onClick={() => {
                    setSizes((current) => [...current, ...categorySizes.filter((c) => !current.some((s) => s.toLowerCase() === c.toLowerCase()))]);
                    touched();
                  }}
                  className={`text-xs ${link}`}
                >
                  Pick all
                </button>
              </span>
              <div className="flex flex-wrap gap-2">
                {categorySizes.map((size) => (
                  <Chip key={size} selected={sizes.includes(size)} onClick={() => toggleSize(size)} label={`Size ${size}`}>
                    {size}
                  </Chip>
                ))}
              </div>
            </div>
            <details open={sizes.some((size) => !inCategory(size)) || undefined}>
              <summary className={`cursor-pointer text-xs ${muted}`}>More sizes</summary>
              <div className="mt-2 flex flex-col gap-3">{sizeGroups}</div>
            </details>
          </>
        ) : (
          <>
            {!category && <p className={`text-xs ${muted}`}>Choose the category above to see its sizes first.</p>}
            {sizeGroups}
          </>
        )}
        {sizes.filter((s) => !isListed(s)).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sizes
              .filter((s) => !isListed(s))
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
          {showCost && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Purchase price (₹)
              <input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="code price, optional" className={input} />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm font-medium">
            Pieces each
            <input inputMode="numeric" value={quantityEach} onChange={(e) => setQuantityEach(e.target.value)} className={input} />
          </label>
        </div>
        {bySize && (
          <SizeRatesEditor
            sizes={orderedSizes}
            defaults={{ mrp, price, cost }}
            own={sizeOwn}
            onChange={(next) => {
              setSizeOwn(next);
              touched();
            }}
            showCost={showCost}
          />
        )}
        <p className={`text-xs ${muted}`}>
          These rates are for every size and colour{bySize ? ', unless a size has its own price' : ''}. &ldquo;Pieces each&rdquo; = pieces of every
          size in every colour. Purchase (code) price is admin-only; salesmen never see it.
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
              {purchaseValue > 0 && <> · purchase value {formatPaise(purchaseValue)}</>}.
            </p>
            {ownRows.length > 0 && (
              <ul data-testid="size-rates-preview" className="flex flex-col gap-0.5 text-sm">
                {sizeRows.map((r) => (
                  <li key={r.size}>
                    <strong>{r.size}</strong>: {money(r.pricePaise)} <span className={muted}>· MRP {money(r.mrpPaise)}</span>
                    {showCost && r.costPaise !== null && <span className={muted}> · purchase {money(r.costPaise)}</span>}
                    <span className={`text-xs ${muted}`}> {r.own ? '(own price)' : '(default)'}</span>
                  </li>
                ))}
              </ul>
            )}
            {aboveMrp.length > 0 && (
              <p className="text-sm text-red-600">Selling price is above MRP{bySize ? ` for size ${aboveMrp.join(', ')}` : ''}.</p>
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
