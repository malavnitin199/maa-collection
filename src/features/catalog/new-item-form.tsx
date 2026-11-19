'use client';

import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { GarmentArt } from '@/components/ui/art';
import { Pill } from '@/components/ui/pill';
import { card, errorBox, input, link, muted, primaryButton, secondaryButton } from '@/components/ui/styles';
import { CompanyPicker } from '@/features/catalog/company-picker';
import { ItemTabs } from '@/features/catalog/item-parts';
import { hasOwnText, SizeRatesEditor, type OwnRatesText } from '@/features/catalog/size-rates-editor';
import { useT } from '@/features/i18n/i18n-provider';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { formatPaise } from '@/lib/money';
import { ratesForSize, sortSizes } from '@/lib/size-prices';
import { addPhotoToItemsAction, createDesignAction } from '@/server/actions/admin';
import { photoForm, PhotoSlot, usePhotoPicker, type PickedPhoto } from './photo-slot';

type Option = { id: string; name: string };

/** What an item is saved as when no colour is given (colour is optional since plan v19). */
const PLAIN_COLOUR = 'Assorted';

const fieldLabel = 'flex min-w-0 flex-col gap-1 text-sm font-medium';

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

/** Today in the shop (India), for the stock date box. */
export function shopToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

/**
 * New item, last step (plan v19): what was chosen in the first three steps
 * (section › type, sizes with their pieces) is fixed here; this step asks the
 * product name and photo, the must-haves — company, sale price (MRP),
 * purchase price — and behind top tabs **Details** (counter price, bill no.,
 * stock date), **Colours** (optional; each colour × size its own item, a photo
 * per colour, a price by size) and **Other details** (brand). The company,
 * bill no. and stock date belong to the whole entry (kept for the next item).
 */
export function NewItemForm({
  suppliers,
  previousSuppliers,
  type,
  path,
  sizes,
  pieces,
  supplierId,
  onSupplier,
  billNumber,
  onBillNumber,
  stockDate,
  onStockDate,
  onChangeSizes,
  onSaved,
  showCost = true,
}: {
  suppliers: Option[];
  /** Hidden companies the owner can bring back from the company box. */
  previousSuppliers: Option[];
  /** The chosen type (category). */
  type: Option & { code: string };
  /** "Boy › Jeans", shown in the header. */
  path: string;
  /** The chosen sizes (at least one) and the pieces of each. */
  sizes: string[];
  pieces: Record<string, number>;
  supplierId: string;
  onSupplier: (id: string, name: string) => void;
  billNumber: string;
  onBillNumber: (value: string) => void;
  stockDate: string;
  onStockDate: (value: string) => void;
  /** Back to the sizes step. */
  onChangeSizes: () => void;
  /** Saved: the labels page is next (`href`). */
  onSaved: (href: string) => void;
  /** Purchase (code) price field — only with the "costs" right. */
  showCost?: boolean;
}) {
  const t = useT();
  const [name, setName] = useState('');
  const supplierName = suppliers.find((s) => s.id === supplierId)?.name ?? previousSuppliers.find((s) => s.id === supplierId)?.name ?? '';
  const [brand, setBrand] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [mrp, setMrp] = useState('');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [colorText, setColorText] = useState('');
  // Sizes' own rates (only the chosen sizes are saved).
  const [sizeOwn, setSizeOwn] = useState<OwnRatesText>({});
  // Optional photo per colour (key: colour in lower case); colours without one get the main photo.
  const [colorPhotos, setColorPhotos] = useState<Record<string, PickedPhoto>>({});
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  // Same id while the entry is unchanged: a double tap or retry saves once.
  const operationId = useRef<string | null>(null);
  const touched = () => {
    operationId.current = null;
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
  // What is sent: no colour given = one plain colour per size.
  const sendColors = allColors.length > 0 ? allColors : [PLAIN_COLOUR];
  const orderedSizes = sortSizes(sizes);
  const piecesOf = (size: string) => pieces[size] ?? 1;
  const combos = orderedSizes.length * sendColors.length;
  const totalPieces = orderedSizes.reduce((sum, size) => sum + piecesOf(size), 0) * sendColors.length;

  // Price by size needs 2+ sizes; what the preview shows is exactly what is sent.
  const bySize = orderedSizes.length >= 2;
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
  const purchaseValue = sizeRows.reduce((sum, r) => sum + (r.costPaise ?? 0) * piecesOf(r.size), 0) * sendColors.length;
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
        categoryId: type.id,
        name,
        // No brand typed: kept as the company's name, which a tag never prints (plan v19).
        brand: brand.trim() || supplierName,
        sizes: orderedSizes,
        colors: sendColors,
        mrp,
        price,
        cost,
        sizeRates: ownRows,
        quantityEach: '1',
        quantities: Object.fromEntries(orderedSizes.map((size) => [size, piecesOf(size)])),
        billNumber,
        stockDate,
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
      if (photo) URL.revokeObjectURL(photo.url);
      for (const p of Object.values(colorPhotos)) URL.revokeObjectURL(p.url);
      onSaved(`/admin/labels/print?receipt=${result.receiptId}&created=${result.created}${photoFailed ? '&photos=failed' : ''}`);
    });
  }

  const details = (
    <div className={`${card} flex flex-col gap-3`}>
      <label className={fieldLabel}>
        {t('stk.item.counterPrice')}
        <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={mrp || t('stk.sameAsMrp')} className={`${input} tabular-nums`} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={fieldLabel}>
          {t('stk.billNoOptional')}
          <input value={billNumber} onChange={(e) => onBillNumber(e.target.value)} className={input} />
        </label>
        <label className={fieldLabel}>
          {t('ns.stockDate')}
          <input type="date" value={stockDate} max={shopToday()} onChange={(e) => onStockDate(e.target.value)} className={`${input} min-w-0`} />
        </label>
      </div>
    </div>
  );

  const colours = (
    <div className={`${card} flex flex-col gap-3`}>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          {t('stk.design.colours')} <span className={`font-normal ${muted}`}>{t('stk.optional')}</span>
        </span>
        {colors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={t('stk.design.removeColour', { color })}
                onClick={() => {
                  setColors(colors.filter((c) => c !== color));
                  touched();
                }}
                className="rounded-full border border-brand-600 bg-brand-600 px-3 py-2 text-sm font-medium text-white"
              >
                {color} ✕
              </button>
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
                      {piecesOf(s)}
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
        {t('stk.brand')} <span className={`text-xs font-normal ${muted}`}>{t('ns.brandHint')}</span>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} className={input} />
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
      {/* Header: name, what it is and its sizes on the left (tap the sizes to change them), the photo on the right. */}
      <section className={`${card} flex flex-col gap-3`}>
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <input
              required
              aria-label={t('stk.item.name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('stk.item.name')}
              className="w-full min-w-0 border-0 border-b-2 border-zinc-200 bg-transparent px-0 py-1 text-lg font-semibold placeholder:font-normal placeholder:text-zinc-400 focus:border-brand-600 focus:outline-none dark:border-zinc-700"
            />
            <span data-testid="item-path" className="w-fit rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-200">
              {path}
            </span>
            <button type="button" onClick={onChangeSizes} aria-label={t('ns.changeSizes')} className="flex flex-wrap gap-1 text-left">
              <span data-testid="item-size-pills" className="flex flex-wrap gap-1">
                {orderedSizes.map((s) => (
                  <Pill key={s}>{s}</Pill>
                ))}
              </span>
            </button>
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
            touched();
            onSupplier(id, companyName);
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
        {t(totalPieces === 1 ? 'stk.item.pcs.one' : 'stk.item.pcs.other', { n: totalPieces })}
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
