'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { card, errorBox, input, link, muted, okBox, primaryButton, secondaryButton } from '@/components/ui/styles';
import { rupeesToPaise, saleTotalPaise, validateSaleDraft } from '@/features/inventory/inventory';
import { ScanInput } from '@/features/scanning/scan-input';
import { FirstTimeTip } from '@/components/layout/first-time-tip';
import { formatPaise } from '@/lib/money';
import { lookupProductAction, recordSaleAction } from '@/server/actions/pos';
import type { CounterProduct } from '@/server/services/products';
import { ProductCard } from './product-card';
import { StaffSelect, type StaffOption } from './staff-select';

type Message = { kind: 'ok' | 'error'; text: string };
type Pending = { product: CounterProduct; step: 'details' | 'sell'; operationId: string };

export function PosScreen({
  me,
  staff,
  initial,
}: {
  me: StaffOption;
  staff: StaffOption[];
  /** Item opened from a tag's QR code (looked up on the server). */
  initial?: { code: string; product: CounterProduct | null };
}) {
  const [pending, setPending] = useState<Pending | null>(() =>
    initial?.product ? { product: initial.product, step: 'details', operationId: crypto.randomUUID() } : null,
  );
  const [qtyText, setQtyText] = useState('1');
  const [priceText, setPriceText] = useState('');
  const [creditTo, setCreditTo] = useState(me.id);
  const [message, setMessage] = useState<Message | null>(() =>
    initial && !initial.product ? { kind: 'error', text: `No item found for "${initial.code}".` } : null,
  );
  const [busy, startTransition] = useTransition();

  function handleScan(code: string) {
    startTransition(async () => {
      const result = await lookupProductAction(code);
      if (!result.ok) return setMessage({ kind: 'error', text: result.error });
      if (!result.data) {
        setPending(null);
        return setMessage({ kind: 'error', text: `No item found for "${code}".` });
      }
      setPending({ product: result.data, step: 'details', operationId: crypto.randomUUID() });
      setMessage(null);
    });
  }

  function startSell() {
    if (!pending) return;
    const { product } = pending;
    if (product.stock <= 0) {
      return setMessage({ kind: 'error', text: `${product.name} (${product.size}, ${product.color}) is out of stock.` });
    }
    setQtyText('1');
    setPriceText((product.pricePaise / 100).toString());
    setCreditTo(me.id);
    setMessage(null);
    setPending({ ...pending, step: 'sell' });
  }

  function handleRecordSale() {
    if (!pending) return;
    const { product, operationId } = pending;
    const quantity = /^\d+$/.test(qtyText.trim()) ? Number(qtyText.trim()) : NaN;
    const unitPricePaise = rupeesToPaise(priceText);
    if (unitPricePaise === null) return setMessage({ kind: 'error', text: 'Enter a valid sale price.' });
    const problem = validateSaleDraft({ quantity, unitPricePaise }, { stock: product.stock, mrpPaise: product.mrpPaise });
    if (problem) return setMessage({ kind: 'error', text: problem });

    startTransition(async () => {
      const result = await recordSaleAction({ operationId, productId: product.id, quantity, unitPricePaise, soldBy: creditTo });
      if (!result.ok) return setMessage({ kind: 'error', text: result.error });
      const creditedName = staff.find((s) => s.id === creditTo)?.name ?? me.name;
      const onBehalf = creditTo === me.id ? `by ${me.name}` : `credited to ${creditedName} (recorded by ${me.name})`;
      setMessage({
        kind: 'ok',
        text: `Sold ${quantity} × ${product.name} (${product.size}, ${product.color}) @ ${formatPaise(unitPricePaise)} each — ${onBehalf}. Stock left: ${result.data.stockLeft}.`,
      });
      setPending(null);
    });
  }

  const pendingQty = /^\d+$/.test(qtyText.trim()) ? Number(qtyText.trim()) : null;
  const pendingPrice = rupeesToPaise(priceText);
  const pendingTotal =
    pending && pendingQty && pendingPrice !== null && pendingPrice > 0 ? saleTotalPaise(pendingQty, pendingPrice) : null;

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-semibold">Counter sale</h1>
        <Link href="/pos/my-sales" className={`text-sm ${link}`}>
          My sales today →
        </Link>
      </div>

      <FirstTimeTip id="sell" text="Scan a tag (or type its code) to start a sale." helpHref="/help#sell" />

      <ScanInput label="Scan barcode or enter SKU" onScan={handleScan} busy={busy} captureScanner={pending?.step !== 'sell'} />

      {message && (
        <p role="status" className={message.kind === 'ok' ? okBox : errorBox}>
          {message.text}
        </p>
      )}

      {pending?.step === 'details' && (
        <ProductCard product={pending.product}>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setPending(null)} className={secondaryButton}>
              Cancel
            </button>
            <button type="button" onClick={startSell} className={primaryButton}>
              Sell this item
            </button>
          </div>
        </ProductCard>
      )}

      {pending?.step === 'sell' && (
        <section className={card}>
          <h2 className="text-lg font-semibold">
            Sell {pending.product.name}{' '}
            <span className={`text-sm font-normal ${muted}`}>
              {pending.product.sku} · {pending.product.size} · {pending.product.color}
            </span>
          </h2>
          <p className={`mt-1 text-sm ${muted}`}>
            {pending.product.stock} in stock · MRP {formatPaise(pending.product.mrpPaise)}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Quantity
              <input
                type="number"
                min={1}
                max={pending.product.stock}
                value={qtyText}
                onChange={(e) => setQtyText(e.target.value)}
                className={input}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Sale price (₹)
              <input inputMode="decimal" value={priceText} onChange={(e) => setPriceText(e.target.value)} className={input} />
              <span className={`text-xs font-normal ${muted}`}>Bargained price allowed, up to MRP.</span>
            </label>
            <StaffSelect label="Credit sale to" staff={staff} meId={me.id} value={creditTo} onChange={setCreditTo} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-semibold">Total: {pendingTotal !== null ? formatPaise(pendingTotal) : '—'}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPending(null)} className={secondaryButton}>
                Cancel
              </button>
              <button type="button" disabled={busy} onClick={handleRecordSale} className={primaryButton}>
                {busy ? 'Saving…' : 'Record sale'}
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
