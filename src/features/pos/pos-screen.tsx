'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { findByBarcodeOrSku, type CatalogItem } from '@/features/catalog/dummy-catalog';
import { recordSale, useInventory } from '@/features/inventory/dummy-store';
import { rupeesToPaise, saleTotalPaise, validateSaleDraft } from '@/features/inventory/inventory';
import { CameraScanner } from '@/features/scanning/camera-scanner';
import { useScannerKeystrokes } from '@/features/scanning/scanner-keystrokes';
import { formatPaise } from '@/lib/money';

const SALESPEOPLE = ['Ravi', 'Priya'];
const SALESPERSON_KEY = 'maa-collection-demo-salesperson';

const salespersonListeners = new Set<() => void>();

function subscribeSalesperson(listener: () => void) {
  salespersonListeners.add(listener);
  return () => salespersonListeners.delete(listener);
}

function getSalesperson(): string {
  try {
    const saved = localStorage.getItem(SALESPERSON_KEY);
    return saved && SALESPEOPLE.includes(saved) ? saved : SALESPEOPLE[0];
  } catch {
    return SALESPEOPLE[0];
  }
}

function chooseSalesperson(name: string) {
  try {
    localStorage.setItem(SALESPERSON_KEY, name);
  } catch {
    // Storage unavailable: selection lasts for this render only.
  }
  for (const listener of salespersonListeners) listener();
}

type Message = { kind: 'ok' | 'error'; text: string };
type Pending = { item: CatalogItem; step: 'details' | 'sell' };

const emptySubscribe = () => () => {};
/** False during SSR/hydration, true once React is interactive. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

const inputClass =
  'rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900';
const primaryButtonClass =
  'rounded-lg bg-emerald-600 px-5 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50';
const secondaryButtonClass =
  'rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900';

export function PosScreen() {
  const { stock, sales } = useInventory();
  const salesperson = useSyncExternalStore(
    subscribeSalesperson,
    getSalesperson,
    () => SALESPEOPLE[0],
  );
  const [scanValue, setScanValue] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [qtyText, setQtyText] = useState('1');
  const [priceText, setPriceText] = useState('');
  const [message, setMessage] = useState<Message | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const hydrated = useHydrated();

  // The box is disabled until hydration, so focus it once it becomes enabled;
  // a hardware scanner can then scan straight away.
  useEffect(() => {
    if (hydrated) scanRef.current?.focus();
  }, [hydrated]);

  // Catch hardware scans when focus is on a button instead of the scan box.
  useScannerKeystrokes(handleScan, hydrated);

  function handleScan(raw: string) {
    const code = raw.trim();
    setScanValue('');
    setCameraOpen(false);
    if (!code) return;
    const item = findByBarcodeOrSku(code);
    if (!item) {
      setPending(null);
      setMessage({ kind: 'error', text: `No item found for "${code}".` });
      return;
    }
    setPending({ item, step: 'details' });
    setMessage(null);
  }

  function startSell() {
    if (!pending) return;
    const available = stock[pending.item.sku] ?? 0;
    if (available <= 0) {
      setMessage({
        kind: 'error',
        text: `${pending.item.design} (${pending.item.size}, ${pending.item.color}) is out of stock.`,
      });
      return;
    }
    setQtyText('1');
    setPriceText((pending.item.mrpPaise / 100).toString());
    setMessage(null);
    setPending({ item: pending.item, step: 'sell' });
  }

  function handleRecordSale() {
    if (!pending) return;
    const { item } = pending;
    const quantity = /^\d+$/.test(qtyText.trim()) ? Number(qtyText.trim()) : NaN;
    const unitPricePaise = rupeesToPaise(priceText);
    if (unitPricePaise === null) {
      setMessage({ kind: 'error', text: 'Enter a valid sale price.' });
      return;
    }
    const error = validateSaleDraft(
      { quantity, unitPricePaise },
      { stock: stock[item.sku] ?? 0, mrpPaise: item.mrpPaise },
    );
    if (error) {
      setMessage({ kind: 'error', text: error });
      return;
    }
    const result = recordSale({ item, quantity, unitPricePaise, salesperson });
    if (!result.ok) {
      setMessage({ kind: 'error', text: result.error });
      return;
    }
    setMessage({
      kind: 'ok',
      text: `Sold ${quantity} × ${item.design} (${item.size}, ${item.color}) @ ${formatPaise(unitPricePaise)} each — by ${salesperson}. Stock left: ${result.stockLeft}.`,
    });
    setPending(null);
    scanRef.current?.focus();
  }

  function cancelPending() {
    setPending(null);
    setMessage(null);
    scanRef.current?.focus();
  }

  const pendingQty = /^\d+$/.test(qtyText.trim()) ? Number(qtyText.trim()) : null;
  const pendingPrice = rupeesToPaise(priceText);
  const pendingTotal =
    pending && pendingQty && pendingPrice !== null && pendingPrice > 0
      ? saleTotalPaise(pendingQty, pendingPrice)
      : null;

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">Counter sale</h1>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Salesperson</span>
          <select
            value={salesperson}
            onChange={(e) => chooseSalesperson(e.target.value)}
            className={inputClass}
          >
            {SALESPEOPLE.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleScan(scanValue);
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor="scan-input" className="text-sm font-medium">
          Scan barcode / QR or enter SKU
        </label>
        <div className="flex gap-2">
          <input
            id="scan-input"
            ref={scanRef}
            disabled={!hydrated}
            autoComplete="off"
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            placeholder="Scanner types here, or enter a code"
            className={`w-full text-base ${inputClass}`}
          />
          <button type="submit" disabled={!hydrated} className={primaryButtonClass}>
            Find
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!hydrated}
            onClick={() => setCameraOpen((open) => !open)}
            className={secondaryButtonClass}
          >
            {cameraOpen ? 'Stop camera' : 'Scan with camera'}
          </button>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            A USB/Bluetooth scanner types the code and presses Enter by itself.
          </p>
        </div>
      </form>

      {cameraOpen && (
        <CameraScanner onDecode={handleScan} onClose={() => setCameraOpen(false)} />
      )}

      {message && (
        <p
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.kind === 'ok'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
              : 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
          }`}
        >
          {message.text}
        </p>
      )}

      {pending && pending.step === 'details' && (
        <section
          data-testid="item-details"
          className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <h2 className="text-lg font-semibold">{pending.item.design}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">SKU</dt>
              <dd className="font-mono">{pending.item.sku}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Barcode</dt>
              <dd className="font-mono">{pending.item.barcode}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Brand</dt>
              <dd>{pending.item.brand}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Category</dt>
              <dd>{pending.item.category}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Size / Colour</dt>
              <dd>
                {pending.item.size} · {pending.item.color}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">MRP</dt>
              <dd>{formatPaise(pending.item.mrpPaise)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">In stock</dt>
              <dd data-testid="details-stock" className="font-semibold">
                {stock[pending.item.sku] ?? 0}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={cancelPending} className={secondaryButtonClass}>
              Cancel
            </button>
            <button type="button" onClick={startSell} className={primaryButtonClass}>
              Sell this item
            </button>
          </div>
        </section>
      )}

      {pending && pending.step === 'sell' && (
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">
            Sell {pending.item.design}{' '}
            <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
              {pending.item.sku} · {pending.item.size} · {pending.item.color}
            </span>
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {stock[pending.item.sku] ?? 0} in stock · MRP {formatPaise(pending.item.mrpPaise)}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Quantity
              <input
                type="number"
                min={1}
                max={stock[pending.item.sku] ?? 0}
                value={qtyText}
                onChange={(e) => setQtyText(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Sale price (₹)
              <input
                inputMode="decimal"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                className={inputClass}
              />
              <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                Bargained price allowed, up to MRP.
              </span>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-semibold">
              Total: {pendingTotal !== null ? formatPaise(pendingTotal) : '—'}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={cancelPending} className={secondaryButtonClass}>
                Cancel
              </button>
              <button type="button" onClick={handleRecordSale} className={primaryButtonClass}>
                Record sale
              </button>
            </div>
          </div>
        </section>
      )}

      {sales.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Recent sales (this device)
          </h2>
          <ul data-testid="recent-sales" className="flex flex-col gap-1 text-sm">
            {sales.slice(0, 8).map((sale) => (
              <li
                key={sale.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <span>
                  {sale.quantity} × {sale.design} ({sale.size}, {sale.color})
                  <span className="text-zinc-500 dark:text-zinc-400"> — {sale.salesperson}</span>
                </span>
                <span className="font-medium">{formatPaise(sale.totalPaise)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
