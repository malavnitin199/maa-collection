'use client';

import { useEffect, useRef, useState } from 'react';
import { IconScan, IconSound } from '@/components/ui/icons';
import { errorBox, input, muted, primaryButton, secondaryButton } from '@/components/ui/styles';
import { HangTag } from '@/features/catalog/hang-tag';
import { DoneOverlay } from '@/features/feedback/effects';
import { feedback, unlockAudio } from '@/features/feedback/sounds';
import { useLocale, useT } from '@/features/i18n/i18n-provider';
import { rupeesToPaise } from '@/features/inventory/inventory';
import type { MessageKey } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { useHydrated } from '@/features/scanning/scan-input';
import { inStoreEan13 } from '@/features/scanning/ean13';
import { say, speechSupported, stopSpeaking } from './voice';

/** The sample piece (same as the tag in "Read a tag"). Nothing here touches the shop's data. */
const SAMPLE = { sku: 'MAA-KU-003', barcode: inStoreEan13(1), name: 'Cotton Straight Kurta', brand: 'Laxmi Fashion House', size: 'L', color: 'Blue', mrpPaise: 149900 };
const STOCK = 4;

type Stage = 'start' | 'item' | 'price' | 'done';

/**
 * "Try it" in the Sell lesson (plan v9): the counter sale in miniature — scan
 * the sample tag, check it, type the agreed price, record — with the real
 * labels, sounds and "Sale done" card, and a voice that says what to do next.
 * Practice only: no server call, nothing saved.
 */
export function PracticeSale() {
  const t = useT();
  const locale = useLocale();
  const hydrated = useHydrated();
  const [stage, setStage] = useState<Stage>('start');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [voiceHelp, setVoiceHelp] = useState(true);
  const priceRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canSpeak = hydrated && speechSupported();

  const speak = (key: MessageKey) => {
    if (!voiceHelp || !canSpeak) return;
    say(t(key), { locale });
  };

  useEffect(() => {
    if (stage === 'price') priceRef.current?.focus();
  }, [stage]);
  useEffect(() => () => stopSpeaking(), []);

  const shake = () => {
    const box = boxRef.current;
    if (!box?.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    box.animate([0, -7, 7, -4, 4, 0].map((x) => ({ transform: `translateX(${x}px)` })), { duration: 420, easing: 'ease-in-out' });
  };

  const fail = (message: string, key?: MessageKey) => {
    setError(message);
    feedback('error');
    shake();
    if (key) speak(key);
  };

  function record() {
    const qty = Number(quantity);
    if (!/^\d+$/.test(quantity) || qty < 1 || qty > STOCK) return fail(t('prac.errQty', { n: STOCK }));
    const pricePaise = rupeesToPaise(price);
    if (!pricePaise || pricePaise <= 0) return fail(t('prac.errPrice'), 'prac.say.price');
    if (pricePaise > SAMPLE.mrpPaise) return fail(t('prac.errAboveMrp', { mrp: formatPaise(SAMPLE.mrpPaise) }), 'prac.say.above');
    setError(null);
    feedback('done');
    setOverlay(formatPaise(pricePaise * qty));
    setStage('done');
    speak('prac.say.done');
  }

  function restart() {
    setStage('start');
    setQuantity('1');
    setPrice('');
    setError(null);
    speak('prac.say.start');
  }

  const total = rupeesToPaise(price);

  return (
    <div data-testid="practice-sale" className="flex flex-col gap-3 rounded-3xl border-2 border-dashed border-brand-300 bg-brand-50/40 p-4 dark:border-brand-800 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-display text-xl text-brand-900 dark:text-brand-100">{t('prac.title')}</h4>
        <span className="rounded-full bg-zari/20 px-2.5 py-0.5 text-xs font-bold text-zinc-800 dark:text-zinc-100">{t('prac.badge')}</span>
      </div>
      {canSpeak && (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={voiceHelp} onChange={(e) => setVoiceHelp(e.target.checked)} className="h-4 w-4 accent-[var(--b-600)]" />
          <IconSound className="h-4 w-4" />
          {t('prac.voiceHelp')}
        </label>
      )}

      <div ref={boxRef} className="flex flex-col gap-3">
        {stage === 'start' && (
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <HangTag product={SAMPLE} sizes={['M', 'L', 'XL', 'XXL']} qrValue="Sample tag – Maa Collection guide" />
            <div className="flex flex-1 flex-col gap-3">
              <p className="text-sm">{t('prac.intro')}</p>
              <button
                type="button"
                onClick={() => {
                  unlockAudio();
                  feedback('scan');
                  setStage('item');
                  speak('prac.say.scanned');
                }}
                className="relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 px-5 py-4 text-lg font-bold text-white shadow-lg active:scale-[0.98]"
              >
                <IconScan className="h-6 w-6" />
                {t('prac.scan')}
              </button>
            </div>
          </div>
        )}

        {stage === 'item' && (
          <section className="fb-card flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <p className="text-lg font-semibold">{SAMPLE.name}</p>
            <p className="text-sm">
              {SAMPLE.size} · {SAMPLE.color} · <span className="font-mono text-xs">{SAMPLE.sku}</span>
            </p>
            <p className={`text-sm ${muted}`}>{t('sell.stockLine', { stock: STOCK, mrp: formatPaise(SAMPLE.mrpPaise) })}</p>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={restart} className={secondaryButton}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStage('price');
                  speak('prac.say.price');
                }}
                className={primaryButton}
              >
                {t('sell.sellThis')}
              </button>
            </div>
          </section>
        )}

        {stage === 'price' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              record();
            }}
            className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
          >
            <p className="text-lg font-semibold">{t('sell.heading', { name: SAMPLE.name })}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                {t('sell.quantity')}
                <input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={input} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                {t('sell.price')}
                <input ref={priceRef} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={String(SAMPLE.mrpPaise / 100)} className={input} />
              </label>
            </div>
            <p className={`text-xs ${muted}`}>{t('sell.priceHint')}</p>
            {total && /^\d+$/.test(quantity) ? <p className="font-semibold">{t('sell.total', { total: formatPaise(total * Number(quantity)) })}</p> : null}
            {error && (
              <p role="alert" className={errorBox}>
                {error}
              </p>
            )}
            <button type="submit" className={`${primaryButton} py-3`}>
              {t('sell.record')}
            </button>
          </form>
        )}

        {stage === 'done' && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-lg font-semibold text-brand-800 dark:text-brand-200">{t('prac.wellDone')}</p>
            <p className={`text-sm ${muted}`}>{t('prac.nothingSaved')}</p>
            <button type="button" onClick={restart} className={secondaryButton}>
              {t('prac.again')}
            </button>
          </div>
        )}
      </div>
      {overlay && <DoneOverlay title={t('done.sale')} amount={overlay} detail={t('prac.nothingSaved')} onClose={() => setOverlay(null)} />}
    </div>
  );
}
