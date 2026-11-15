'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { card, errorBox, input, link, muted, okBox, primaryButton, secondaryButton } from '@/components/ui/styles';
import { checkTagBarcodeAction, tagOldStockAction, type OldStockResult, type TagLookup } from '@/server/actions/admin';
import { ScanInput } from '@/features/scanning/scan-input';
import { BarcodeLabel } from './barcode-label';
import { PhotoPickers } from './photo-manager';
import { resizePhoto } from './resize-photo';

type Option = { id: string; name: string };
type Photo = { key: number; blob: Blob; url: string };
type Saved = Extract<OldStockResult, { ok: true }>;

const QUICK_SIZES = ['Free', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', '38', '40'];
let photoKey = 1;

export function OldStockForm({ categories, suppliers, showCost }: { categories: (Option & { code: string })[]; suppliers: Option[]; showCost: boolean }) {
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [name, setName] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [mrp, setMrp] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [tag, setTag] = useState<TagLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
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
      setError(e instanceof Error ? e.message : 'Could not use that photo.');
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
    form.set('barcode', tag?.status === 'new' ? tag.barcode : '');
    for (const photo of photos) form.append('photos', new File([photo.blob], 'photo.jpg', { type: 'image/jpeg' }));
    startTransition(async () => {
      const result = await tagOldStockAction(form);
      if (!result.ok) return setError(result.error);
      setSaved(result);
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
    touched();
    // Category, company and size stay: old stock is usually tagged shelf by shelf.
  }

  if (saved) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className={okBox}>
          Saved {saved.product.name} · barcode {saved.product.barcode}.{' '}
          {saved.product.barcode.startsWith('200')
            ? 'Stick this label on each piece.'
            : 'It uses the barcode already on the tag, so no new sticker is needed.'}
          {saved.photoError && <span className="block text-red-700">Photo problem: {saved.photoError}</span>}
        </p>
        <div className="mx-auto w-64">
          <BarcodeLabel product={saved.product} />
        </div>
        <button type="button" onClick={nextItem} className={`${primaryButton} py-3 text-lg`} autoFocus>
          Next item →
        </button>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/admin/labels/print?mine=today" className={`${secondaryButton} py-3 text-center`}>
            Print today&apos;s labels
          </Link>
          <Link href={`/admin/products/${saved.product.id}`} className={`${secondaryButton} py-3 text-center`}>
            Open item
          </Link>
        </div>
        <p className={`text-center text-sm ${muted}`}>{count} item{count === 1 ? '' : 's'} tagged in this session</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Outside the main <form>: the scanner has its own form, and forms can't be nested. */}
      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-semibold">
          0. Barcode already on the tag? <span className={`text-sm font-normal ${muted}`}>(optional)</span>
        </h2>
        {tag?.status === 'new' ? (
          <p data-testid="tag-barcode" className={okBox}>
            Will use barcode <span className="font-mono">{tag.barcode}</span> from the tag — no new sticker needed.{' '}
            <button type="button" onClick={() => { setTag(null); touched(); }} className="underline">
              Remove
            </button>
          </p>
        ) : scanning ? (
          <ScanInput
            label="Scan the barcode on the item's tag"
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
            Scan the tag&apos;s barcode
          </button>
        )}
        {tag?.status === 'exists' && (
          <p role="alert" className={errorBox}>
            Already in the app: {tag.product.name} · {tag.product.color} · {tag.product.size} ({tag.product.sku}, {tag.product.stock} in stock).{' '}
            <Link href={`/admin/products/${tag.product.id}`} className="underline">
              Open it
            </Link>{' '}
            to add pieces or photos instead.
          </p>
        )}
        {tag?.status === 'invalid' && (
          <p role="alert" className={errorBox}>
            &ldquo;{tag.code}&rdquo; is not a 13-digit product barcode. Leave it, and the app will make a new barcode.
          </p>
        )}
        {!tag && !scanning && <p className={`text-xs ${muted}`}>Skip this if the item has no barcode: a new one is made for you.</p>}
      </section>

    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onChange={touched}
      className="flex flex-col gap-4"
    >
      {count > 0 && (
        <p className={`text-sm ${muted}`}>
          {count} tagged so far ·{' '}
          <Link href="/admin/labels/print?mine=today" className={link}>
            print today&apos;s labels
          </Link>
        </p>
      )}

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-semibold">1. Photos <span className={`text-sm font-normal ${muted}`}>(recommended, up to 4)</span></h2>
        {photos.length > 0 && (
          <ul data-testid="new-photos" className="grid grid-cols-4 gap-2">
            {photos.map((photo, i) => (
              <li key={photo.key} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a resized photo */}
                <img src={photo.url} alt={`New photo ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(photo.key)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <PhotoPickers onFiles={addPhotos} disabled={preparing || photos.length >= 4} />
        {preparing && <p className={`text-sm ${muted}`}>Preparing photo…</p>}
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-semibold">2. What is it?</h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Category <span className="sr-only">(required)</span>
          <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input}>
            <option value="">Choose category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Product name
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Phulkari Dupatta" className={input} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Size</span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={size === s}
                onClick={() => {
                  setSize(size === s ? '' : s);
                  touched();
                }}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  size === s ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-zinc-300 dark:border-zinc-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <input aria-label="Size" value={size} onChange={(e) => setSize(e.target.value)} placeholder="or type a size (empty = Free)" className={input} />
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Colour
          <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="optional, e.g. Maroon" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Company (optional)
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={input}>
            <option value="">Not known</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-semibold">3. Price and count</h2>
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
            Pieces counted
            <input required inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={input} />
          </label>
        </div>
      </section>

      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || preparing || tag?.status === 'exists'} className={`${primaryButton} py-3 text-lg`}>
        {busy ? 'Saving…' : 'Save and get barcode'}
      </button>
    </form>
    </div>
  );
}
