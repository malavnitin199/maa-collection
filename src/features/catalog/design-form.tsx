'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { card, cardMuted, errorBox, input, link, muted, primaryButton, secondaryButton } from '@/components/ui/styles';
import { hasOwnText, SizeRatesEditor, type OwnRatesText } from '@/features/catalog/size-rates-editor';
import { useT } from '@/features/i18n/i18n-provider';
import { rupeesToPaise } from '@/features/inventory/inventory';
import type { MessageKey } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { ratesForSize, sortSizes } from '@/lib/size-prices';
import { addPhotoToItemsAction, createDesignAction } from '@/server/actions/admin';
import { photoForm, PhotoSlot, type PickedPhoto } from './photo-slot';

type Option = { id: string; name: string };
type CategoryOption = Option & { code: string; sizes?: string[] };

const SIZE_GROUPS: { label: MessageKey; sizes: string[] }[] = [
  { label: 'stk.design.group.clothing', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
  { label: 'stk.design.group.waist', sizes: ['26', '28', '30', '32', '34', '36', '38', '40', '42', '44'] },
  { label: 'stk.design.group.other', sizes: ['Free'] },
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
          ? 'border-brand-600 bg-brand-600 text-white'
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
  const t = useT();
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
  // Optional photo per colour (key: colour in lower case); every size of that colour gets it.
  const [colorPhotos, setColorPhotos] = useState<Record<string, PickedPhoto>>({});
  const [progress, setProgress] = useState<string | null>(null);
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
          <span className={`text-xs ${muted}`}>{t(group.label)}</span>
          <div className="flex flex-wrap gap-2">
            {group.sizes.map((size) => (
              <Chip key={size} selected={sizes.includes(size)} onClick={() => toggleSize(size)} label={t('stk.sizeAria', { size })}>
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
    setProgress(null);
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
      // Items are saved; now the optional photos, one per colour (a failed photo never loses the items).
      let photoFailed = false;
      for (const color of allColors) {
        const photo = colorPhotos[color.toLowerCase()];
        const ids = result.items.filter((item) => item.color.toLowerCase() === color.toLowerCase()).map((item) => item.id);
        if (!photo || ids.length === 0) continue;
        setProgress(t('stk.design.savingPhotoOf', { color }));
        const saved = await addPhotoToItemsAction(ids, photoForm(photo));
        if (saved.error) photoFailed = true;
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
      onChange={touched}
      className="flex flex-col gap-5"
    >
      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-semibold">{t('stk.design.step1')}</h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('stk.supplier')}
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
            <option value="">{t('stk.chooseSupplier')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {suppliers.length === 0 && (
          <p className="text-sm">
            {t('stk.design.noSuppliers')}{' '}
            <Link href="/admin/suppliers" className={link}>
              {t('stk.design.addOneFirst')}
            </Link>
          </p>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('stk.category')}
          <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input}>
            <option value="">{t('stk.chooseCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </label>
        <p className={`text-xs ${muted}`}>
          {t('stk.design.missingCategory')}{' '}
          <Link href="/admin/categories" className={link}>
            {t('stk.design.addItHere')}
          </Link>
          .
        </p>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-semibold">{t('stk.design.step2')}</h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('stk.design.name')}
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder={t('stk.design.namePlaceholder')} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('stk.brand')}
          <input required value={brand} onChange={(e) => setBrand(e.target.value)} className={input} />
        </label>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-semibold">{t('stk.design.step3')}</h2>
        {category && categorySizes.length > 0 ? (
          <>
            <div data-testid="category-size-chips" className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between gap-2 text-xs font-medium text-brand-800 dark:text-brand-300">
                {t('stk.design.sizesFor', { name: category.name })}
                <button
                  type="button"
                  onClick={() => {
                    setSizes((current) => [...current, ...categorySizes.filter((c) => !current.some((s) => s.toLowerCase() === c.toLowerCase()))]);
                    touched();
                  }}
                  className={`text-xs ${link}`}
                >
                  {t('stk.design.pickAll')}
                </button>
              </span>
              <div className="flex flex-wrap gap-2">
                {categorySizes.map((size) => (
                  <Chip key={size} selected={sizes.includes(size)} onClick={() => toggleSize(size)} label={t('stk.sizeAria', { size })}>
                    {size}
                  </Chip>
                ))}
              </div>
            </div>
            <details open={sizes.some((size) => !inCategory(size)) || undefined}>
              <summary className={`cursor-pointer text-xs ${muted}`}>{t('stk.design.moreSizes')}</summary>
              <div className="mt-2 flex flex-col gap-3">{sizeGroups}</div>
            </details>
          </>
        ) : (
          <>
            {!category && <p className={`text-xs ${muted}`}>{t('stk.design.chooseCategoryFirst')}</p>}
            {sizeGroups}
          </>
        )}
        {sizes.filter((s) => !isListed(s)).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sizes
              .filter((s) => !isListed(s))
              .map((size) => (
                <Chip key={size} selected onClick={() => toggleSize(size)} label={t('stk.sizeAria', { size })}>
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
            placeholder={t('stk.design.otherSizePlaceholder')}
            aria-label={t('stk.design.otherSize')}
            className={`w-full ${input}`}
          />
          <button type="button" onClick={addCustomSize} className={secondaryButton}>
            {t('stk.design.addSize')}
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('stk.design.colours')}</span>
          {colors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <Chip
                  key={color}
                  selected
                  label={t('stk.design.removeColour', { color })}
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
              placeholder={t('stk.design.colourPlaceholder')}
              aria-label={t('stk.colour')}
              className={`w-full ${input}`}
            />
            <button type="button" onClick={addColor} className={secondaryButton}>
              {t('stk.design.addColour')}
            </button>
          </div>
        </div>

        {allColors.length > 0 && (
          <div data-testid="colour-photos" className="flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-900">
            <span className="text-sm font-medium">
              {t('stk.design.photoEach')} <span className={`font-normal ${muted}`}>{t('stk.optional')}</span>
            </span>
            <p className={`text-xs ${muted}`}>{t('stk.design.photoHelp')}</p>
            <ul className="flex flex-col gap-2">
              {allColors.map((color) => (
                <li key={color} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm">{color}</span>
                  <PhotoSlot
                    label={color}
                    photo={colorPhotos[color.toLowerCase()] ?? null}
                    disabled={saving}
                    onChange={(photo) => {
                      touched();
                      setColorPhotos((current) => {
                        const next = { ...current };
                        if (photo) next[color.toLowerCase()] = photo;
                        else delete next[color.toLowerCase()];
                        return next;
                      });
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-semibold">{t('stk.design.step4')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            MRP (₹)
            <input required inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('stk.sellingPrice')}
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={mrp || t('stk.sameAsMrp')} className={input} />
          </label>
          {showCost && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('stk.purchasePrice')}
              <input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder={t('stk.codePriceOptional')} className={input} />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('stk.design.piecesEach')}
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
        <p className={`text-xs ${muted}`}>{t(bySize ? 'stk.design.ratesNoteBySize' : 'stk.design.ratesNote')}</p>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('stk.billNoOptional')}
          <input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} className={input} />
        </label>
      </section>

      <section data-testid="design-preview" className={`${cardMuted} flex flex-col gap-2`}>
        <h2 className="font-semibold">{t('stk.design.preview')}</h2>
        {combos === 0 ? (
          <p className={`text-sm ${muted}`}>{t('stk.design.previewEmpty')}</p>
        ) : (
          <>
            <p className="text-sm">
              <strong>{combos}</strong>{' '}
              {t(
                category
                  ? combos === 1
                    ? 'stk.design.itemsSku.one'
                    : 'stk.design.itemsSku.other'
                  : combos === 1
                    ? 'stk.design.items.one'
                    : 'stk.design.items.other',
                {
                  colours: t(allColors.length === 1 ? 'stk.design.colourCount.one' : 'stk.design.colourCount.other', { n: allColors.length }),
                  sizes: t(sizes.length === 1 ? 'stk.design.sizeCount.one' : 'stk.design.sizeCount.other', { n: sizes.length }),
                  code: category?.code ?? '',
                },
              )}{' '}
              <strong>{combos * qty}</strong>{' '}
              {purchaseValue > 0 ? t('stk.design.piecesTotalValue', { value: formatPaise(purchaseValue) }) : t('stk.design.piecesTotal')}
            </p>
            {ownRows.length > 0 && (
              <ul data-testid="size-rates-preview" className="flex flex-col gap-0.5 text-sm">
                {sizeRows.map((r) => (
                  <li key={r.size}>
                    <strong>{r.size}</strong>: {money(r.pricePaise)} <span className={muted}>· MRP {money(r.mrpPaise)}</span>
                    {showCost && r.costPaise !== null && <span className={muted}> · {t('stk.design.purchase', { value: money(r.costPaise) })}</span>}
                    <span className={`text-xs ${muted}`}> {r.own ? t('stk.design.ownPrice') : t('stk.design.default')}</span>
                  </li>
                ))}
              </ul>
            )}
            {aboveMrp.length > 0 && (
              <p className="text-sm text-red-600">{bySize ? t('stk.design.aboveMrpSizes', { sizes: aboveMrp.join(', ') }) : t('stk.design.aboveMrp')}</p>
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
        {saving ? (progress ?? t('common.saving')) : t(combos === 1 ? 'stk.design.save.one' : 'stk.design.save.other', { n: combos || '' })}
      </button>
    </form>
  );
}
