'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { LangText } from '@/features/i18n/lang-text';
import { GarmentArt } from '@/components/ui/art';
import { Pill } from '@/components/ui/pill';
import { card, errorBox, input, link, muted, primaryButton, secondaryButton } from '@/components/ui/styles';
import { CompanyPicker } from '@/features/catalog/company-picker';
import { ItemTabs, TagChooser } from '@/features/catalog/item-parts';
import { hasOwnText, SizeRatesEditor, type OwnRatesText } from '@/features/catalog/size-rates-editor';
import { useT } from '@/features/i18n/i18n-provider';
import { rupeesToPaise } from '@/features/inventory/inventory';
import type { MessageKey } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import type { ProductTags } from '@/lib/product-tags';
import { ratesForSize, sortSizes } from '@/lib/size-prices';
import { addPhotoToItemsAction, createDesignAction } from '@/server/actions/admin';
import { photoForm, PhotoSlot, usePhotoPicker, type PickedPhoto } from './photo-slot';

type Option = { id: string; name: string };
type CategoryOption = Option & { code: string; sizes?: string[] };

/** What an item is saved as when no size or colour is picked (same as the old quick add). */
const PLAIN_SIZE = 'Free';
const PLAIN_COLOUR = 'Assorted';

const SIZE_GROUPS: { label: MessageKey; sizes: string[] }[] = [
  { label: 'stk.design.group.clothing', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
  { label: 'stk.design.group.waist', sizes: ['26', '28', '30', '32', '34', '36', '38', '40', '42', '44'] },
  { label: 'stk.design.group.other', sizes: ['Free'] },
];

const fieldLabel = 'flex min-w-0 flex-col gap-1 text-sm font-medium';

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

/**
 * The item's picture on the right of the header: the chosen photo fills the
 * square; before that, dyed cloth with a kurta on a hanger. Tap = gallery,
 * 📷 = camera, ✕ = remove.
 */
function PhotoSquare({ photo, onChange, disabled }: { photo: PickedPhoto | null; onChange: (photo: PickedPhoto | null) => void; disabled: boolean }) {
  const t = useT();
  const label = t('stk.item.photoLabel');
  const { busy, error, inputs, remove, openCamera, openGallery } = usePhotoPicker({ label, photo, onChange });
  const round = 'absolute flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-sm shadow-md ring-1 ring-black/10 transition active:scale-90 disabled:opacity-60 dark:bg-zinc-900/95';
  return (
    <div data-testid="item-photo" className="relative h-28 w-28 shrink-0">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={openGallery}
        aria-label={t('stk.photo.galleryAria', { label })}
        className="relative h-full w-full overflow-hidden rounded-2xl ring-1 ring-brand-100 dark:ring-brand-900"
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview of a resized photo
          <img src={photo.url} alt={t('stk.photo.alt', { label })} className="h-full w-full object-cover" />
        ) : (
          <span className="cloth-backdrop flex h-full w-full items-center justify-center">
            <GarmentArt className="h-20 w-20 text-brand-700 dark:text-brand-300" />
          </span>
        )}
        {busy && <span className="absolute inset-x-0 bottom-0 bg-black/50 py-1 text-[11px] text-white">{t('stk.photo.preparing')}</span>}
      </button>
      {photo ? (
        <button type="button" disabled={disabled} onClick={remove} aria-label={t('stk.photo.removeAria', { label })} className={`${round} -top-2 -right-2`}>
          ✕
        </button>
      ) : (
        <button type="button" disabled={disabled || busy} onClick={openCamera} aria-label={t('stk.photo.takeAria', { label })} className={`${round} -right-2 -bottom-2`}>
          📷
        </button>
      )}
      {inputs}
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * New item (plan v17, owner's layout): one card with the product name, category,
 * sizes and "for whom" tags on the left and the photo on the right; then the
 * must-haves — company, sale price (MRP), purchase price; then top tabs:
 * **Details** (pieces, counter price, bill), **Colours** (sizes × colours, each
 * pair its own item and barcode) and **Other details** (brand; more fields later).
 * Nothing picked under Colours = one item, size Free, colour Assorted.
 */
export function NewItemForm({
  suppliers,
  previousSuppliers,
  categories,
  initialSupplierId,
  initialCategoryId,
  showCost = true,
}: {
  suppliers: Option[];
  /** Hidden companies the owner can bring back from the company box. */
  previousSuppliers: Option[];
  categories: CategoryOption[];
  initialSupplierId?: string;
  initialCategoryId?: string;
  /** Purchase (code) price field — only with the "costs" right. */
  showCost?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(initialSupplierId ?? '');
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? '');
  const [name, setName] = useState('');
  const [supplierName, setSupplierName] = useState(() => suppliers.find((s) => s.id === initialSupplierId)?.name ?? '');
  const [brand, setBrand] = useState(supplierName);
  const [tags, setTags] = useState<ProductTags>({ forGender: null, ageGroup: null });
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [mrp, setMrp] = useState('');
  const [cost, setCost] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [customSize, setCustomSize] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [colorText, setColorText] = useState('');
  // Sizes' own rates (kept while a size is unticked; only ticked sizes are saved).
  const [sizeOwn, setSizeOwn] = useState<OwnRatesText>({});
  // Optional photo per colour (key: colour in lower case); colours without one get the main photo.
  const [colorPhotos, setColorPhotos] = useState<Record<string, PickedPhoto>>({});
  const [error, setError] = useState<string | null>(null);
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
  // What is sent: nothing picked = one plain item.
  const sendSizes = sizes.length > 0 ? sizes : [PLAIN_SIZE];
  const sendColors = allColors.length > 0 ? allColors : [PLAIN_COLOUR];
  const combos = sendSizes.length * sendColors.length;
  const qty = /^\d+$/.test(quantity) ? Number(quantity) : 0;
  const category = categories.find((c) => c.id === categoryId);
  // The category's sizes come first; every other size stays one tap away under "More sizes".
  const categorySizes = category?.sizes ?? [];
  const inCategory = (size: string) => categorySizes.some((c) => c.toLowerCase() === size.toLowerCase());
  const otherGroups = SIZE_GROUPS.map((g) => ({ ...g, sizes: g.sizes.filter((size) => !inCategory(size)) })).filter((g) => g.sizes.length > 0);
  const isListed = (size: string) => inCategory(size) || SIZE_GROUPS.some((g) => g.sizes.includes(size));
  const sizeGroups = otherGroups.map((group) => (
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
  ));

  // Price by size needs 2+ sizes; what the preview shows is exactly what is sent.
  const orderedSizes = sortSizes(sendSizes);
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
  const purchaseValue = sizeRows.reduce((sum, r) => sum + (r.costPaise ?? 0), 0) * sendColors.length * qty;
  const aboveMrp = sizeRows.filter((r) => r.mrpPaise !== null && r.pricePaise !== null && r.pricePaise > r.mrpPaise).map((r) => r.size);
  const money = (value: number | null) => (value === null ? '—' : formatPaise(value));

  function clearItem() {
    operationId.current = null;
    if (photo) URL.revokeObjectURL(photo.url);
    for (const p of Object.values(colorPhotos)) URL.revokeObjectURL(p.url);
    setPhoto(null);
    setColorPhotos({});
    setName('');
    setMrp('');
    setCost('');
    setQuantity('1');
    setPrice('');
    setBillNumber('');
    setSizes([]);
    setCustomSize('');
    setColors([]);
    setColorText('');
    setSizeOwn({});
    setProgress(null);
  }

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
        brand: brand.trim() || supplierName,
        sizes: sendSizes,
        colors: sendColors,
        mrp,
        price,
        cost,
        sizeRates: ownRows,
        quantityEach: quantity,
        billNumber,
        forGender: tags.forGender ?? '',
        ageGroup: tags.ageGroup ?? '',
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Items are saved; now the photos (a failed photo never loses the items).
      // A colour's own photo goes on that colour; the main photo on every other item.
      const uploads: { ids: string[]; photo: PickedPhoto }[] = [];
      const mainIds: string[] = [];
      for (const color of sendColors) {
        const ids = result.items.filter((item) => item.color.toLowerCase() === color.toLowerCase()).map((item) => item.id);
        const own = colorPhotos[color.toLowerCase()];
        if (own) uploads.push({ ids, photo: own });
        else mainIds.push(...ids);
      }
      if (photo && mainIds.length > 0) uploads.unshift({ ids: mainIds, photo });
      let photoFailed = false;
      for (const upload of uploads) {
        if (upload.ids.length === 0) continue;
        setProgress(t('stk.item.savingPhoto'));
        const saved = await addPhotoToItemsAction(upload.ids, photoForm(upload.photo));
        if (saved.error) photoFailed = true;
      }
      // Next 16 keeps this page alive (React Activity) after we leave it: clear the
      // item now, so "Add next item" opens an empty form with a new save id —
      // never the last item's prices. Company, category, tags and brand stay.
      clearItem();
      router.push(`/admin/labels/print?receipt=${result.receiptId}&created=${result.created}${photoFailed ? '&photos=failed' : ''}`);
    });
  }

  const details = (
    <div className={`${card} flex flex-col gap-3`}>
      <label className={fieldLabel}>
        {t(combos > 1 ? 'stk.item.piecesEach' : 'stk.item.pieces')}
        <input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`${input} tabular-nums`} />
      </label>
      <label className={fieldLabel}>
        {t('stk.item.counterPrice')}
        <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={mrp || t('stk.sameAsMrp')} className={`${input} tabular-nums`} />
      </label>
      <label className={fieldLabel}>
        {t('stk.billNoOptional')}
        <input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} className={input} />
      </label>
    </div>
  );

  const colours = (
    <div className={`${card} flex flex-col gap-3`}>
      <span className="text-sm font-medium">{t('stk.item.sizes')}</span>
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

      <div className="flex flex-col gap-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-900">
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

      {/* Every colour × size pair and its pieces: what will be saved. */}
      {combos > 1 && (
        <div className="overflow-x-auto border-t border-zinc-100 pt-3 dark:border-zinc-900">
          <table data-testid="combo-grid" aria-label={t('cat.product.grid')} className="w-full text-center text-sm tabular-nums">
            <thead className={`text-xs ${muted}`}>
              <tr>
                <th className="px-2 py-1 text-left font-medium" />
                {orderedSizes.map((s) => (
                  <th key={s} className="px-2 py-1 font-medium">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sendColors.map((c) => (
                <tr key={c} className="border-t border-zinc-100 dark:border-zinc-900">
                  <th className="px-2 py-1.5 text-left font-medium">{c}</th>
                  {orderedSizes.map((s) => (
                    <td key={s} className="px-2 py-1.5">
                      {qty}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {allColors.length > 0 && (
        <div data-testid="colour-photos" className="flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-900">
          <span className="text-sm font-medium">
            {t('stk.design.photoEach')} <span className={`font-normal ${muted}`}>{t('stk.optional')}</span>
          </span>
          <ul className="flex flex-col gap-2">
            {allColors.map((color) => (
              <li key={color} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">{color}</span>
                <PhotoSlot
                  label={color}
                  photo={colorPhotos[color.toLowerCase()] ?? null}
                  disabled={saving}
                  onChange={(next) => {
                    touched();
                    setColorPhotos((current) => {
                      const copy = { ...current };
                      if (next) copy[color.toLowerCase()] = next;
                      else delete copy[color.toLowerCase()];
                      return copy;
                    });
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {bySize && (
        <div className="border-t border-zinc-100 pt-3 dark:border-zinc-900">
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
          {ownRows.length > 0 && (
            <ul data-testid="size-rates-preview" className="mt-2 flex flex-col gap-0.5 text-sm">
              {sizeRows.map((r) => (
                <li key={r.size}>
                  <strong>{r.size}</strong>: {money(r.pricePaise)} <span className={muted}>· MRP {money(r.mrpPaise)}</span>
                  {showCost && r.costPaise !== null && <span className={muted}> · {t('stk.design.purchase', { value: money(r.costPaise) })}</span>}
                  <span className={`text-xs ${muted}`}> {r.own ? t('stk.design.ownPrice') : t('stk.design.default')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  const other = (
    <div className={`${card} flex flex-col gap-3`}>
      <label className={fieldLabel}>
        {t('stk.brand')}
        <LangText value={brand} onValueChange={setBrand} placeholder={supplierName} />
      </label>
      <p className={`text-xs ${muted}`}>
        {t('stk.item.missing')}{' '}
        <Link href="/admin/suppliers" className={link}>
          {t('stk.item.addCompany')}
        </Link>{' '}
        ·{' '}
        <Link href="/admin/categories" className={link}>
          {t('stk.item.addCategory')}
        </Link>
      </p>
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onChange={touched}
      className="flex flex-col gap-4"
    >
      {/* Header: name, category and sizes on the left, the photo on the right; "for whom" tags below. */}
      <section className={`${card} flex flex-col gap-3`}>
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <LangText
              required
              aria-label={t('stk.item.name')}
              value={name}
              onValueChange={setName}
              placeholder={t('stk.item.name')}
              inputClassName="w-full min-w-0 flex-1 border-0 border-b-2 border-zinc-200 bg-transparent px-0 py-1 text-lg font-semibold placeholder:font-normal placeholder:text-zinc-400 focus:border-brand-600 focus:outline-none dark:border-zinc-700"
            />
            <select
              required
              aria-label={t('stk.item.category')}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-fit max-w-full rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-200"
            >
              <option value="">{t('stk.chooseCategory')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            {sizes.length > 0 && (
              <div data-testid="item-size-pills" className="flex flex-wrap gap-1">
                {sortSizes(sizes).map((s) => (
                  <Pill key={s}>{s}</Pill>
                ))}
              </div>
            )}
          </div>
          <PhotoSquare
            photo={photo}
            disabled={saving}
            onChange={(next) => {
              touched();
              setPhoto(next);
            }}
          />
        </div>
        {/* Who it is for: full width, so each row of tags fits on one line on a phone. */}
        <div className="border-t border-zinc-100 pt-3 dark:border-zinc-900">
          <TagChooser value={tags} onChange={setTags} />
        </div>
      </section>

      {/* The must-haves: where it comes from and its two prices. */}
      <section className={`${card} flex flex-col gap-3`}>
        <CompanyPicker
          label={t('stk.item.company')}
          companies={suppliers}
          previous={previousSuppliers}
          value={supplierId}
          required
          disabled={saving}
          emptyLabel={t('stk.item.chooseCompany')}
          onChange={(id, companyName) => {
            if (!brand || brand === supplierName) setBrand(companyName);
            setSupplierId(id);
            setSupplierName(companyName);
          }}
        />
        <div className={`grid gap-3 ${showCost ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <label className={fieldLabel}>
            {t('stk.item.salePrice')}
            <input required inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value)} placeholder="0" className={`${input} min-w-0 text-lg font-semibold tabular-nums`} />
          </label>
          {showCost && (
            <label className={fieldLabel}>
              {t('stk.item.purchasePrice')}
              <input required inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className={`${input} min-w-0 text-lg tabular-nums`} />
            </label>
          )}
        </div>
      </section>

      <ItemTabs
        idPrefix="item"
        tabs={[
          { id: 'details', label: t('cat.tab.details'), content: details },
          { id: 'colours', label: t('cat.tab.colours'), content: colours, tone: 'amber' },
          { id: 'other', label: t('cat.tab.other'), content: other, tone: 'slate' },
        ]}
      />

      <p data-testid="design-preview" className={`text-sm ${muted}`}>
        <strong className="text-zinc-900 dark:text-zinc-100">{t(combos === 1 ? 'stk.item.count.one' : 'stk.item.count.other', { n: combos })}</strong>
        {' · '}
        {t(combos * qty === 1 ? 'stk.item.pcs.one' : 'stk.item.pcs.other', { n: combos * qty })}
        {purchaseValue > 0 && ` · ${t('stk.item.purchaseTotal', { value: formatPaise(purchaseValue) })}`}
      </p>
      {aboveMrp.length > 0 && (
        <p className="text-sm text-red-600">{bySize ? t('stk.design.aboveMrpSizes', { sizes: aboveMrp.join(', ') }) : t('stk.design.aboveMrp')}</p>
      )}
      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
      <button type="submit" disabled={saving} className={`${primaryButton} py-3 text-lg`}>
        {saving ? (progress ?? t('common.saving')) : t(combos === 1 ? 'stk.item.save.one' : 'stk.item.save.other', { n: combos })}
      </button>
    </form>
  );
}
