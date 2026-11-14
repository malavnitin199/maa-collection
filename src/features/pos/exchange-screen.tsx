'use client';

import { useState, useTransition } from 'react';
import { card, errorBox, input, muted, okBox, primaryButton, secondaryButton } from '@/components/ui/styles';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { ScanInput } from '@/features/scanning/scan-input';
import { formatPaise } from '@/lib/money';
import { lookupProductAction, recordExchangeAction, returnableSalesAction } from '@/server/actions/pos';
import type { ReturnableSale } from '@/server/services/exchanges';
import type { CounterProduct } from '@/server/services/products';
import { ProductCard } from './product-card';
import { StaffSelect, type StaffOption } from './staff-select';

type Step =
  | { name: 'scan-returned' }
  | { name: 'pick-sale'; returned: CounterProduct; sales: ReturnableSale[] }
  | { name: 'scan-new'; returned: CounterProduct; sale: ReturnableSale; returnedQty: number }
  | { name: 'confirm'; returned: CounterProduct; sale: ReturnableSale; returnedQty: number; issued: CounterProduct; operationId: string };

const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

export function ExchangeScreen({ me, staff }: { me: StaffOption; staff: StaffOption[] }) {
  const [step, setStep] = useState<Step>({ name: 'scan-returned' });
  const [returnedQtyText, setReturnedQtyText] = useState('1');
  const [issuedQtyText, setIssuedQtyText] = useState('1');
  const [priceText, setPriceText] = useState('');
  const [creditTo, setCreditTo] = useState(me.id);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, startTransition] = useTransition();

  const reset = () => {
    setStep({ name: 'scan-returned' });
    setReturnedQtyText('1');
  };

  function scanReturned(code: string) {
    startTransition(async () => {
      const result = await returnableSalesAction(code);
      if (!result.ok) return setMessage({ kind: 'error', text: result.error });
      if (!result.data) return setMessage({ kind: 'error', text: `No item found for "${code}".` });
      if (result.data.sales.length === 0) {
        return setMessage({ kind: 'error', text: `No recent sale of ${result.data.product.name} (${result.data.product.size}) that can be exchanged.` });
      }
      setMessage(null);
      setStep({ name: 'pick-sale', returned: result.data.product, sales: result.data.sales });
    });
  }

  function pickSale(sale: ReturnableSale) {
    if (step.name !== 'pick-sale') return;
    const qty = /^\d+$/.test(returnedQtyText) ? Number(returnedQtyText) : NaN;
    if (!(qty >= 1 && qty <= sale.returnable)) {
      return setMessage({ kind: 'error', text: `Returned quantity must be between 1 and ${sale.returnable}.` });
    }
    setMessage(null);
    setCreditTo(staff.some((s) => s.id === sale.soldById) ? sale.soldById : me.id);
    setStep({ name: 'scan-new', returned: step.returned, sale, returnedQty: qty });
  }

  function scanNew(code: string) {
    if (step.name !== 'scan-new') return;
    startTransition(async () => {
      const result = await lookupProductAction(code);
      if (!result.ok) return setMessage({ kind: 'error', text: result.error });
      if (!result.data) return setMessage({ kind: 'error', text: `No item found for "${code}".` });
      setMessage(null);
      setIssuedQtyText('1');
      setPriceText((result.data.pricePaise / 100).toString());
      setStep({ ...step, name: 'confirm', issued: result.data, operationId: crypto.randomUUID() });
    });
  }

  const issuedQty = /^\d+$/.test(issuedQtyText) ? Number(issuedQtyText) : null;
  const issuedPrice = rupeesToPaise(priceText);
  const returnedValue = step.name === 'confirm' ? step.returnedQty * step.sale.unitPricePaise : 0;
  const issuedValue = issuedQty && issuedPrice ? issuedQty * issuedPrice : null;
  const difference = issuedValue !== null ? issuedValue - returnedValue : null;

  function confirm() {
    if (step.name !== 'confirm') return;
    if (!issuedQty || issuedQty < 1) return setMessage({ kind: 'error', text: 'Enter the new item quantity.' });
    if (issuedPrice === null || issuedPrice <= 0) return setMessage({ kind: 'error', text: 'Enter a valid price for the new item.' });
    if (issuedPrice > step.issued.mrpPaise) return setMessage({ kind: 'error', text: 'New item price cannot be above MRP.' });
    startTransition(async () => {
      const result = await recordExchangeAction({
        operationId: step.operationId,
        originalSaleId: step.sale.id,
        returnedQuantity: step.returnedQty,
        issuedProductId: step.issued.id,
        issuedQuantity: issuedQty,
        issuedUnitPricePaise: issuedPrice,
        creditedTo: creditTo,
      });
      if (!result.ok) return setMessage({ kind: 'error', text: result.error });
      const diff = result.data.differencePaise;
      setMessage({
        kind: 'ok',
        text: `Exchange done. ${diff > 0 ? `Customer pays ${formatPaise(diff)}.` : diff < 0 ? `Give back ${formatPaise(-diff)} to the customer.` : 'No money changes hands.'}`,
      });
      reset();
    });
  }

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Exchange</h1>
        <p className={`text-sm ${muted}`}>Customer brings an item back and takes another one.</p>
      </div>

      {message && (
        <p role="status" className={message.kind === 'ok' ? okBox : errorBox}>
          {message.text}
        </p>
      )}

      {step.name === 'scan-returned' && (
        <ScanInput label="1. Scan the item the customer brought back" onScan={scanReturned} busy={busy} />
      )}

      {step.name === 'pick-sale' && (
        <section className={card}>
          <h2 className="font-semibold">
            2. Which sale was it? <span className={`font-normal ${muted}`}>{step.returned.name} · {step.returned.size} · {step.returned.color}</span>
          </h2>
          <label className="mt-3 flex max-w-40 flex-col gap-1 text-sm font-medium">
            Units returned
            <input inputMode="numeric" value={returnedQtyText} onChange={(e) => setReturnedQtyText(e.target.value)} className={input} />
          </label>
          <ul data-testid="returnable-sales" className="mt-3 flex flex-col gap-2">
            {step.sales.map((sale) => (
              <li key={sale.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                <span>
                  {dateTime.format(new Date(sale.createdAt))} · {sale.quantity} × {formatPaise(sale.unitPricePaise)} · sold by {sale.soldByName}
                  <span className={muted}> · {sale.returnable} can be returned</span>
                </span>
                <button type="button" onClick={() => pickSale(sale)} className={secondaryButton}>
                  Choose
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={reset} className={`${secondaryButton} mt-3`}>
            Start over
          </button>
        </section>
      )}

      {step.name === 'scan-new' && (
        <>
          <p className={`text-sm ${muted}`}>
            Returning {step.returnedQty} × {step.returned.name} ({step.returned.size}) at {formatPaise(step.sale.unitPricePaise)} each (price paid).
          </p>
          <ScanInput label="3. Scan the new item the customer is taking" onScan={scanNew} busy={busy} />
          <button type="button" onClick={reset} className={`${secondaryButton} w-fit`}>
            Start over
          </button>
        </>
      )}

      {step.name === 'confirm' && (
        <ProductCard product={step.issued}>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              New item quantity
              <input inputMode="numeric" value={issuedQtyText} onChange={(e) => setIssuedQtyText(e.target.value)} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              New item price (₹)
              <input inputMode="decimal" value={priceText} onChange={(e) => setPriceText(e.target.value)} className={input} />
            </label>
            <StaffSelect label="Credit exchange to" staff={staff} meId={me.id} value={creditTo} onChange={setCreditTo} />
          </div>
          <div data-testid="exchange-summary" className="mt-4 flex flex-col gap-1 text-sm">
            <p>
              Returned: {step.returnedQty} × {step.returned.name} ({step.returned.size}) = {formatPaise(returnedValue)}
            </p>
            <p>New: {issuedValue !== null ? formatPaise(issuedValue) : '—'}</p>
            <p className="text-lg font-semibold">
              {difference === null
                ? '—'
                : difference > 0
                  ? `Customer pays ${formatPaise(difference)}`
                  : difference < 0
                    ? `Give back ${formatPaise(-difference)}`
                    : 'Even exchange'}
            </p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={reset} className={secondaryButton}>
              Start over
            </button>
            <button type="button" disabled={busy} onClick={confirm} className={primaryButton}>
              {busy ? 'Saving…' : 'Confirm exchange'}
            </button>
          </div>
        </ProductCard>
      )}
    </main>
  );
}
