'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { card, errorBox, input, muted, primaryButton, secondaryButton } from '@/components/ui/styles';
import { ScanInput } from '@/features/scanning/scan-input';
import { feedback } from '@/features/feedback/sounds';
import { useT } from '@/features/i18n/i18n-provider';
import { findRestockItemsAction, receiveStockAction, type RestockItem } from '@/server/actions/admin';

type Line = RestockItem & { quantity: number };

export function RestockForm({ suppliers, initialSupplierId }: { suppliers: { id: string; name: string }[]; initialSupplierId?: string }) {
  const t = useT();
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(initialSupplierId ?? '');
  const [billNumber, setBillNumber] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [choices, setChoices] = useState<RestockItem[] | null>(null);
  // Every piece scanned: tick + "ting"; nothing found: shake + buzz.
  const [scanResult, setScanResult] = useState<{ kind: 'ok' | 'error'; id: number } | null>(null);
  const signal = (kind: 'ok' | 'error') => {
    feedback(kind === 'ok' ? 'scan' : 'error');
    setScanResult((last) => ({ kind, id: (last?.id ?? 0) + 1 }));
  };
  const [message, setMessage] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  // Same id while the entry is unchanged: a double tap or retry adds stock once.
  const operationId = useRef<string | null>(null);
  const touched = () => {
    operationId.current = null;
  };

  function addItem(item: RestockItem) {
    touched();
    setChoices(null);
    setMessage(null);
    setLines((current) => {
      const existing = current.find((l) => l.id === item.id);
      if (existing) return current.map((l) => (l.id === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [{ ...item, quantity: 1 }, ...current];
    });
  }

  function find(code: string) {
    startTransition(async () => {
      const found = await findRestockItemsAction(code);
      if (found.length === 0) {
        signal('error');
        setMessage(t('stk.receive.notFound', { code }));
      } else if (found.length === 1) {
        signal('ok');
        addItem(found[0]);
      } else setChoices(found);
    });
  }

  function setQuantity(id: string, quantity: number) {
    touched();
    setLines((current) => current.map((l) => (l.id === id ? { ...l, quantity: Math.max(0, quantity) } : l)));
  }

  const totalPieces = lines.reduce((n, l) => n + l.quantity, 0);

  function save() {
    setMessage(null);
    operationId.current ??= crypto.randomUUID();
    const opId = operationId.current;
    startTransition(async () => {
      const result = await receiveStockAction({
        operationId: opId,
        supplierId,
        billNumber,
        lines: lines.filter((l) => l.quantity > 0).map((l) => ({ productId: l.id, quantity: l.quantity })),
      });
      if (!result.ok) return setMessage(result.error);
      // Next 16 keeps this page alive (React Activity): clear the received lines now,
      // or coming back and scanning one more piece would receive them all again.
      operationId.current = null;
      setLines([]);
      setChoices(null);
      setBillNumber('');
      router.push(`/admin/labels/print?receipt=${result.receiptId}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={`${card} flex flex-col gap-3`}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('stk.receive.supplierOptional')}
          <select
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              touched();
            }}
            className={input}
          >
            <option value="">{t('stk.noSupplier')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('stk.billNoOptional')}
          <input
            value={billNumber}
            onChange={(e) => {
              setBillNumber(e.target.value);
              touched();
            }}
            className={input}
          />
        </label>
      </section>

      <ScanInput label={t('stk.receive.scanLabel')} onScan={find} busy={busy} result={scanResult} />
      <p className={`-mt-2 text-xs ${muted}`}>{t('stk.receive.scanAgain')}</p>

      {message && (
        <p role="alert" className={errorBox}>
          {message}
        </p>
      )}

      {choices && (
        <section className={`${card} flex flex-col gap-2`}>
          <h2 className="text-sm font-semibold">{t('stk.receive.whichOne')}</h2>
          <ul data-testid="restock-choices" className="flex flex-col gap-1">
            {choices.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => addItem(item)} className={`${secondaryButton} w-full text-left`}>
                  {item.name} · {item.size}
                  <span className={`block text-xs ${muted}`}>
                    {item.sku} · {t('stk.inStock', { n: item.stock })}{item.supplierName && ` · ${item.supplierName}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lines.length > 0 && (
        <ul data-testid="restock-lines" className="flex flex-col gap-2">
          {lines.map((line) => (
            <li key={line.id} className={`${card} flex items-center justify-between gap-3 py-3`}>
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {line.name} · {line.size}
                </span>
                <span className={`block text-xs ${muted}`}>
                  {line.sku} · {t('stk.receive.nowTo', { from: line.stock, to: line.stock + line.quantity })}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button type="button" aria-label={t('stk.receive.oneLess', { name: line.name, size: line.size })} onClick={() => setQuantity(line.id, line.quantity - 1)} className={`${secondaryButton} px-3`}>
                  −
                </button>
                <input
                  aria-label={t('stk.receive.piecesOf', { name: line.name, size: line.size })}
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(e) => setQuantity(line.id, /^\d+$/.test(e.target.value) ? Number(e.target.value) : 0)}
                  className={`${input} w-14 text-center`}
                />
                <button type="button" aria-label={t('stk.receive.oneMore', { name: line.name, size: line.size })} onClick={() => setQuantity(line.id, line.quantity + 1)} className={`${secondaryButton} px-3`}>
                  +
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <button type="button" disabled={busy || totalPieces === 0} onClick={save} className={`${primaryButton} py-3 text-lg`}>
        {busy
          ? t('common.saving')
          : totalPieces === 0
            ? t('stk.receive.scanToReceive')
            : t(totalPieces === 1 ? 'stk.receive.save.one' : 'stk.receive.save.other', { n: totalPieces })}
      </button>
    </div>
  );
}
