'use client';

import { useCallback, useState, useTransition } from 'react';
import { card, errorBox, input, muted, okBox, primaryButton, secondaryButton } from '@/components/ui/styles';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { ScanInput } from '@/features/scanning/scan-input';
import { DoneOverlay } from '@/features/feedback/effects';
import { feedback } from '@/features/feedback/sounds';
import { useLocale, useT } from '@/features/i18n/i18n-provider';
import { useOnline } from '@/features/offline/hooks';
import { formatDate } from '@/lib/i18n';
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


export function ExchangeScreen({ me, staff }: { me: StaffOption; staff: StaffOption[] }) {
  const [step, setStep] = useState<Step>({ name: 'scan-returned' });
  const [returnedQtyText, setReturnedQtyText] = useState('1');
  const [issuedQtyText, setIssuedQtyText] = useState('1');
  const [priceText, setPriceText] = useState('');
  const [creditTo, setCreditTo] = useState(me.id);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, startTransition] = useTransition();
  const t = useT();
  const online = useOnline();
  const locale = useLocale();
  const [scanResult, setScanResult] = useState<{ kind: 'ok' | 'error'; id: number } | null>(null);
  const [done, setDone] = useState<{ amount: string; detail: string } | null>(null);
  const closeDone = useCallback(() => setDone(null), []);
  const signal = (kind: 'ok' | 'error') => {
    feedback(kind === 'ok' ? 'scan' : 'error');
    setScanResult((last) => ({ kind, id: (last?.id ?? 0) + 1 }));
  };

  const reset = () => {
    setStep({ name: 'scan-returned' });
    setReturnedQtyText('1');
  };

  function scanReturned(code: string) {
    startTransition(async () => {
      setDone(null);
      const result = await returnableSalesAction(code);
      if (!result.ok) {
        signal('error');
        return setMessage({ kind: 'error', text: result.error });
      }
      if (!result.data) {
        signal('error');
        return setMessage({ kind: 'error', text: t('scan.notFound', { code }) });
      }
      if (result.data.sales.length === 0) {
        signal('error');
        return setMessage({ kind: 'error', text: t('ex.noRecentSale', { name: result.data.product.name, size: result.data.product.size }) });
      }
      signal('ok');
      setMessage(null);
      setStep({ name: 'pick-sale', returned: result.data.product, sales: result.data.sales });
    });
  }

  function pickSale(sale: ReturnableSale) {
    if (step.name !== 'pick-sale') return;
    const qty = /^\d+$/.test(returnedQtyText) ? Number(returnedQtyText) : NaN;
    if (!(qty >= 1 && qty <= sale.returnable)) {
      return setMessage({ kind: 'error', text: t('ex.returnRange', { n: sale.returnable }) });
    }
    setMessage(null);
    setCreditTo(staff.some((s) => s.id === sale.soldById) ? sale.soldById : me.id);
    setStep({ name: 'scan-new', returned: step.returned, sale, returnedQty: qty });
  }

  function scanNew(code: string) {
    if (step.name !== 'scan-new') return;
    startTransition(async () => {
      const result = await lookupProductAction(code);
      if (!result.ok) {
        signal('error');
        return setMessage({ kind: 'error', text: result.error });
      }
      if (!result.data) {
        signal('error');
        return setMessage({ kind: 'error', text: t('scan.notFound', { code }) });
      }
      signal('ok');
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
    if (!issuedQty || issuedQty < 1) return setMessage({ kind: 'error', text: t('ex.enterQty') });
    if (issuedPrice === null || issuedPrice <= 0) return setMessage({ kind: 'error', text: t('error.newPrice') });
    if (issuedPrice > step.issued.mrpPaise) return setMessage({ kind: 'error', text: t('error.newAboveMrp') });
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
      if (!result.ok) {
        feedback('error');
        return setMessage({ kind: 'error', text: result.error });
      }
      const diff = result.data.differencePaise;
      const money = diff > 0 ? t('ex.donePays', { amount: formatPaise(diff) }) : diff < 0 ? t('ex.doneGiveBack', { amount: formatPaise(-diff) }) : t('ex.doneEven');
      setMessage({ kind: 'ok', text: `${t('ex.done')} ${money}` });
      feedback('done');
      setDone({
        amount: diff > 0 ? t('ex.customerPays', { amount: formatPaise(diff) }) : diff < 0 ? t('ex.giveBack', { amount: formatPaise(-diff) }) : t('ex.even'),
        detail: `${step.returnedQty} × ${step.returned.name} → ${issuedQty} × ${step.issued.name}`,
      });
      reset();
    });
  }

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('ex.title')}</h1>
        <p className={`text-sm ${muted}`}>{t('ex.subtitle')}</p>
      </div>
      {/* Plan v18: an exchange looks up the bill on the shop's server, so it stays online-only. */}
      {!online && (
        <p data-testid="exchange-offline" className="rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          {t('off.exchange')}
        </p>
      )}
      {done && <DoneOverlay title={t('done.exchange')} amount={done.amount} detail={done.detail} onClose={closeDone} />}

      {message && (
        <p role="status" className={message.kind === 'ok' ? okBox : errorBox}>
          {message.text}
        </p>
      )}

      {step.name === 'scan-returned' && (
        <ScanInput label={t('ex.scanReturned')} onScan={scanReturned} busy={busy} result={scanResult} />
      )}

      {step.name === 'pick-sale' && (
        <section className={card}>
          <h2 className="font-semibold">
            {t('ex.whichSale')} <span className={`font-normal ${muted}`}>{step.returned.name} · {step.returned.size} · {step.returned.color}</span>
          </h2>
          <label className="mt-3 flex max-w-40 flex-col gap-1 text-sm font-medium">
            {t('ex.unitsReturned')}
            <input inputMode="numeric" value={returnedQtyText} onChange={(e) => setReturnedQtyText(e.target.value)} className={input} />
          </label>
          <ul data-testid="returnable-sales" className="mt-3 flex flex-col gap-2">
            {step.sales.map((sale) => (
              <li key={sale.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                <span>
                  {t('ex.saleLine', { date: formatDate(locale, sale.createdAt, 'dateTime'), qty: sale.quantity, price: formatPaise(sale.unitPricePaise), seller: sale.soldByName })}
                  <span className={muted}> · {t('ex.canReturn', { n: sale.returnable })}</span>
                </span>
                <button type="button" onClick={() => pickSale(sale)} className={secondaryButton}>
                  {t('ex.choose')}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={reset} className={`${secondaryButton} mt-3`}>
            {t('ex.startOver')}
          </button>
        </section>
      )}

      {step.name === 'scan-new' && (
        <>
          <p className={`text-sm ${muted}`}>
            {t('ex.returning', { qty: step.returnedQty, name: step.returned.name, size: step.returned.size, price: formatPaise(step.sale.unitPricePaise) })}
          </p>
          <ScanInput label={t('ex.scanNew')} onScan={scanNew} busy={busy} result={scanResult} />
          <button type="button" onClick={reset} className={`${secondaryButton} w-fit`}>
            {t('ex.startOver')}
          </button>
        </>
      )}

      {step.name === 'confirm' && (
        <ProductCard product={step.issued}>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('ex.newQty')}
              <input inputMode="numeric" value={issuedQtyText} onChange={(e) => setIssuedQtyText(e.target.value)} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('ex.newPrice')}
              <input inputMode="decimal" value={priceText} onChange={(e) => setPriceText(e.target.value)} className={input} />
            </label>
            <StaffSelect label={t('ex.creditTo')} staff={staff} meId={me.id} value={creditTo} onChange={setCreditTo} />
          </div>
          <div data-testid="exchange-summary" className="mt-4 flex flex-col gap-1 text-sm">
            <p>
              {t('ex.returnedLine', { qty: step.returnedQty, name: step.returned.name, size: step.returned.size, value: formatPaise(returnedValue) })}
            </p>
            <p>{t('ex.newLine', { value: issuedValue !== null ? formatPaise(issuedValue) : '—' })}</p>
            <p className="text-lg font-semibold">
              {difference === null
                ? '—'
                : difference > 0
                  ? t('ex.customerPays', { amount: formatPaise(difference) })
                  : difference < 0
                    ? t('ex.giveBack', { amount: formatPaise(-difference) })
                    : t('ex.even')}
            </p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={reset} className={secondaryButton}>
              {t('ex.startOver')}
            </button>
            <button type="button" disabled={busy} onClick={confirm} className={primaryButton}>
              {busy ? t('common.saving') : t('ex.confirm')}
            </button>
          </div>
        </ProductCard>
      )}
    </main>
  );
}
