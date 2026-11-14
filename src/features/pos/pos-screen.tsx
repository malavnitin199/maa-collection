'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  DUMMY_CATALOG,
  findByBarcodeOrSku,
  type CatalogItem,
} from '@/features/catalog/dummy-catalog';
import {
  recordSale,
  useInventory,
} from '@/features/inventory/dummy-store';
import {
  LOW_STOCK_THRESHOLD,
  rupeesToPaise,
  saleTotalPaise,
  validateSaleDraft,
} from '@/features/inventory/inventory';
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

const emptySubscribe = () => () => {};
/** False during SSR/hydration, true once React is interactive. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function PosScreen() {
  const { stock, sales } = useInventory();
  const salesperson = useSyncExternalStore(
    subscribeSalesperson,
    getSalesperson,
    () => SALESPEOPLE[0],
  );
  const [scanValue, setScanValue] = useState('');
  const [pending, setPending] = useState<CatalogItem | null>(null);
  const [qtyText, setQtyText] = useState('1');
  const [priceText, setPriceText] = useState('');
  const [message, setMessage] = useState<Message | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  function handleScan(raw: string) {
    const code = raw.trim();
    setScanValue('');
    if (!code) return;
    const item = findByBarcodeOrSku(code);
    if (!item) {
      setPending(null);
      setMessage({ kind: 'error', text: `No item found for "${code}".` });
      return;
    }
    const available = stock[item.sku] ?? 0;
    if (available <= 0) {
      setPending(null);
      setMessage({
        kind: 'error',
        text: `${item.design} (${item.size}, ${item.color}) is out of stock.`,
      });
      return;
    }
    setPending(item);
    setQtyText('1');
    setPriceText((item.mrpPaise / 100).toString());
    setMessage(null);
  }

  function handleRecordSale() {
    if (!pending) return;
    const quantity = /^\d+$/.test(qtyText.trim()) ? Number(qtyText.trim()) : NaN;
    const unitPricePaise = rupeesToPaise(priceText);
    if (unitPricePaise === null) {
      setMessage({ kind: 'error', text: 'Enter a valid sale price.' });
      return;
    }
    const error = validateSaleDraft(
      { quantity, unitPricePaise },
      { stock: stock[pending.sku] ?? 0, mrpPaise: pending.mrpPaise },
    );
    if (error) {
      setMessage({ kind: 'error', text: error });
      return;
    }
    const result = recordSale({ item: pending, quantity, unitPricePaise, salesperson });
    if (!result.ok) {
      setMessage({ kind: 'error', text: result.error });
      return;
    }
    setMessage({
      kind: 'ok',
      text: `Sold ${quantity} × ${pending.design} (${pending.size}, ${pending.color}) @ ${formatPaise(unitPricePaise)} each — by ${salesperson}. Stock left: ${result.stockLeft}.`,
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
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
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
            placeholder="Point the scanner here, or type a code and press Enter"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={!hydrated}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
          >
            Find
          </button>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          A USB/Bluetooth scanner types the code and presses Enter by itself.
        </p>
      </form>

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

      {pending && (
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">
            {pending.design}{' '}
            <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
              {pending.brand} · {pending.category} · {pending.size} · {pending.color}
            </span>
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {stock[pending.sku] ?? 0} in stock · MRP {formatPaise(pending.mrpPaise)}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Quantity
              <input
                type="number"
                min={1}
                max={stock[pending.sku] ?? 0}
                value={qtyText}
                onChange={(e) => setQtyText(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Sale price (₹)
              <input
                inputMode="decimal"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
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
              <button
                type="button"
                onClick={cancelPending}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordSale}
                className="rounded-lg bg-emerald-600 px-5 py-2 font-medium text-white hover:bg-emerald-700"
              >
                Record sale
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Try these items (demo data)
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DUMMY_CATALOG.map((item) => {
            const available = stock[item.sku] ?? 0;
            return (
              <li
                key={item.sku}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <div>
                  <p className="font-medium">
                    {item.design}{' '}
                    <span className="font-normal text-zinc-500 dark:text-zinc-400">
                      {item.size} · {item.color}
                    </span>
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {item.barcode} · MRP {formatPaise(item.mrpPaise)} ·{' '}
                    <span
                      data-testid={`stock-${item.sku}`}
                      className={
                        available <= 0
                          ? 'font-medium text-red-600 dark:text-red-400'
                          : available <= LOW_STOCK_THRESHOLD
                            ? 'font-medium text-amber-600 dark:text-amber-400'
                            : ''
                      }
                    >
                      {available <= 0 ? 'Out of stock' : `${available} in stock`}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!hydrated}
                  onClick={() => handleScan(item.barcode)}
                  className="shrink-0 rounded-lg border border-emerald-600 px-3 py-1.5 font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
                >
                  Scan
                </button>
              </li>
            );
          })}
        </ul>
      </section>

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
