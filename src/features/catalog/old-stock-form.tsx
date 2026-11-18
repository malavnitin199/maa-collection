'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { card, errorBox, input, link, muted, okBox, primaryButton, secondaryButton } from '@/components/ui/styles';
import { checkTagBarcodeAction, editTaggedItemAction, tagOldStockAction, type OldStockResult, type TagLookup } from '@/server/actions/admin';
import { useT } from '@/features/i18n/i18n-provider';
import { ScanInput } from '@/features/scanning/scan-input';
import { itemLink } from '@/lib/item-link';
import { tagSizeRange } from '@/lib/size-lists';
import { IconPencil } from '@/components/ui/icons';
import type { ProductTags } from '@/lib/product-tags';
import { TagChooser } from './item-parts';
import { HangTag } from './hang-tag';
import { PhotoPickers } from './photo-manager';
import { resizePhoto } from './resize-photo';

type Option = { id: string; name: string };
type Photo = { key: number; blob: Blob; url: string };
type Saved = Extract<OldStockResult, { ok: true }>;

const QUICK_SIZES = ['Free', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', '38', '40'];
let photoKey = 1;

export function OldStockForm({ categories, suppliers, showCost }: { categories: (Option & { code: string; sizes?: string[] })[]; suppliers: Option[]; showCost: boolean }) {
  const t = useT();
  const [categoryId, setCategoryId] = useState('');
  // The category's own sizes first (shop order), then the usual ones.
  const categorySizes = categories.find((c) => c.id === categoryId)?.sizes ?? [];
  const sizeChoices = [...categorySizes, ...QUICK_SIZES.filter((s) => !categorySizes.some((c) => c.toLowerCase() === s.toLowerCase()))];
  const [supplierId, setSupplierId] = useState('');
  const [name, setName] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [mrp, setMrp] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [quantity, setQuantity] = useState('1');
  // Who it is for (plan v17); kept for the next item, like category and size.
  const [tags, setTags] = useState<ProductTags>({ forGender: null, ageGroup: null });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [tag, setTag] = useState<TagLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  // Edit: the form opens again, filled in, to fix the item just saved (same barcode).
  const [editing, setEditing] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, startTransition] = useTransition();
  const [preparing, setPreparing] = useState(false);
  // Same id until something changes: a double tap saves once.
  const operationId = useRef<string | null>(null);
  const touched = () => {
    operationId.current = null;
  };

  // Free the photo previews when they're removed or the screen closes.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  });
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  async function addPhotos(files: File[]) {
    setError(null);
    setPreparing(true);
    touched();
    try {
      const resized: Photo[] = [];
      for (const file of files.slice(0, 4)) {
        const { blob } = await resizePhoto(file);
        resized.push({ key: photoKey++, blob, url: URL.createObjectURL(blob) });
      }
      setPhotos((current) => [...current, ...resized].slice(0, 4));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('stk.photo.cantUse'));
    } finally {
      setPreparing(false);
    }
  }

  function removePhoto(key: number) {
    touched();
    setPhotos((current) => {
      const photo = current.find((p) => p.key === key);
      if (photo) URL.revokeObjectURL(photo.url);
      return current.filter((p) => p.key !== key);
    });
  }

  function save() {
    setError(null);
    operationId.current ??= crypto.randomUUID();
    const form = new FormData();
    form.set('operationId', operationId.current);
    form.set('categoryId', categoryId);
    form.set('supplierId', supplierId);
    form.set('name', name);
    form.set('size', size);
    form.set('color', color);
    form.set('mrp', mrp);
    form.set('price', price);
    form.set('cost', cost);
    form.set('quantity', quantity);
    form.set('forGender', tags.forGender ?? '');
    form.set('ageGroup', tags.ageGroup ?? '');
    form.set('barcode', tag?.status === 'new' ? tag.barcode : '');
    for (const photo of photos) form.append('photos', new File([photo.blob], 'photo.jpg', { type: 'image/jpeg' }));
    if (editing && saved) {
      const productId = saved.product.id;
      startTransition(async () => {
        const result = await editTaggedItemAction(productId, form);
        if (!result.ok) return setError(result.error);
        setSaved(result);
        setEditing(false);
        setUpdated(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      return;
    }
    startTransition(async () => {
      const result = await tagOldStockAction(form);
      if (!result.ok) return setError(result.error);
      setSaved(result);
      setUpdated(false);
      setCount((n) => n + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function nextItem() {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setName('');
    setColor('');
    setMrp('');
    setPrice('');
    setCost('');
    setQuantity('1');
    setTag(null);
    setScanning(false);
    setSaved(null);
    setEditing(false);
    setUpdated(false);
    touched();
    // Category, company, size and For / Age stay: old stock is usually tagged shelf by shelf.
  }

  if (saved && !editing) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className={okBox}>
          {updated ? (
            t('stk.old.updated')
          ) : (
            <>
              {t('stk.old.saved', { name: saved.product.name, barcode: saved.product.barcode })}{' '}
              {saved.product.barcode.startsWith('200') ? t('stk.old.stickLabel') : t('stk.old.usesTagBarcode')}
            </>
          )}
          {saved.photoError && <span className="block text-red-700">{t('stk.old.photoProblem', { error: saved.photoError })}</span>}
          {saved.pricesKept && <span className="mt-1 block text-amber-800 dark:text-amber-300">{t('stk.old.pricesKept')}</span>}
        </p>
        <div className="mx-auto">
          <HangTag product={saved.product} sizes={tagSizeRange(categorySizes, [], saved.product.size)} qrValue={itemLink(window.location.origin, saved.product.barcode)} />
        </div>
        <button type="button" onClick={nextItem} className={`${primaryButton} py-3 text-lg`} autoFocus>
          {t('stk.old.nextItem')}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`${secondaryButton} py-3`}
          >
            <IconPencil className="h-4 w-4" />
            {t('stk.old.edit')}
          </button>
          <Link href="/admin/labels/print?mine=today" className={`${secondaryButton} py-3 text-center`}>
            {t('stk.printTodaysLabels')}
          </Link>
        </div>
        <Link href={`/admin/products/${saved.product.id}`} className={`text-center text-sm ${link}`}>
          {t('stk.old.openItem')} →
        </Link>
        <p className={`text-center text-sm ${muted}`}>{t(count === 1 ? 'stk.old.session.one' : 'stk.old.session.other', { n: count })}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {editing && saved && (
        <div className={`${okBox} flex flex-col gap-1`}>
          <p className="font-semibold">{t('stk.old.editing', { name: saved.product.name, barcode: saved.product.barcode })}</p>
          <p>{t('stk.old.editHint')}</p>
        </div>
      )}
      {/* Outside the main <form>: the scanner has its own form, and forms can't be nested. */}
      {!editing && (
      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-semibold">
          {t('stk.old.step0')} <span className={`text-sm font-normal ${muted}`}>{t('stk.optional')}</span>
        </h2>
        {tag?.status === 'new' ? (
          <p data-testid="tag-barcode" className={okBox}>
            {t('stk.old.willUse')} <span className="font-mono">{tag.barcode}</span> {t('stk.old.willUseRest')}{' '}
            <button type="button" onClick={() => { setTag(null); touched(); }} className="underline">
              {t('stk.remove')}
            </button>
          </p>
        ) : scanning ? (
          <ScanInput
            label={t('stk.old.scanLabel')}
            onScan={(code) =>
              startTransition(async () => {
                const result = await checkTagBarcodeAction(code);
                setTag(result);
                touched();
                if (result.status === 'new') setScanning(false);
              })
            }
            busy={busy}
          />
        ) : (
          <button type="button" onClick={() => setScanning(true)} className={`${secondaryButton} py-3`}>
            {t('stk.old.scanButton')}
          </button>
        )}
        {tag?.status === 'exists' && (
          <p role="alert" className={errorBox}>
            {t('stk.old.exists', {
              name: tag.product.name,
              color: tag.product.color,
              size: tag.product.size,
              sku: tag.product.sku,
              stock: tag.product.stock,
            })}{' '}
            <Link href={`/admin/products/${tag.product.id}`} className="underline">
              {t('stk.old.openIt')}
            </Link>{' '}
            {t('stk.old.existsRest')}
          </p>
        )}
        {tag?.status === 'invalid' && (
          <p role="alert" className={errorBox}>
            {t('stk.old.invalid', { code: tag.code })}
          </p>
        )}
        {!tag && !scanning && <p className={`text-xs ${muted}`}>{t('stk.old.skip')}</p>}
      </section>
      )}

    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onChange={touched}
      className="flex flex-col gap-4"
    >
      {count > 0 && !editing && (
        <p className={`text-sm ${muted}`}>
          {t('stk.old.soFar', { n: count })}{' '}
          <Link href="/admin/labels/print?mine=today" className={link}>
            {t('stk.old.printTodaysLower')}
          </Link>
        </p>
      )}

      {!editing && (
      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-semibold">{t('stk.old.step1')} <span className={`text-sm font-normal ${muted}`}>{t('stk.old.photosHint')}</span></h2>
        {photos.length > 0 && (
          <ul data-testid="new-photos" className="grid grid-cols-4 gap-2">
            {photos.map((photo, i) => (
              <li key={photo.key} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a resized photo */}
                <img src={photo.url} alt={t('stk.old.newPhoto', { n: i + 1 })} className="aspect-square w-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(photo.key)}
                  aria-label={t('stk.old.removePhoto', { n: i + 1 })}
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <PhotoPickers onFiles={addPhotos} disabled={preparing || photos.length >= 4} />
        {preparing && <p className={`text-sm ${muted}`}>{t('stk.old.preparingPhoto')}</p>}
      </section>
      )}

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-semibold">{t('stk.old.step2')}</h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('stk.category')} <span className="sr-only">{t('stk.old.required')}</span>
          <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input}>
            <option value="">{t('stk.chooseCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('stk.old.productName')}
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder={t('stk.old.namePlaceholder')} className={input} />
        </label>
        <TagChooser
          value={tags}
          onChange={(next) => {
            setTags(next);
            touched();
          }}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('stk.size')}</span>
          <div className="flex flex-wrap gap-1.5">
            {sizeChoices.map((s, i) => (
              <button
                key={s}
                type="button"
                aria-pressed={size === s}
                onClick={() => {
                  setSize(size === s ? '' : s);
                  touched();
                }}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  size === s
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : i < categorySizes.length
                      ? 'border-brand-600 font-semibold text-brand-800 dark:text-brand-300'
                      : 'border-zinc-300 dark:border-zinc-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <input aria-label={t('stk.size')} value={size} onChange={(e) => setSize(e.target.value)} placeholder={t('stk.old.sizePlaceholder')} className={input} />
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('stk.colour')}
          <input value={color} onChange={(e) => setColor(e.target.value)} placeholder={t('stk.old.colourPlaceholder')} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('stk.old.companyOptional')}
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={input}>
            <option value="">{t('stk.old.notKnown')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-semibold">{t('stk.old.step3')}</h2>
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
          {!editing && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('stk.old.piecesCounted')}
              <input required inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={input} />
            </label>
          )}
        </div>
      </section>

      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || preparing || (!editing && tag?.status === 'exists')} className={`${primaryButton} py-3 text-lg`}>
        {busy ? t('common.saving') : t(editing ? 'stk.old.saveChanges' : 'stk.old.save')}
      </button>
      {editing && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setEditing(false);
          }}
          className={`${secondaryButton} py-3`}
        >
          {t('common.cancel')}
        </button>
      )}
    </form>
    </div>
  );
}
