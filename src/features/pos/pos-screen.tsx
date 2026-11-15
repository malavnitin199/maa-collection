'use client';

import Link from 'next/link';
import { useCallback, useState, useTransition } from 'react';
import { card, errorBox, input, link, muted, okBox, primaryButton, secondaryButton } from '@/components/ui/styles';
import { rupeesToPaise, saleTotalPaise, validateSaleDraft } from '@/features/inventory/inventory';
import { ScanInput } from '@/features/scanning/scan-input';
import { FirstTimeTip } from '@/components/layout/first-time-tip';
import { DoneOverlay } from '@/features/feedback/effects';
import { feedback } from '@/features/feedback/sounds';
import { useT } from '@/features/i18n/i18n-provider';
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
  const t = useT();
  const [pending, setPending] = useState<Pending | null>(() =>
    initial?.product ? { product: initial.product, step: 'details', operationId: crypto.randomUUID() } : null,
  );
  const [qtyText, setQtyText] = useState('1');
  const [priceText, setPriceText] = useState('');
  const [creditTo, setCreditTo] = useState(me.id);
  // "Enter by hand" (plan v12): the tag would not scan, so the salesman types the item.
  const [hand, setHand] = useState<{ operationId: string } | null>(null);
  const [handName, setHandName] = useState('');
  const [handSize, setHandSize] = useState('');
  const [message, setMessage] = useState<Message | null>(() =>
    initial && !initial.product ? { kind: 'error', text: t('scan.notFound', { code: initial.code }) } : null,
  );
  // Last scan result for the tick / shake, and the "Sale done" card.
  const [scanResult, setScanResult] = useState<{ kind: 'ok' | 'error'; id: number } | null>(null);
  const [done, setDone] = useState<{ amount: string; detail: string } | null>(null);
  const closeDone = useCallback(() => setDone(null), []);
  const signal = (kind: 'ok' | 'error') => {
    feedback(kind === 'ok' ? 'scan' : 'error');
    setScanResult((last) => ({ kind, id: (last?.id ?? 0) + 1 }));
  };
  const [busy, startTransition] = useTransition();

  function handleScan(code: string) {
    setDone(null);
    setHand(null);
    startTransition(async () => {
      const result = await lookupProductAction(code);
      if (!result.ok) {
        signal('error');
        return setMessage({ kind: 'error', text: result.error });
      }
      if (!result.data) {
        signal('error');
        setPending(null);
        return setMessage({ kind: 'error', text: t('scan.notFound', { code }) });
      }
      signal('ok');
      setPending({ product: result.data, step: 'details', operationId: crypto.randomUUID() });
      setMessage(null);
    });
  }

  function startSell() {
    if (!pending) return;
    const { product } = pending;
    if (product.stock <= 0) {
      return setMessage({ kind: 'error', text: t('sell.outOfStock', { name: product.name, size: product.size, color: product.color }) });
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
    if (unitPricePaise === null) return setMessage({ kind: 'error', text: t('error.salePrice') });
    const problem = validateSaleDraft({ quantity, unitPricePaise }, { stock: product.stock, mrpPaise: product.mrpPaise }, t);
    if (problem) return setMessage({ kind: 'error', text: problem });

    startTransition(async () => {
      const result = await recordSaleAction({ operationId, productId: product.id, quantity, unitPricePaise, soldBy: creditTo });
      if (!result.ok) {
        feedback('error');
        return setMessage({ kind: 'error', text: result.error });
      }
      const creditedName = staff.find((s) => s.id === creditTo)?.name ?? me.name;
      const values = { qty: quantity, name: product.name, size: product.size, color: product.color, price: formatPaise(unitPricePaise), me: me.name, other: creditedName, left: result.data.stockLeft };
      const note = result.data.status === 'waiting' ? ` ${t('sell.sentToOwner')}` : '';
      setMessage({ kind: 'ok', text: t(creditTo === me.id ? 'sell.doneMine' : 'sell.doneOther', values) + note });
      // Payment-app style: chime + "Sale done" card with the amount.
      feedback('done');
      setDone({ amount: formatPaise(saleTotalPaise(quantity, unitPricePaise)), detail: `${quantity} × ${product.name} (${product.size}, ${product.color})` });
      setPending(null);
    });
  }

  function startHand() {
    setPending(null);
    setDone(null);
    setMessage(null);
    setHandName('');
    setHandSize('');
    setQtyText('1');
    setPriceText('');
    setCreditTo(me.id);
    setHand({ operationId: crypto.randomUUID() });
  }

  /** A sale without an item: name and price as typed, no stock change, no MRP cap; the owner checks it. */
  function handleRecordHand() {
    if (!hand) return;
    const name = handName.trim().replace(/\s+/g, ' ');
    if (!name) return setMessage({ kind: 'error', text: t('error.manualName') });
    const quantity = /^\d+$/.test(qtyText.trim()) ? Number(qtyText.trim()) : NaN;
    if (!Number.isInteger(quantity) || quantity < 1) return setMessage({ kind: 'error', text: t('error.quantity') });
    const unitPricePaise = rupeesToPaise(priceText);
    if (unitPricePaise === null || unitPricePaise <= 0) return setMessage({ kind: 'error', text: t('error.salePrice') });
    const size = handSize.trim();
    const { operationId } = hand;
    startTransition(async () => {
      const result = await recordSaleAction({ operationId, manual: { name, size: size || undefined }, quantity, unitPricePaise, soldBy: creditTo });
      if (!result.ok) {
        feedback('error');
        return setMessage({ kind: 'error', text: result.error });
      }
      const creditedName = staff.find((s) => s.id === creditTo)?.name ?? me.name;
      const values = { qty: quantity, name, price: formatPaise(unitPricePaise), me: me.name, other: creditedName };
      const note = result.data.status === 'waiting' ? ` ${t('sell.sentToOwner')}` : '';
      setMessage({ kind: 'ok', text: t(creditTo === me.id ? 'sell.byHand.doneMine' : 'sell.byHand.doneOther', values) + note });
      feedback('done');
      setDone({ amount: formatPaise(saleTotalPaise(quantity, unitPricePaise)), detail: `${quantity} × ${name}${size ? ` (${size})` : ''}` });
      setHand(null);
    });
  }

  const pendingQty = /^\d+$/.test(qtyText.trim()) ? Number(qtyText.trim()) : null;
  const pendingPrice = rupeesToPaise(priceText);
  const pendingTotal =
    pending && pendingQty && pendingPrice !== null && pendingPrice > 0 ? saleTotalPaise(pendingQty, pendingPrice) : null;
  const handTotal = hand && pendingQty && pendingPrice !== null && pendingPrice > 0 ? saleTotalPaise(pendingQty, pendingPrice) : null;

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('sell.title')}</h1>
        <Link href="/pos/my-sales" className={`text-sm ${link}`}>
          {t('sell.myToday')}
        </Link>
      </div>

      <FirstTimeTip id="sell" text={t('sell.tip')} helpHref="/guide#sell" />

      <ScanInput label={t('sell.scanLabel')} onScan={handleScan} busy={busy} captureScanner={pending?.step !== 'sell' && !hand} result={scanResult} />
      {!pending && !hand && (
        <button type="button" data-testid="by-hand" onClick={startHand} className={`${secondaryButton} w-fit`}>
          {t('sell.byHand')}
        </button>
      )}
      {done && <DoneOverlay title={t('done.sale')} amount={done.amount} detail={done.detail} onClose={closeDone} />}

      {message && (
        <p role="status" className={message.kind === 'ok' ? okBox : errorBox}>
          {message.text}
        </p>
      )}

      {hand && (
        <section data-testid="by-hand-form" className={card}>
          <h2 className="text-lg font-semibold">{t('sell.byHand.title')}</h2>
          <p className={`mt-1 text-sm ${muted}`}>{t('sell.byHand.hint')}</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('sell.byHand.name')}
              <input value={handName} maxLength={80} placeholder={t('sell.byHand.namePlaceholder')} onChange={(e) => setHandName(e.target.value)} className={input} autoFocus />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('sell.byHand.size')}
              <input value={handSize} maxLength={20} onChange={(e) => setHandSize(e.target.value)} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('sell.quantity')}
              <input type="number" min={1} value={qtyText} onChange={(e) => setQtyText(e.target.value)} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('sell.price')}
              <input inputMode="decimal" value={priceText} onChange={(e) => setPriceText(e.target.value)} className={input} />
              <span className={`text-xs font-normal ${muted}`}>{t('sell.byHand.priceHint')}</span>
            </label>
            <StaffSelect label={t('sell.creditTo')} staff={staff} meId={me.id} value={creditTo} onChange={setCreditTo} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-semibold">{t('sell.total', { total: handTotal !== null ? formatPaise(handTotal) : '—' })}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setHand(null)} className={secondaryButton}>
                {t('common.cancel')}
              </button>
              <button type="button" disabled={busy} onClick={handleRecordHand} className={primaryButton}>
                {busy ? t('common.saving') : t('sell.record')}
              </button>
            </div>
          </div>
        </section>
      )}

      {pending?.step === 'details' && (
        <ProductCard product={pending.product}>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setPending(null)} className={secondaryButton}>
              {t('common.cancel')}
            </button>
            <button type="button" onClick={startSell} className={primaryButton}>
              {t('sell.sellThis')}
            </button>
          </div>
        </ProductCard>
      )}

      {pending?.step === 'sell' && (
        <section className={card}>
          <h2 className="text-lg font-semibold">
            {t('sell.heading', { name: pending.product.name })}{' '}
            <span className={`text-sm font-normal ${muted}`}>
              {pending.product.sku} · {pending.product.size} · {pending.product.color}
            </span>
          </h2>
          <p className={`mt-1 text-sm ${muted}`}>
            {t('sell.stockLine', { stock: pending.product.stock, mrp: formatPaise(pending.product.mrpPaise) })}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('sell.quantity')}
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
              {t('sell.price')}
              <input inputMode="decimal" value={priceText} onChange={(e) => setPriceText(e.target.value)} className={input} />
              <span className={`text-xs font-normal ${muted}`}>{t('sell.priceHint')}</span>
            </label>
            <StaffSelect label={t('sell.creditTo')} staff={staff} meId={me.id} value={creditTo} onChange={setCreditTo} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-semibold">{t('sell.total', { total: pendingTotal !== null ? formatPaise(pendingTotal) : '—' })}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPending(null)} className={secondaryButton}>
                {t('common.cancel')}
              </button>
              <button type="button" disabled={busy} onClick={handleRecordSale} className={primaryButton}>
                {busy ? t('common.saving') : t('sell.record')}
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
