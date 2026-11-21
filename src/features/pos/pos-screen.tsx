'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { ScanTagArt } from '@/components/ui/art';
import { IconPencil, IconRupee, IconWifiOff } from '@/components/ui/icons';
import { card, errorBox, input, muted, okBox, primaryButton, secondaryButton } from '@/components/ui/styles';
import { rupeesToPaise, saleTotalPaise, validateSaleDraft } from '@/features/inventory/inventory';
import { ScanInput } from '@/features/scanning/scan-input';
import { FirstTimeTip } from '@/components/layout/first-time-tip';
import { DoneOverlay, type DoneInput } from '@/features/feedback/effects';
import { feedback } from '@/features/feedback/sounds';
import { useLocale, useT } from '@/features/i18n/i18n-provider';
import { LangText } from '@/features/i18n/lang-text';
import { useOnline } from '@/features/offline/hooks';
import { formatWhen } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { findOnPhone, phoneCatalogue, setPhoneStock } from '@/offline/catalogue';
import { keepForOffline, offlineHelperEnabled } from '@/offline/helper';
import { isOnline, markReachable, markUnreachable, withTimeout } from '@/offline/network';
import { queueSale } from '@/offline/outbox';
import type { QueuedSale } from '@/offline/types';
import { lookupProductAction, recordSaleAction } from '@/server/actions/pos';
import type { CounterProduct } from '@/server/services/products';
import { BillPanel, CameraBillFooter, linePrice, type BillLine, type PriceMode } from './bill';
import { ProductCard } from './product-card';
import { StaffSelect, type StaffOption } from './staff-select';

type Message = { kind: 'ok' | 'error'; text: string };
/** `fromPhone`: found in the phone's copy (no internet), saved at this time. */
type Pending = { product: CounterProduct; step: 'details' | 'sell'; operationId: string; fromPhone?: string };
/** What a sale saved on the phone (plan v18) needs besides price, quantity and credit. */
type PhoneItem = Pick<QueuedSale, 'productId' | 'mrpPaise' | 'manual' | 'name' | 'size' | 'color'>;

/**
 * Plan v18: how long the counter waits for the shop before using the phone
 * instead. `next dev` builds each screen on first use, so it gets much longer.
 */
const SLOW_DEV = process.env.NODE_ENV === 'production' ? 1 : 8;
const LOOKUP_WAIT_MS = 6000 * SLOW_DEV;
const SALE_WAIT_MS = 12000 * SLOW_DEV;

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
  const locale = useLocale();
  const online = useOnline();
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
  const [done, setDone] = useState<DoneInput | null>(null);
  const closeDone = useCallback(() => setDone(null), []);
  /** The done card's details for a sale (owner's feedback 2026-11-20): pieces, price, who gets the credit, status, stock left. */
  const saleLines = (qty: number, price: number, credited: string, status: 'approved' | 'waiting' | 'phone', left?: number) => [
    { label: t('done.line.pieces'), value: String(qty) },
    { label: t('done.line.price'), value: formatPaise(price) },
    { label: t('done.line.creditedTo'), value: credited },
    { label: t('done.line.status'), value: t(status === 'waiting' ? 'done.status.waiting' : status === 'phone' ? 'done.status.phone' : 'done.status.approved') },
    ...(left === undefined ? [] : [{ label: t('done.line.left'), value: String(left) }]),
  ];
  const signal = (kind: 'ok' | 'error') => {
    feedback(kind === 'ok' ? 'scan' : 'error');
    setScanResult((last) => ({ kind, id: (last?.id ?? 0) + 1 }));
  };
  const [busy, startTransition] = useTransition();
  // Several items on one bill (owner's feedback 2026-11-21): null = selling one item as before.
  const [bill, setBill] = useState<BillLine[] | null>(null);
  const [priceMode, setPriceMode] = useState<PriceMode>('end');
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const lastSource = useRef<'keys' | 'camera'>('keys');

  function handleScan(code: string, source: 'keys' | 'camera' = 'keys') {
    lastSource.current = source;
    setDone(null);
    setHand(null);
    startTransition(() => lookUp(code));
  }

  /** A scanned item: onto the bill when one is open, else shown with its choices. */
  function found(product: CounterProduct, fromPhone?: string) {
    if (bill) return addToBill(product, fromPhone);
    signal('ok');
    setPending({ product, step: 'details', operationId: crypto.randomUUID(), fromPhone });
    setMessage(null);
  }

  const outOfStock = (product: CounterProduct) => t('sell.outOfStock', { name: product.name, size: product.size, color: product.color });

  /** The same tag again adds a piece; the shop's count limits it (not the phone's copy, which may be behind). */
  function addToBill(product: CounterProduct, fromPhone?: string) {
    const lines = bill ?? [];
    const same = lines.find((line) => line.product.id === product.id);
    const qty = (same?.qty ?? 0) + 1;
    if (!fromPhone && qty > product.stock) {
      signal('error');
      return setMessage({ kind: 'error', text: product.stock <= 0 ? outOfStock(product) : t('error.onlyLeft', { n: product.stock }) });
    }
    signal('ok');
    const key = same?.key ?? crypto.randomUUID();
    setBill(
      same
        ? lines.map((line) => (line.key === key ? { ...line, qty, product, error: undefined } : line))
        : [...lines, { key, product, qty: 1, priceText: '', operationId: crypto.randomUUID(), fromPhone }],
    );
    setLastKey(key);
    setMessage(null);
  }

  /** "Add more items": this item starts a bill; the camera comes back for the next one if it was used. */
  function startBill() {
    if (!pending) return;
    const { product, fromPhone, operationId } = pending;
    if (product.stock <= 0 && !fromPhone) return setMessage({ kind: 'error', text: outOfStock(product) });
    const key = crypto.randomUUID();
    setBill([{ key, product, qty: 1, priceText: '', operationId, fromPhone }]);
    setLastKey(key);
    setPending(null);
    setCreditTo(me.id);
    setMessage(null);
    if (lastSource.current === 'camera') setCameraOpen(true);
  }

  const setLinePrice = (key: string, priceText: string) =>
    setBill((lines) => lines && lines.map((line) => (line.key === key ? { ...line, priceText, error: undefined } : line)));

  function setLineQty(key: string, qty: number) {
    if (!bill) return;
    const line = bill.find((l) => l.key === key);
    if (!line) return;
    if (qty < 1) {
      const rest = bill.filter((l) => l.key !== key);
      setBill(rest.length ? rest : null);
      return;
    }
    if (!line.fromPhone && qty > line.product.stock) {
      feedback('error');
      return setBill(bill.map((l) => (l.key === key ? { ...l, error: t('error.onlyLeft', { n: line.product.stock }) } : l)));
    }
    setBill(bill.map((l) => (l.key === key ? { ...l, qty, error: undefined } : l)));
  }

  function clearBill() {
    if (bill && bill.length > 1 && !window.confirm(t('bill.confirmClear'))) return;
    setBill(null);
    setLastKey(null);
    setMessage(null);
    setCameraOpen(false);
  }

  /** One bill line → its own sale: the shop first, the phone when there is no internet (same as one item). */
  async function sendSale(line: BillLine, unitPricePaise: number): Promise<{ ok: true; status: 'approved' | 'waiting' | 'phone' } | { ok: false; error: string }> {
    const { product, operationId, qty: quantity } = line;
    if (isOnline()) {
      try {
        const result = await withTimeout(recordSaleAction({ operationId, productId: product.id, quantity, unitPricePaise, soldBy: creditTo }), SALE_WAIT_MS);
        markReachable();
        if (!result.ok) return { ok: false, error: result.error };
        void setPhoneStock(product.id, () => result.data.stockLeft);
        return { ok: true, status: result.data.status === 'waiting' ? 'waiting' : 'approved' };
      } catch {
        markUnreachable();
      }
    }
    const saved = await saveOnPhone(
      { productId: product.id, mrpPaise: product.mrpPaise, name: product.name, size: product.size, color: product.color },
      { operationId, quantity, unitPricePaise },
    );
    return saved ? { ok: true, status: 'phone' } : { ok: false, error: t('off.cannotSave') };
  }

  /** Checks every line, then saves them one after another; lines that fail stay on the bill with the reason. */
  function saveBill() {
    if (!bill?.length) return;
    let bad = false;
    const checked = bill.map((line) => {
      const price = linePrice(line);
      const limits = { stock: line.fromPhone ? Number.MAX_SAFE_INTEGER : line.product.stock, mrpPaise: line.product.mrpPaise };
      const problem = price === null ? t('error.salePrice') : validateSaleDraft({ quantity: line.qty, unitPricePaise: price }, limits, t);
      if (problem) bad = true;
      return { ...line, error: problem ?? undefined };
    });
    setBill(checked);
    if (bad) {
      feedback('error');
      return setMessage({ kind: 'error', text: t('bill.fixLines') });
    }
    const creditedName = staff.find((s) => s.id === creditTo)?.name ?? me.name;
    startTransition(async () => {
      const failed: BillLine[] = [];
      const saved: { line: BillLine; price: number; status: 'approved' | 'waiting' | 'phone' }[] = [];
      for (const [i, line] of checked.entries()) {
        setSaving(t('bill.saving', { i: i + 1, n: checked.length }));
        const price = linePrice(line)!;
        const result = await sendSale(line, price);
        if (result.ok) saved.push({ line, price, status: result.status });
        else failed.push({ ...line, error: result.error });
      }
      setSaving(null);
      const total = saved.reduce((n, s) => n + s.price * s.line.qty, 0);
      const status = saved.some((s) => s.status === 'waiting') ? 'waiting' : saved.every((s) => s.status === 'phone') ? 'phone' : 'approved';
      if (failed.length) {
        feedback('error');
        setBill(failed);
        setMessage({ kind: 'error', text: t('bill.someFailed', { n: failed.length, saved: saved.length }) });
        if (saved.length === 0) return setDone({ kind: 'error', title: t('done.notSaved'), detail: failed[0].error });
        return;
      }
      feedback('done');
      setMessage({ kind: 'ok', text: t('bill.savedMsg', { n: saved.length, total: formatPaise(total) }) + (status === 'waiting' ? ` ${t('sell.sentToOwner')}` : '') });
      setDone({
        title: t(status === 'waiting' ? 'done.billWaiting' : status === 'phone' ? 'off.saved.title' : 'done.billSaved'),
        amount: formatPaise(total),
        lines: [
          ...saved.map((s) => ({ label: `${s.line.qty} × ${s.line.product.name} ${s.line.product.size}`.trim(), value: formatPaise(s.price * s.line.qty) })),
          { label: t('done.line.creditedTo'), value: creditedName },
          { label: t('done.line.status'), value: t(status === 'waiting' ? 'done.status.waiting' : status === 'phone' ? 'done.status.phone' : 'done.status.approved') },
        ],
      });
      setBill(null);
      setLastKey(null);
    });
  }

  /** A scanned code: the shop first; the phone's copy when there is no internet (plan v18). */
  async function lookUp(code: string) {
    if (isOnline()) {
      try {
        const result = await withTimeout(lookupProductAction(code), LOOKUP_WAIT_MS);
        markReachable();
        if (!result.ok) {
          signal('error');
          return setMessage({ kind: 'error', text: result.error });
        }
        if (!result.data) {
          signal('error');
          setPending(null);
          return setMessage({ kind: 'error', text: t('scan.notFound', { code }) });
        }
        const product = result.data;
        found(product);
        void setPhoneStock(product.id, () => product.stock);
        return;
      } catch {
        // No answer from the shop: use the phone's copy below.
        markUnreachable();
      }
    }
    // Plan v18: no internet — the phone's copy of the items.
    const copy = await phoneCatalogue();
    const product = findOnPhone(copy, code);
    if (!copy || !product) {
      signal('error');
      setPending(null);
      return setMessage({ kind: 'error', text: copy ? t('off.notOnPhone', { code }) : t('off.noCopy') });
    }
    found(product, copy.savedAt);
  }

  // Opened offline from a tag's QR code: the saved counter page has no item in it, so look it up here.
  useEffect(() => {
    if (initial) return;
    const code = new URLSearchParams(window.location.search).get('code')?.trim().slice(0, 64);
    if (code) startTransition(() => lookUp(code));
    // Only when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Plan v18: once online, load the camera's barcode reader and keep it for offline use.
  useEffect(() => {
    if (!online || !offlineHelperEnabled()) return;
    const timer = setTimeout(() => {
      import('@zxing/browser').then(() => keepForOffline()).catch(() => {});
    }, 4000);
    return () => clearTimeout(timer);
  }, [online]);

  /**
   * Plan v18: no internet (or no answer) — the sale waits on this phone and is
   * sent by itself later (same operation id, so never twice). Returns false if
   * the phone could not store it.
   */
  async function saveOnPhone(item: PhoneItem, sale: { operationId: string; quantity: number; unitPricePaise: number }): Promise<boolean> {
    const queued: QueuedSale = {
      ...item,
      ...sale,
      recordedBy: me.id,
      recordedByName: me.name,
      madeAt: new Date().toISOString(),
      soldBy: creditTo,
      soldByName: staff.find((s) => s.id === creditTo)?.name ?? me.name,
      state: 'waiting',
      tries: 0,
    };
    try {
      await queueSale(queued);
    } catch {
      feedback('error');
      setMessage({ kind: 'error', text: t('off.cannotSave') });
      return false;
    }
    if (item.productId) void setPhoneStock(item.productId, (stock) => stock - sale.quantity);
    return true;
  }

  function startSell() {
    if (!pending) return;
    const { product } = pending;
    // The shop's count refuses; the phone's copy may be behind, and the owner chose to save such sales anyway (D-07).
    if (product.stock <= 0 && !pending.fromPhone) {
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
    const { product, operationId, fromPhone } = pending;
    const quantity = /^\d+$/.test(qtyText.trim()) ? Number(qtyText.trim()) : NaN;
    const unitPricePaise = rupeesToPaise(priceText);
    if (unitPricePaise === null) return setMessage({ kind: 'error', text: t('error.salePrice') });
    // From the phone's copy only quantity and price are checked (its count may be behind).
    const limits = { stock: fromPhone ? Number.MAX_SAFE_INTEGER : product.stock, mrpPaise: product.mrpPaise };
    const problem = validateSaleDraft({ quantity, unitPricePaise }, limits, t);
    if (problem) return setMessage({ kind: 'error', text: problem });
    const creditedName = staff.find((s) => s.id === creditTo)?.name ?? me.name;
    const values = { qty: quantity, name: product.name, size: product.size, color: product.color, price: formatPaise(unitPricePaise), me: me.name, other: creditedName };
    const item = `${quantity} × ${product.name} (${product.size}, ${product.color})`;
    const amount = formatPaise(saleTotalPaise(quantity, unitPricePaise));

    startTransition(async () => {
      if (isOnline()) {
        try {
          const result = await withTimeout(recordSaleAction({ operationId, productId: product.id, quantity, unitPricePaise, soldBy: creditTo }), SALE_WAIT_MS);
          markReachable();
          if (!result.ok) {
            feedback('error');
            setDone({ kind: 'error', title: t('done.notSaved'), detail: result.error });
            return setMessage({ kind: 'error', text: result.error });
          }
          const note = result.data.status === 'waiting' ? ` ${t('sell.sentToOwner')}` : '';
          setMessage({ kind: 'ok', text: t(creditTo === me.id ? 'sell.doneMine' : 'sell.doneOther', { ...values, left: result.data.stockLeft }) + note });
          // Payment-app style: chime + "Sale done" card with the amount and the details.
          feedback('done');
          setDone({
            title: t(result.data.status === 'waiting' ? 'done.saleWaiting' : 'done.sale'),
            amount,
            detail: item,
            lines: saleLines(quantity, unitPricePaise, creditedName, result.data.status === 'waiting' ? 'waiting' : 'approved', result.data.stockLeft),
          });
          setPending(null);
          void setPhoneStock(product.id, () => result.data.stockLeft);
          return;
        } catch {
          // No answer from the shop: keep the sale on the phone below.
          markUnreachable();
        }
      }
      const saved = await saveOnPhone(
        { productId: product.id, mrpPaise: product.mrpPaise, name: product.name, size: product.size, color: product.color },
        { operationId, quantity, unitPricePaise },
      );
      if (!saved) return;
      setMessage({ kind: 'ok', text: t(creditTo === me.id ? 'off.saved.mine' : 'off.saved.other', values) });
      feedback('done');
      setDone({ title: t('off.saved.title'), amount, detail: t('off.saved.detail', { item }), lines: saleLines(quantity, unitPricePaise, creditedName, 'phone') });
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
    const manual = { name, size: size || undefined };
    const creditedName = staff.find((s) => s.id === creditTo)?.name ?? me.name;
    const values = { qty: quantity, name, price: formatPaise(unitPricePaise), me: me.name, other: creditedName };
    const item = `${quantity} × ${name}${size ? ` (${size})` : ''}`;
    const amount = formatPaise(saleTotalPaise(quantity, unitPricePaise));
    startTransition(async () => {
      if (isOnline()) {
        try {
          const result = await withTimeout(recordSaleAction({ operationId, manual, quantity, unitPricePaise, soldBy: creditTo }), SALE_WAIT_MS);
          markReachable();
          if (!result.ok) {
            feedback('error');
            setDone({ kind: 'error', title: t('done.notSaved'), detail: result.error });
            return setMessage({ kind: 'error', text: result.error });
          }
          const note = result.data.status === 'waiting' ? ` ${t('sell.sentToOwner')}` : '';
          setMessage({ kind: 'ok', text: t(creditTo === me.id ? 'sell.byHand.doneMine' : 'sell.byHand.doneOther', values) + note });
          feedback('done');
          setDone({
            title: t(result.data.status === 'waiting' ? 'done.saleWaiting' : 'done.sale'),
            amount,
            detail: item,
            lines: saleLines(quantity, unitPricePaise, creditedName, result.data.status === 'waiting' ? 'waiting' : 'approved'),
          });
          setHand(null);
          return;
        } catch {
          markUnreachable();
        }
      }
      const saved = await saveOnPhone({ manual, name, size, color: '' }, { operationId, quantity, unitPricePaise });
      if (!saved) return;
      setMessage({ kind: 'ok', text: t(creditTo === me.id ? 'off.saved.handMine' : 'off.saved.handOther', values) });
      feedback('done');
      setDone({ title: t('off.saved.title'), amount, detail: t('off.saved.detail', { item }), lines: saleLines(quantity, unitPricePaise, creditedName, 'phone') });
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
        <Link
          href="/pos/my-sales"
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800 ring-1 ring-brand-200 transition hover:bg-brand-100 active:scale-95 dark:bg-brand-950 dark:text-brand-200 dark:ring-brand-900"
        >
          <IconRupee className="h-4 w-4" />
          {t('sell.myToday')}
        </Link>
      </div>

      <FirstTimeTip id="sell" text={t('sell.tip')} helpHref="/guide#sell" />

      <ScanInput
        label={t('sell.scanLabel')}
        onScan={handleScan}
        busy={busy}
        captureScanner={pending?.step !== 'sell' && !hand}
        result={scanResult}
        camera={{
          open: cameraOpen,
          setOpen: setCameraOpen,
          keepOpen: Boolean(bill),
          footer: bill ? (
            <CameraBillFooter line={bill.find((l) => l.key === lastKey) ?? null} lines={bill} mode={priceMode} onPrice={setLinePrice} onDone={() => setCameraOpen(false)} />
          ) : undefined,
        }}
      />
      {/* Ready for the next customer: a small picture of what to do, and the way out when a tag won't scan. */}
      {!pending && !hand && !bill && (
        <section className="flex items-center gap-4 rounded-3xl border border-dashed border-brand-200 bg-brand-50/60 p-4 dark:border-brand-900 dark:bg-brand-950/40">
          <ScanTagArt className="art-tap h-20 w-20 shrink-0 text-brand-600 dark:text-brand-300" />
          <div className="flex min-w-0 flex-col items-start gap-2">
            <div>
              <p className="font-semibold">{t('sell.ready.title')}</p>
              <p className={`text-sm ${muted}`}>{t('sell.ready.hint')}</p>
            </div>
            <button type="button" data-testid="by-hand" onClick={startHand} className={secondaryButton}>
              <IconPencil className="h-4 w-4" />
              {t('sell.byHand')}
            </button>
          </div>
        </section>
      )}
      {done && <DoneOverlay {...done} onClose={closeDone} />}

      {message && (
        <p role="status" className={message.kind === 'ok' ? okBox : errorBox}>
          {message.text}
        </p>
      )}

      {bill && bill.length > 0 && (
        <BillPanel
          lines={bill}
          mode={priceMode}
          onMode={setPriceMode}
          onPrice={setLinePrice}
          onQty={setLineQty}
          onScanMore={() => setCameraOpen(true)}
          onClear={clearBill}
          onSave={saveBill}
          saving={saving}
          staff={staff}
          meId={me.id}
          creditTo={creditTo}
          onCredit={setCreditTo}
        />
      )}

      {hand && (
        <section data-testid="by-hand-form" className={card}>
          <h2 className="text-lg font-semibold">{t('sell.byHand.title')}</h2>
          <p className={`mt-1 text-sm ${muted}`}>{t('sell.byHand.hint')}</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('sell.byHand.name')}
              <LangText value={handName} maxLength={80} placeholder={t('sell.byHand.namePlaceholder')} onValueChange={setHandName} autoFocus />
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
          {pending.fromPhone && <PhoneCopyNote text={t('off.fromPhone', { time: formatWhen(locale, pending.fromPhone) })} />}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setPending(null)} className={secondaryButton}>
              {t('common.cancel')}
            </button>
            <button type="button" data-testid="add-more" onClick={startBill} className={secondaryButton}>
              {t('sell.addMore')}
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
          {pending.fromPhone && (
            <PhoneCopyNote
              text={pending.product.stock <= 0 ? t('off.noneLeft') : t('off.fromPhone', { time: formatWhen(locale, pending.fromPhone) })}
            />
          )}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('sell.quantity')}
              <input
                type="number"
                min={1}
                max={pending.fromPhone ? undefined : pending.product.stock}
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

/** Plan v18: the item came from the phone's copy (no internet). */
function PhoneCopyNote({ text }: { text: string }) {
  return (
    <p data-testid="phone-copy" className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
      <IconWifiOff className="mt-0.5 h-4 w-4 shrink-0" />
      {text}
    </p>
  );
}
