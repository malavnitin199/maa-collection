'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { useFreshOnReturn } from '@/features/forms/fresh-on-return';
import { ResumeSheet } from '@/features/forms/resume-sheet';
import { useDone } from '@/features/feedback/effects';
import { StartOver } from '@/features/forms/start-over';
import { LangText } from '@/features/i18n/lang-text';
import { IconBack, IconChevron } from '@/components/ui/icons';
import { ActionSheet, sheetPrimary, sheetSecondary } from '@/components/ui/selection';
import { card, errorBox, input, muted, primaryButton, secondaryButton } from '@/components/ui/styles';
import { haptic } from '@/features/feedback/sounds';
import { useT } from '@/features/i18n/i18n-provider';
import { rupeesToPaise } from '@/features/inventory/inventory';
import type { MessageKey } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { PACK_CHOICES, packOf, perPiecePaise } from '@/lib/packs';
import { SECTION_ICONS, type SectionIcon } from '@/lib/sections';
import { cleanSizeList, MAX_SIZES, orderSizes, SIZE_CHOICES, SIZE_RANGES } from '@/lib/size-lists';
import { sameSize } from '@/lib/size-prices';
import { addSectionAction, addTypeAction, addTypeSizeAction, createDesignAction } from '@/server/actions/admin';
import { CompanyPicker } from './company-picker';
import { SectionArt, TypeArt } from './section-art';

type Option = { id: string; name: string };
export type WizardType = { id: string; name: string; code: string; sizes: string[] };
/** Names arrive in the person's language (the page picks English / Hindi). */
export type WizardSection = { id: string; name: string; icon: SectionIcon; types: WizardType[] };

type Mode = 'one' | 'many';
/** Owner's feedback 2026-11-21: details and sizes are one step, two panels that open and close. */
type Step = 'start' | 'who' | 'what' | 'details' | 'review';
/** The four steps after the start choice (the progress bar). */
const FLOW: Exclude<Step, 'start'>[] = ['who', 'what', 'details', 'review'];
const SHORT: Record<Exclude<Step, 'start'>, MessageKey> = { who: 'ni.short.who', what: 'ni.short.what', details: 'ni.short.detailsSizes', review: 'ni.short.review' };

const tile =
  'group relative flex min-h-36 flex-col items-center justify-center gap-2 rounded-3xl bg-surface p-4 text-center shadow-sm ring-1 ring-brand-100 transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:ring-brand-900';
const tileOn = 'ring-2 ring-brand-600 bg-brand-50 dark:bg-brand-950';
const artCircle = 'flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition group-hover:scale-105 dark:bg-brand-950 dark:text-brand-300';
const field = 'flex flex-col gap-1 text-sm font-medium';

/** The markup % this phone used last (ADR-053), or null. Storage may be blocked: then nothing. */
function readMarkup(): string | null {
  try {
    const saved = window.localStorage.getItem('maa-markup');
    return saved && /^\d{1,3}$/.test(saved) ? saved : null;
  } catch {
    return null;
  }
}
function subscribeMarkup(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}
const nextButton = 'inline-flex min-h-12 items-center gap-1.5 rounded-2xl bg-brand-600 px-6 text-base font-bold text-white shadow-md shadow-brand-700/25 transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-40';

/** "28–36" or "M–XXL": a category's size range at a glance. */
function sizeRange(sizes: string[]): string {
  if (sizes.length === 0) return '';
  return sizes.length === 1 ? sizes[0] : `${sizes[0]}–${sizes[sizes.length - 1]}`;
}

/**
 * New item, step by step (plan v19 §5.1, ADR-034): a start choice (one item /
 * many items) → who it is for → what it is → details (name, company, MRP,
 * purchase price) → sizes with pieces of each → check and save. Size is the
 * only variant; every size becomes one item with its own barcode. Big picture
 * tiles, a progress bar whose chips go back to a step without losing anything,
 * "+ Add" for a new section, category or size on the spot.
 */
export function NewItemWizard({
  sections,
  suppliers,
  previousSuppliers,
  showCost,
  initial,
}: {
  sections: WizardSection[];
  suppliers: Option[];
  previousSuppliers: Option[];
  showCost: boolean;
  initial: { sectionId?: string; supplierId?: string; billNumber?: string; stockDate?: string; mode?: Mode };
}) {
  const t = useT();
  const router = useRouter();
  const [list, setList] = useState(sections);
  const startSection = list.some((s) => s.id === initial.sectionId) ? initial.sectionId! : '';
  const [mode, setMode] = useState<Mode>(initial.mode ?? 'many');
  // "Add next item" of the same bill: straight to "What is it?" of the same section.
  const [step, setStep] = useState<Step>(startSection ? 'what' : 'start');
  const [direction, setDirection] = useState<'next' | 'back'>('next');
  const [sectionId, setSectionId] = useState(startSection);
  const [typeId, setTypeId] = useState('');
  // Details (controlled, so going back and forth keeps every value).
  const [name, setName] = useState('');
  const [supplierId, setSupplierId] = useState(initial.supplierId ?? '');
  const [supplierName, setSupplierName] = useState(suppliers.find((s) => s.id === initial.supplierId)?.name ?? '');
  const [mrp, setMrp] = useState('');
  // Sale price from the purchase price (owner, 2026-11-22, ADR-053): purchase + this %, 50 unless changed (remembered on the phone).
  const savedMarkup = useSyncExternalStore(subscribeMarkup, readMarkup, () => null);
  const [typedMarkup, setMarkupText] = useState<string | null>(null);
  const markupText = typedMarkup ?? savedMarkup ?? '50';
  const changeMarkup = (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 3);
    setMarkupText(clean);
    try {
      if (clean) window.localStorage.setItem('maa-markup', clean);
    } catch {
      // Not remembered; it still works for this entry.
    }
  };
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [billNumber, setBillNumber] = useState(initial.billNumber ?? '');
  const [stockDate, setStockDate] = useState(initial.stockDate ?? '');
  const [brand, setBrand] = useState('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [pieces, setPieces] = useState<Record<string, number>>({});
  // Box packs (owner, 2026-11-21, ADR-047): the item comes in boxes of N pieces; counts below are boxes then.
  const [boxed, setBoxed] = useState(false);
  const [packText, setPackText] = useState('12');
  const [packMrp, setPackMrp] = useState('');
  const [costAs, setCostAs] = useState<'piece' | 'box'>('piece');
  const [reached, setReached] = useState(startSection ? 1 : 0);
  const [sheet, setSheet] = useState<'section' | 'type' | null>(null);
  // Just added on this step (a section or a category): shown chosen with a glow; tap it to go on.
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  // "Saved …" after Save / Save & add next (goes by itself).
  const done = useDone();
  // One id per entry: a retried Save never makes a second receipt.
  const operationId = useRef<string | null>(null);

  const section = list.find((s) => s.id === sectionId);
  const type = section?.types.find((x) => x.id === typeId);
  const stepIndex = step === 'start' ? -1 : FLOW.indexOf(step);
  // The chosen sizes in the category's order, then any the owner typed.
  const offered = type ? [...type.sizes, ...sizes.filter((s) => !type.sizes.some((x) => sameSize(x, s)))] : [];
  const ordered = offered.filter((size) => sizes.some((s) => sameSize(s, size)));
  const count = (size: string) => pieces[size] ?? 1;
  const pack = boxed ? packOf(/^\d+$/.test(packText.trim()) ? Number(packText.trim()) : NaN) : null;
  // With boxes, each size's count is boxes; stock is kept in pieces.
  const piecesOf = (size: string) => count(size) * (pack ?? 1);
  // No size picked (owner, 2026-11-22, ADR-052): one item with an empty size; its count sits under key ''.
  const noSize = ordered.length === 0;
  const totalBoxes = noSize ? count('') : ordered.reduce((n, size) => n + count(size), 0);
  const totalPieces = noSize ? piecesOf('') : ordered.reduce((n, size) => n + piecesOf(size), 0);
  const typedCost = showCost && cost.trim() ? rupeesToPaise(cost) : null;
  const boxCost = boxed && costAs === 'box' ? typedCost : null;
  // Always per piece (a box price ÷ pieces in the box, to the paisa).
  const costPaise = boxCost !== null && pack ? perPiecePaise(boxCost, pack) : boxed && costAs === 'box' ? null : typedCost;
  // The sale price (MRP) is optional: empty = purchase + markup %, to whole rupees.
  const markup = /^\d{1,3}$/.test(markupText) ? Math.min(Number(markupText), 500) : 50;
  const derivedMrp = costPaise !== null && costPaise > 0 ? Math.round((costPaise * (100 + markup)) / 10000) * 100 : null;
  const mrpPaise = mrp.trim() ? rupeesToPaise(mrp) : derivedMrp;
  const packMrpPaise = boxed && packMrp.trim() ? rupeesToPaise(packMrp) : null;
  const pricePaise = price.trim() ? rupeesToPaise(price) : null;
  // The name is optional (owner, 2026-11-21): a blank one becomes "<category> <number>" on save.
  // The company is optional (owner, 2026-11-22, ADR-051).
  const detailsOk =
    mrpPaise !== null &&
    (!cost.trim() || typedCost !== null) &&
    (!price.trim() || pricePaise !== null) &&
    (!boxed || (pack !== null && (!packMrp.trim() || (packMrpPaise !== null && mrpPaise !== null && packMrpPaise <= mrpPaise * pack))));
  const boxesText = (n: number) => t(n === 1 ? 'pack.boxes.one' : 'pack.boxes.other', { n });
  const pcs = (n: number) => t(n === 1 ? 'stk.item.pcs.one' : 'stk.item.pcs.other', { n });
  const sizesOk = totalPieces > 0;
  const shownName = name.trim() || (type ? t('ni.name.auto', { type: type.name }) : '');
  const sizeLine = [
    pack ? t('pack.label', { n: pack }) : '',
    noSize ? `${t('ni.noSize')} × ${count('')}` : ordered.map((size) => `${size} × ${count(size)}`).join(' · '),
  ]
    .filter(Boolean)
    .join(' · ');

  const go = (next: Step) => {
    const index = next === 'start' ? -1 : FLOW.indexOf(next);
    setDirection(index < stepIndex ? 'back' : 'next');
    setReached((r) => Math.max(r, index));
    setStep(next);
    setError(null);
    setFresh(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  /** One step back (the arrow, and the phone's back button): Check → Details → What → Who → start. */
  const stepBack = () => go(stepIndex <= 0 ? 'start' : FLOW[stepIndex - 1]);
  const stepBackRef = useRef(stepBack);
  useEffect(() => {
    stepBackRef.current = stepBack;
  });
  // The phone's back button goes back one step, not off the page (owner, 2026-11-21): past the start
  // screen one extra history entry stands guard; going back pops it, and the screen steps back.
  const guarded = useRef(false);
  const skipPop = useRef(false);
  useEffect(() => {
    if (step !== 'start' && !guarded.current) {
      window.history.pushState(window.history.state, '');
      guarded.current = true;
    } else if (step === 'start' && guarded.current) {
      // Back at the start with the arrow: drop the guard so the next back leaves the page.
      guarded.current = false;
      skipPop.current = true;
      window.history.back();
    }
  }, [step]);
  useEffect(() => {
    const onPop = () => {
      if (skipPop.current) {
        skipPop.current = false;
        return;
      }
      if (!guarded.current) return;
      guarded.current = false;
      stepBackRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const pickMode = (next: Mode) => {
    haptic();
    if (next !== mode) {
      setMode(next);
      // One item keeps the first chosen size only.
      if (next === 'one' && sizes.length > 1) setSizes(sizes.slice(0, 1));
    }
    go(sectionId ? 'what' : 'who');
  };
  const pickSection = (id: string) => {
    haptic();
    if (id !== sectionId) {
      setSectionId(id);
      setTypeId('');
      setSizes([]);
      setPieces({});
    }
    go('what');
  };
  /** Choose a category; `stay` (just added) keeps the person on this step with it highlighted. */
  const chooseType = (next: WizardType) => {
    if (next.id !== typeId) {
      setTypeId(next.id);
      // A category with one size (e.g. Free) has it chosen already.
      setSizes(next.sizes.length === 1 ? [next.sizes[0]] : []);
      setPieces({});
    }
  };
  const pickType = (next: WizardType) => {
    haptic();
    chooseType(next);
    go('details');
  };
  const toggleSize = (size: string) => {
    haptic();
    const on = sizes.some((s) => sameSize(s, size));
    if (mode === 'one') setSizes(on ? [] : [size]);
    else setSizes(on ? sizes.filter((s) => !sameSize(s, size)) : [...sizes, size]);
  };
  const addToList = (id: string, change: (s: WizardSection) => WizardSection) => setList((current) => current.map((s) => (s.id === id ? change(s) : s)));
  const toReview = () => {
    haptic();
    operationId.current = crypto.randomUUID();
    go('review');
  };
  /** Clears what belongs to this item; the bill's section, company, number and date stay for the next one. */
  const clearItem = () => {
    operationId.current = null;
    setTypeId('');
    setSizes([]);
    setPieces({});
    setName('');
    setMrp('');
    setCost('');
    setPrice('');
    setBrand('');
    setBoxed(false);
    setPackText('12');
    setPackMrp('');
    setCostAs('piece');
  };
  /** Everything back to the first screen (what the address asked for stays: company, section, bill, date, mode). */
  const startOver = () => {
    clearItem();
    setError(null);
    setSheet(null);
    setMode(initial.mode ?? 'many');
    setSectionId(startSection);
    setSupplierId(initial.supplierId ?? '');
    setSupplierName(suppliers.find((s) => s.id === initial.supplierId)?.name ?? '');
    setBillNumber(initial.billNumber ?? '');
    setStockDate(initial.stockDate ?? '');
    setReached(startSection ? 1 : 0);
    setDirection('back');
    setStep(startSection ? 'what' : 'start');
    window.scrollTo({ top: 0 });
  };
  const dirty = Boolean(name.trim() || sizes.length || mrp.trim() || typeId);
  // Coming back to this page later starts a fresh entry — or asks, once three or more steps are filled (owner's rule, 2026-11-20).
  const resume = useFreshOnReturn(startOver, { ask: () => reached >= 2 && Boolean(name.trim() || mrp.trim() || sizes.length) });
  /**
   * Save (plan v19 04a): `print` → the tags page; `next` → the next item of the same bill
   * ("What is it?", section / company / bill no. / date kept); `done` → the start, everything cleared.
   * Next 16 keeps this screen alive, so the form clears itself (Activity rule).
   */
  const save = (after: 'print' | 'next' | 'done') => {
    if (!type || !section) return;
    operationId.current ??= crypto.randomUUID();
    const opId = operationId.current;
    const savedName = name.trim();
    setError(null);
    startSaving(async () => {
      const result = await createDesignAction({
        operationId: opId,
        supplierId,
        categoryId: type.id,
        name,
        brand,
        sizes: ordered,
        noSize,
        colors: [],
        // Empty sale price: the one worked out from the purchase price.
        mrp: mrp.trim() || (mrpPaise !== null ? String(mrpPaise / 100) : ''),
        price,
        // A box purchase price goes with the box; the piece's cost is worked out from it.
        cost: boxed && costAs === 'box' ? '' : cost,
        quantityEach: '1',
        quantities: noSize ? { '': piecesOf('') } : Object.fromEntries(ordered.map((size) => [size, piecesOf(size)])),
        billNumber,
        stockDate,
        pack: boxed && pack ? { size: pack, mrp: packMrp, cost: costAs === 'box' ? cost : '' } : null,
      });
      if (!result.ok) {
        done.show({ kind: 'error', title: t('done.notSaved'), detail: result.error });
        return setError(result.error);
      }
      const skus = result.items.map((item) => item.sku);
      const finalName = result.items[0]?.name ?? savedName;
      const range = skus.length === 1 ? skus[0] : `${skus[0]} – ${skus[skus.length - 1]}`;
      const savedLines = [
        { label: t('done.line.item'), value: finalName },
        { label: t('done.line.type'), value: [section?.name, type?.name].filter(Boolean).join(' › ') },
        { label: t('done.line.company'), value: supplierName },
        { label: t('done.line.skus'), value: range },
        { label: t('done.line.pieces'), value: pcs(totalPieces) },
        { label: t('pack.box'), value: pack ? t('pack.review', { n: pack, boxes: boxesText(totalBoxes), pieces: pcs(totalPieces) }) : '' },
        { label: t('done.line.purchase'), value: boxCost !== null ? formatPaise(boxCost * totalBoxes) : costPaise !== null ? formatPaise(costPaise * totalPieces) : '' },
      ].filter((line) => line.value);
      clearItem();
      setDirection('next');
      if (after === 'print') {
        setReached(1);
        setStep('what');
        router.push(`/admin/labels/print?receipt=${result.receiptId}&created=${result.created}&mode=${mode}`);
        return;
      }
      done.show({
        title: t(result.items.length === 1 ? 'done.itemSaved' : 'done.itemsSaved', { n: result.items.length }),
        detail: t('ni.saved', { name: finalName, skus: range, pieces: pcs(totalPieces) }),
        lines: savedLines,
      });
      if (after === 'next') {
        setReached(1);
        setStep('what');
      } else {
        setSectionId('');
        setSupplierId('');
        setSupplierName('');
        setBillNumber('');
        setStockDate('');
        setReached(0);
        setStep('start');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const crumbs: { step: Step; label: string }[] = [];
  if (section && stepIndex > 0) crumbs.push({ step: 'who', label: section.name });
  if (type && stepIndex > 1) crumbs.push({ step: 'what', label: type.name });
  if (stepIndex > 2) crumbs.push({ step: 'details', label: [shownName, sizeLine].filter(Boolean).join(' · ') });
  const title: Record<Step, string> = {
    start: t('ni.start.title'),
    who: t('ni.step.who'),
    what: t('ni.step.what'),
    details: t('ni.step.detailsSizes'),
    review: t('ni.step.review'),
  };
  /** Next on the Details & sizes step: everything must be in; else the card scrolls to what is missing. */
  const finishDetails = () => {
    if (!detailsOk || !sizesOk) {
      document.getElementById(detailsOk ? 'ni-sizes' : 'ni-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    toReview();
  };

  return (
    <div className="flex flex-col gap-3">
      {done.node}
      <ResumeSheet asking={resume.asking} what="collection" onKeep={resume.keep} onFresh={resume.fresh} />
      {/* A compact top (owner's feedback 2026-11-21): one row with back · New item · Start again,
          a thin progress bar, then the step's title — so the fields get the screen. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          {step === 'start' ? (
            <Link href="/admin/stock" aria-label={t('stk.item.back')} className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950">
              <IconBack className="h-5 w-5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={stepBack}
              aria-label={t('ni.back')}
              className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-brand-700 transition hover:bg-brand-50 active:scale-90 dark:text-brand-300 dark:hover:bg-brand-950"
            >
              <IconBack className="h-5 w-5" />
            </button>
          )}
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
            {t('stk.item.title')}
            {step !== 'start' && <span className={`ml-2 text-[11px] font-semibold tracking-wide uppercase ${muted}`}>{t('ni.progress', { n: stepIndex + 1 })}</span>}
          </h1>
          {(step !== 'start' || dirty) && <StartOver onStartOver={startOver} dirty={dirty} />}
        </div>
        {step !== 'start' && (
          <ol aria-label={t('ni.steps')} className="grid grid-cols-4 gap-1">
            {FLOW.map((s, i) => (
              <li key={s} aria-current={s === step ? 'step' : undefined} className="flex flex-col gap-0.5">
                <span className={`h-1 rounded-full transition-colors duration-300 ${i <= stepIndex ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
                <span className={`text-[10px] leading-tight font-semibold ${i === stepIndex ? 'text-brand-700 dark:text-brand-300' : muted}`}>{t(SHORT[s])}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="text-lg leading-tight font-bold">{title[step]}</h2>
          {crumbs.length > 0 && (
          <div data-testid="wizard-path" className="flex flex-wrap items-center gap-1">
            {crumbs.map((crumb, i) => (
              <span key={crumb.step} className="flex min-w-0 items-center gap-1">
                {i > 0 && <IconChevron className="h-3 w-3 shrink-0 text-zinc-400" />}
                <button
                  type="button"
                  onClick={() => go(crumb.step)}
                  className="max-w-[16rem] truncate rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200 transition hover:bg-brand-100 active:scale-95 dark:bg-brand-950 dark:text-brand-200 dark:ring-brand-900"
                >
                  {crumb.label}
                </button>
              </span>
            ))}
          </div>
          )}
        </div>
      </div>

      <div key={step} hidden={step === 'details'} className={direction === 'next' ? 'step-next' : 'step-back'}>
        {step === 'start' && (
          <div role="group" aria-label={t('ni.start.title')} className="grid grid-cols-2 gap-3">
            {(['one', 'many'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={m === mode} onClick={() => pickMode(m)} className={`${tile} ${m === mode ? tileOn : ''}`}>
                <span aria-hidden className={`${artCircle} text-3xl font-bold`}>{m === 'one' ? '1' : '1+'}</span>
                <span className="text-lg font-bold">{t(m === 'one' ? 'ni.start.one' : 'ni.start.many')}</span>
                <span className={`text-xs ${muted}`}>{t(m === 'one' ? 'ni.start.oneHint' : 'ni.start.manyHint')}</span>
              </button>
            ))}
          </div>
        )}

        {step === 'who' && list.length === 0 && (
          <p className={`mb-3 text-sm ${muted}`}>
            {t('ni.noSections')}{' '}
            <Link href="/admin/categories" className="font-semibold text-brand-700 underline-offset-4 hover:underline dark:text-brand-300">
              {t('ni.goCategories')}
            </Link>
          </p>
        )}
        {step === 'who' && (
          <div role="group" aria-label={t('ni.step.who')} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {list.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === sectionId}
                data-new={s.id === fresh || undefined}
                ref={s.id === fresh ? (el) => el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) : undefined}
                onClick={() => pickSection(s.id)}
                className={`${tile} ${s.id === sectionId ? tileOn : ''} ${s.id === fresh ? 'new-glow' : ''}`}
              >
                {s.id === fresh && <NewBadge />}
                <span className={artCircle}>
                  <SectionArt icon={s.icon} className="h-14 w-14" />
                </span>
                <span className="text-lg font-bold">{s.name}</span>
              </button>
            ))}
            <AddTile label={t('ni.add')} onClick={() => setSheet('section')} />
          </div>
        )}

        {step === 'what' && section && (
          <div className="flex flex-col gap-3">
            {section.types.length === 0 && <p className={`text-sm ${muted}`}>{t('ni.noTypes')}</p>}
            <div role="group" aria-label={t('ni.step.what')} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {section.types.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={x.id === typeId}
                  data-new={x.id === fresh || undefined}
                  ref={x.id === fresh ? (el) => el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) : undefined}
                  onClick={() => pickType(x)}
                  className={`${tile} min-h-32 ${x.id === typeId ? tileOn : ''} ${x.id === fresh ? 'new-glow' : ''}`}
                >
                  {x.id === fresh && <NewBadge />}
                  <span className={`${artCircle} h-16 w-16`}>
                    <TypeArt name={x.name} className="h-11 w-11" />
                  </span>
                  <span className="text-base leading-tight font-bold">{x.name}</span>
                  {x.sizes.length > 0 && <span className={`text-xs ${muted}`}>{sizeRange(x.sizes)}</span>}
                </button>
              ))}
              <AddTile label={t('ni.add')} onClick={() => setSheet('type')} />
            </div>
          </div>
        )}

        {step === 'review' && type && section && (
          <div className="flex flex-col gap-4">
            <div data-testid="review-card" className={`${card} flex flex-col gap-3`}>
              <div>
                <p className="text-xl font-bold">{shownName}</p>
                <p className={`text-sm ${muted}`}>
                  {section.name} › {type.name}
                  {supplierName && ` · ${supplierName}`}
                </p>
              </div>
              <ul data-testid="review-sizes" className="flex flex-wrap gap-2">
                {noSize && (
                  <li className="rounded-xl bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-900 ring-1 ring-brand-100 dark:bg-brand-950 dark:text-brand-100 dark:ring-brand-900">
                    {t('ni.noSize')} × {pack ? boxesText(count('')) : count('')}
                  </li>
                )}
                {ordered.map((size) => (
                  <li key={size} className="rounded-xl bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-900 ring-1 ring-brand-100 dark:bg-brand-950 dark:text-brand-100 dark:ring-brand-900">
                    {size} × {pack ? boxesText(count(size)) : count(size)}
                  </li>
                ))}
              </ul>
              <p data-testid="review-total" className="font-semibold">
                {pack ? t('pack.review', { n: pack, boxes: boxesText(totalBoxes), pieces: pcs(totalPieces) }) + ' · ' : ''}
                {t('ni.review.pieces', { pieces: pcs(totalPieces), items: t(ordered.length <= 1 ? 'ni.review.items.one' : 'ni.review.items.other', { n: Math.max(1, ordered.length) }) })}
              </p>
              <p className="text-sm">
                {mrpPaise !== null && t('ni.review.mrp', { amount: formatPaise(mrpPaise) })}
                {pricePaise !== null && ` · ${t('ni.review.price', { amount: formatPaise(pricePaise) })}`}
                {pack && packMrpPaise !== null && ` · ${t('pack.review.mrp', { amount: formatPaise(packMrpPaise) })}`}
              </p>
              {showCost && costPaise !== null && (
                <p data-testid="review-cost" className="text-sm">
                  {pack && boxCost !== null
                    ? t('pack.review.cost', { box: formatPaise(boxCost), piece: formatPaise(costPaise), total: formatPaise(boxCost * totalBoxes) })
                    : t('ni.review.cost', { amount: formatPaise(costPaise), total: formatPaise(costPaise * totalPieces) })}
                </p>
              )}
              {(billNumber || stockDate || brand) && (
                <p className={`text-sm ${muted}`}>{[billNumber && t('ni.review.bill', { bill: billNumber }), stockDate, brand].filter(Boolean).join(' · ')}</p>
              )}
            </div>
            {error && (
              <p role="alert" className={errorBox}>
                {error}
              </p>
            )}
            <button type="button" onClick={() => save('print')} disabled={saving} className={`${primaryButton} min-h-12 w-full text-base`}>
              {saving ? t('common.saving') : t('ni.save.print')}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => save('next')} disabled={saving} className={`${secondaryButton} min-h-12 text-base`}>
                {t('ni.save.next')}
              </button>
              <button type="button" onClick={() => save('done')} disabled={saving} className={`${secondaryButton} min-h-12 text-base`}>
                {t('ni.save.only')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details & sizes (owner's feedback 2026-11-21): one card — company, name, prices, then the sizes, then More.
          Stays mounted once reached (the company list it may grow lives inside it). */}
      {reached >= 2 && (
        <div hidden={step !== 'details'} data-testid="details-step" className={step === 'details' ? (direction === 'next' ? 'step-next' : 'step-back') : ''}>
          <form
            id="ni-details"
            data-testid="details-form"
            noValidate
            className={`${card} flex scroll-mt-28 flex-col gap-4`}
            onSubmit={(e) => {
              e.preventDefault();
              finishDetails();
            }}
          >
            <CompanyPicker
              label={t('stk.item.company')}
              companies={suppliers}
              previous={previousSuppliers}
              value={supplierId}
              emptyLabel={t('ni.chooseCompany')}
              onChange={(id, companyName) => {
                setSupplierId(id);
                setSupplierName(companyName);
              }}
            />
            <label className={field}>
              {t('ni.name.optional')}
              <LangText
                value={name}
                onValueChange={setName}
                maxLength={120}
                autoComplete="off"
                placeholder={type ? t('ni.name.auto', { type: type.name }) : undefined}
                inputClassName={`${input} min-w-0 flex-1 text-lg`}
              />
            </label>
            {/* Box packs (owner, 2026-11-21): loose pieces, or boxes of N (sandos: 10 or 12 a box). */}
            <div data-testid="pack-choice" className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{t('pack.soldAs')}</span>
                <Segmented
                  label={t('pack.soldAs')}
                  value={boxed ? 'box' : 'pieces'}
                  options={[
                    { value: 'pieces', label: t('pack.pieces') },
                    { value: 'box', label: t('pack.box') },
                  ]}
                  onChange={(v) => setBoxed(v === 'box')}
                />
              </div>
              {boxed && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`mr-1 text-xs ${muted}`}>{t('pack.size')}</span>
                  {PACK_CHOICES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={pack === n}
                      aria-label={t('pack.sizeOf', { n })}
                      onClick={() => setPackText(String(n))}
                      className={`min-h-9 min-w-10 rounded-xl px-2.5 text-sm font-bold tabular-nums transition active:scale-95 ${
                        pack === n ? 'bg-brand-600 text-white shadow-sm' : 'bg-surface ring-1 ring-zinc-300 dark:ring-zinc-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    inputMode="numeric"
                    aria-label={t('pack.sizeOther')}
                    aria-invalid={pack === null}
                    value={packText}
                    onChange={(e) => setPackText(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className={`${input} h-9 w-16 py-1 text-center text-sm font-bold tabular-nums aria-invalid:border-red-500`}
                  />
                </div>
              )}
            </div>
            {/* Purchase price first, then the sale price (owner, 2026-11-22, ADR-053). */}
            <div className="grid grid-cols-2 gap-3">
              {showCost && !boxed && (
                <label className={field}>
                  {t('ni.cost')}
                  <input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className={`${input} text-lg tabular-nums`} />
                  <span className={`text-xs ${muted}`}>{t('ni.perPiece')}</span>
                </label>
              )}
              {showCost && boxed && (
                // A full row: the label with the Per piece | Whole box switch beside it, then the box.
                <div className="col-span-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="ni-cost" className="text-sm font-medium">
                      {costAs === 'box' ? t('pack.costBox') : t('ni.cost')}
                    </label>
                    <Segmented
                      label={t('pack.costAs')}
                      small
                      value={costAs}
                      options={[
                        { value: 'piece', label: t('pack.costPerPiece') },
                        { value: 'box', label: t('pack.costPerBox') },
                      ]}
                      onChange={(v) => setCostAs(v as 'piece' | 'box')}
                    />
                  </div>
                  <input id="ni-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className={`${input} text-lg tabular-nums`} />
                  {costAs === 'box' && costPaise !== null && (
                    <span data-testid="pack-cost-each" className={`text-xs ${muted}`}>
                      {t('pack.costEach', { amount: formatPaise(costPaise) })}
                    </span>
                  )}
                </div>
              )}
              <div className={field}>
                <label htmlFor="ni-mrp">{boxed ? t('pack.mrpPiece') : t('ni.mrp')}</label>
                <input
                  id="ni-mrp"
                  inputMode="decimal"
                  value={mrp}
                  placeholder={derivedMrp !== null ? String(derivedMrp / 100) : undefined}
                  onChange={(e) => setMrp(e.target.value)}
                  className={`${input} text-lg tabular-nums`}
                />
                {/* Optional (ADR-053): empty = purchase + markup %. */}
                {showCost && (
                  <span data-testid="mrp-from-cost" className={`flex flex-wrap items-center gap-1 text-xs ${muted}`}>
                    {t('ni.markup.before')}
                    <input
                      inputMode="numeric"
                      aria-label={t('ni.markup.aria')}
                      value={markupText}
                      onChange={(e) => changeMarkup(e.target.value)}
                      className="h-7 w-11 rounded-lg border border-zinc-300 bg-surface text-center text-xs font-bold tabular-nums dark:border-zinc-700"
                    />
                    %{!mrp.trim() && derivedMrp !== null && <b className="text-zinc-800 dark:text-zinc-100"> = {formatPaise(derivedMrp)}</b>}
                  </span>
                )}
              </div>
              {boxed && (
                <label className={field}>
                  {t('pack.mrpBox')}
                  <input inputMode="decimal" value={packMrp} onChange={(e) => setPackMrp(e.target.value)} className={`${input} text-lg tabular-nums`} />
                  {mrpPaise !== null && pack && <span className={`text-xs ${muted}`}>{t('pack.mrpBoxHint', { amount: formatPaise(mrpPaise * pack) })}</span>}
                </label>
              )}
            </div>
            {type && (
              <div id="ni-sizes" className="flex scroll-mt-28 flex-col gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <SizeStep
                  type={type}
                  single={mode === 'one'}
                  boxes={pack}
                  offered={offered}
                  sizes={sizes}
                  pieces={pieces}
                  onToggle={toggleSize}
                  onAll={(all) => setSizes(all ? offered : [])}
                  onPieces={(size, value) => setPieces({ ...pieces, [size]: Math.max(0, Math.min(999, value)) })}
                  onTypeSizes={(next) => addToList(sectionId, (s) => ({ ...s, types: s.types.map((x) => (x.id === type.id ? { ...x, sizes: next } : x)) }))}
                />
              </div>
            )}
            <details className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              <summary className="cursor-pointer text-sm font-medium text-brand-700 dark:text-brand-300">{t('ni.more')}</summary>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={field}>
                  {t('ni.price')}
                  <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={`${input} tabular-nums`} />
                </label>
                <label className={field}>
                  {t('ni.bill')}
                  <input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} maxLength={60} className={input} />
                </label>
                <label className={field}>
                  {t('ni.stockDate')}
                  <input type="date" value={stockDate} onChange={(e) => setStockDate(e.target.value)} className={input} />
                </label>
                <label className={field}>
                  {t('ni.brand')}
                  <LangText value={brand} onValueChange={setBrand} maxLength={60} />
                </label>
              </div>
            </details>
            {/* Next sits at the end of the card (owner, 2026-11-21: the floating bar covered the fields). */}
            <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <p data-testid="size-summary" className="text-sm font-semibold">
                {!detailsOk
                  ? t('ni.panel.needDetails')
                  : noSize
                    ? t('ni.noSize.summary', { pieces: pack ? `${boxesText(totalBoxes)} · ${pcs(totalPieces)}` : pcs(totalPieces) })
                    : t('ni.sizes.summary', {
                        sizes: t(ordered.length === 1 ? 'ni.sizes.count.one' : 'ni.sizes.count.other', { n: ordered.length }),
                        pieces: pack ? `${boxesText(totalBoxes)} · ${pcs(totalPieces)}` : pcs(totalPieces),
                      })}
              </p>
              <button type="submit" disabled={!detailsOk || !sizesOk} className={nextButton}>
                {t('ni.next')}
                <IconChevron className="h-5 w-5" />
              </button>
            </div>
          </form>
        </div>
      )}

      {sheet === 'section' && (
        <AddSectionSheet
          onClose={() => setSheet(null)}
          onAdded={(added) => {
            setList((current) => [...current, { ...added, types: [] }]);
            setSheet(null);
            done.show({ title: t('done.sectionAdded'), lines: [{ label: t('done.line.name'), value: added.name }] });
            // Stay on this step: the new section is shown chosen and glowing; tap it to go on.
            setSectionId(added.id);
            setTypeId('');
            setSizes([]);
            setPieces({});
            setFresh(added.id);
          }}
        />
      )}
      {sheet === 'type' && section && (
        <AddTypeSheet
          section={section}
          onClose={() => setSheet(null)}
          onAdded={(added) => {
            addToList(section.id, (s) => ({ ...s, types: [...s.types, added].sort((a, b) => a.name.localeCompare(b.name)) }));
            setSheet(null);
            done.show({ title: t('done.categoryAdded'), lines: [{ label: t('done.line.name'), value: added.name }, { label: t('done.line.section'), value: section.name }, { label: t('done.line.sizes'), value: added.sizes.join(', ') }].filter((line) => line.value) });
            // Stay on this step (owner, 2026-11-21): the new category is shown chosen and glowing; tap it to go on.
            chooseType(added);
            setFresh(added.id);
          }}
        />
      )}
    </div>
  );
}

/** A small two-way switch (Pieces | Box, Per piece | Whole box). */
function Segmented({ label, value, options, onChange, small = false }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; small?: boolean }) {
  return (
    <span role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-zinc-100 p-0.5 text-xs font-semibold dark:bg-zinc-800">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full whitespace-nowrap transition ${small ? 'px-2.5 py-1' : 'px-3.5 py-1.5 text-sm'} ${value === o.value ? 'bg-brand-600 text-white shadow' : 'text-zinc-600 dark:text-zinc-300'}`}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

function NewBadge() {
  const t = useT();
  return <span className="absolute top-2 right-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white shadow">{t('ni.new')}</span>;
}

function AddTile({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-brand-300 p-4 text-brand-700 transition hover:bg-brand-50 active:scale-[0.97] dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950"
    >
      <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-3xl leading-none font-light dark:bg-brand-950">
        +
      </span>
      <span className="text-base font-bold">{label}</span>
    </button>
  );
}

/** Sizes & pieces: tap the sizes that came (one only for a single item); each gets − pieces +; "+ Add size" keeps a new size on the category. */
function SizeStep({
  type,
  single,
  boxes = null,
  offered,
  sizes,
  pieces,
  onToggle,
  onAll,
  onPieces,
  onTypeSizes,
}: {
  type: WizardType;
  single: boolean;
  /** Box packs: the counts are boxes of this many pieces. */
  boxes?: number | null;
  offered: string[];
  sizes: string[];
  pieces: Record<string, number>;
  onToggle: (size: string) => void;
  onAll: (all: boolean) => void;
  onPieces: (size: string, value: number) => void;
  onTypeSizes: (sizes: string[]) => void;
}) {
  const t = useT();
  const [newSize, setNewSize] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const chosen = (size: string) => sizes.some((s) => sameSize(s, size));
  const allChosen = offered.length > 0 && offered.every(chosen);

  const addSize = () => {
    const size = cleanSizeList([newSize])[0];
    if (!size) return;
    setError(null);
    startBusy(async () => {
      const result = await addTypeSizeAction(type.id, size);
      if (!result.ok) return setError(result.error);
      onTypeSizes(result.sizes);
      if (!chosen(size)) onToggle(size);
      setNewSize('');
    });
  };

  const chosenList = offered.filter(chosen);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{t(single ? 'ni.step.size' : 'ni.step.sizes')}</p>
        {!single && offered.length > 1 && (
          <button type="button" onClick={() => onAll(!allChosen)} className="rounded-full px-2.5 py-1 text-sm font-bold text-brand-700 transition hover:bg-brand-50 active:scale-95 dark:text-brand-300 dark:hover:bg-brand-950">
            {allChosen ? t('ni.sizes.none') : t('ni.sizes.all')}
          </button>
        )}
      </div>
      {offered.length === 0 && <p className={`text-sm ${muted}`}>{t('ni.sizes.noSizes')}</p>}
      {/* Small chips (owner, 2026-11-21): tap to choose; the pieces of each chosen size are just below. */}
      <div data-testid="size-cards" className="flex flex-wrap gap-1.5">
        {offered.map((size) => {
          const on = chosen(size);
          return (
            <button
              key={size}
              type="button"
              aria-pressed={on}
              aria-label={t('stk.sizeAria', { size })}
              onClick={() => onToggle(size)}
              className={`min-h-10 min-w-11 rounded-xl px-3 text-sm font-bold tabular-nums transition active:scale-95 ${
                on ? 'bg-brand-600 text-white shadow-sm' : 'bg-surface text-zinc-800 ring-1 ring-zinc-300 hover:ring-brand-400 dark:text-zinc-100 dark:ring-zinc-700'
              }`}
            >
              {size}
            </button>
          );
        })}
      </div>
      {/* No size picked (owner, 2026-11-22, ADR-052): just the pieces (or boxes), saved as one item with no size. */}
      {chosenList.length === 0 && (
        <div data-testid="no-size-pieces" className="flex items-center justify-between gap-2 rounded-xl bg-brand-50 py-0.5 pr-0.5 pl-3 dark:bg-brand-950">
          <span className="text-sm font-medium">{boxes ? t('ni.noSize.boxesHint') : t('ni.noSize.hint')}</span>
          <span className="flex items-center">
            <button type="button" aria-label={t('ni.noSize.less')} onClick={() => onPieces('', (pieces[''] ?? 1) - 1)} className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-brand-700 active:scale-90 dark:text-brand-300">
              −
            </button>
            <input
              inputMode="numeric"
              aria-label={boxes ? t('ni.noSize.boxesAria') : t('ni.noSize.piecesAria')}
              value={String(pieces[''] ?? 1)}
              onChange={(e) => onPieces('', /^\d+$/.test(e.target.value) ? Number(e.target.value) : 0)}
              className="w-10 bg-transparent text-center text-base font-bold tabular-nums outline-none"
            />
            <button type="button" aria-label={t('ni.noSize.more')} onClick={() => onPieces('', (pieces[''] ?? 1) + 1)} className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-brand-700 active:scale-90 dark:text-brand-300">
              +
            </button>
          </span>
        </div>
      )}
      {chosenList.length > 0 && boxes && <p className={`text-xs font-semibold ${muted}`}>{t('pack.boxesTitle')} · {t('pack.label', { n: boxes })}</p>}
      {chosenList.length > 0 && (
        <ul data-testid="size-pieces" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {chosenList.map((size) => {
            const count = pieces[size] ?? 1;
            return (
              <li key={size} className="flex items-center justify-between gap-1 rounded-xl bg-brand-50 py-0.5 pr-0.5 pl-3 dark:bg-brand-950">
                <span className="text-sm font-bold tabular-nums">{size}</span>
                <span className="flex items-center">
                  <button type="button" aria-label={boxes ? t('pack.lessBox', { size }) : t('ni.sizes.less', { size })} onClick={() => onPieces(size, count - 1)} className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-brand-700 active:scale-90 dark:text-brand-300">
                    −
                  </button>
                  <input
                    inputMode="numeric"
                    aria-label={boxes ? t('pack.boxesOf', { size }) : t('ni.sizes.piecesOf', { size })}
                    value={String(count)}
                    onChange={(e) => onPieces(size, /^\d+$/.test(e.target.value) ? Number(e.target.value) : 0)}
                    className="w-8 bg-transparent text-center text-base font-bold tabular-nums outline-none"
                  />
                  <button type="button" aria-label={boxes ? t('pack.moreBox', { size }) : t('ni.sizes.more', { size })} onClick={() => onPieces(size, count + 1)} className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-brand-700 active:scale-90 dark:text-brand-300">
                    +
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={newSize}
          onChange={(e) => setNewSize(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addSize();
            }
          }}
          maxLength={12}
          placeholder={t('stk.design.otherSizePlaceholder')}
          aria-label={t('ni.sizes.newSize')}
          className={`w-full ${input} py-2 text-sm`}
        />
        <button type="button" disabled={busy || !newSize.trim()} onClick={addSize} className="min-h-10 shrink-0 rounded-xl border border-brand-300 px-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50 active:scale-95 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950">
          {t('ni.sizes.addSize')}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function AddSectionSheet({ onClose, onAdded }: { onClose: () => void; onAdded: (section: { id: string; name: string; icon: SectionIcon }) => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<SectionIcon>('family');
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  return (
    <ActionSheet title={t('ni.addSection.title')} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startBusy(async () => {
            const result = await addSectionAction({ name, icon });
            if (!result.ok) return setError(result.error);
            onAdded({ id: result.section.id, name: result.section.name, icon });
          });
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t('ni.addSection.name')}
          <LangText required autoFocus maxLength={30} value={name} onValueChange={setName} placeholder={t('ni.addSection.placeholder')} inputClassName={`${input} min-w-0 flex-1 text-lg`} />
        </label>
        <div role="radiogroup" aria-label={t('ni.addSection.picture')} className="grid grid-cols-5 gap-2">
          {SECTION_ICONS.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={icon === key}
              aria-label={t(`sec.icon.${key}`)}
              onClick={() => setIcon(key)}
              className={`flex aspect-square items-center justify-center rounded-2xl ring-1 transition active:scale-95 ${icon === key ? 'bg-brand-600 text-white ring-brand-600' : 'text-brand-700 ring-zinc-200 dark:text-brand-300 dark:ring-zinc-700'}`}
            >
              <SectionArt icon={key} className="h-9 w-9" />
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={sheetPrimary}>
          {busy ? t('common.saving') : t('ni.addSection.save')}
        </button>
        <button type="button" onClick={onClose} className={sheetSecondary}>
          {t('common.cancel')}
        </button>
      </form>
    </ActionSheet>
  );
}

/** Size chips for a new category: tap one or many, or a quick range (S–M, S–XL …); other sizes can be typed. */
function SizeChips({ picked, onChange }: { picked: string[]; onChange: (sizes: string[]) => void }) {
  const t = useT();
  const [other, setOther] = useState('');
  const on = (size: string) => picked.some((p) => sameSize(p, size));
  const toggle = (size: string) => {
    haptic();
    onChange(orderSizes(on(size) ? picked.filter((p) => !sameSize(p, size)) : [...picked, size]));
  };
  const addOther = () => {
    const extra = cleanSizeList(other).filter((size) => !on(size));
    if (extra.length) onChange(orderSizes([...picked, ...extra]));
    setOther('');
  };
  const chip = (active: boolean) =>
    `min-h-10 min-w-11 rounded-xl px-3 text-sm font-bold tabular-nums transition active:scale-95 ${
      active ? 'bg-brand-600 text-white shadow-sm' : 'bg-surface text-zinc-800 ring-1 ring-zinc-300 hover:ring-brand-400 dark:text-zinc-100 dark:ring-zinc-700'
    }`;
  return (
    <div data-testid="size-chips" className="flex flex-col gap-3">
      <div role="group" aria-label={t('ni.sizesPick.ranges')} className="flex flex-wrap gap-2">
        {SIZE_RANGES.map((range) => {
          const exact = range.length === picked.length && range.every(on);
          return (
            <button key={range.join()} type="button" aria-pressed={exact} onClick={() => onChange(orderSizes(range))} className={`rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${exact ? 'bg-brand-100 text-brand-900 ring-2 ring-brand-600 dark:bg-brand-900 dark:text-brand-100' : 'text-brand-800 ring-1 ring-brand-200 hover:bg-brand-50 dark:text-brand-200 dark:ring-brand-900'}`}>
              {sizeRange(range)}
            </button>
          );
        })}
      </div>
      {SIZE_CHOICES.map((choice) => (
        <div key={choice.group} role="group" aria-label={t(`ni.sizesPick.${choice.group}`)} className="flex flex-col gap-1.5">
          <span className={`text-xs font-semibold ${muted}`}>{t(`ni.sizesPick.${choice.group}`)}</span>
          <div className="flex flex-wrap gap-1.5">
            {choice.sizes.map((size) => (
              <button key={size} type="button" aria-pressed={on(size)} aria-label={t('stk.sizeAria', { size })} onClick={() => toggle(size)} className={chip(on(size))}>
                {size}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addOther();
            }
          }}
          maxLength={60}
          placeholder={t('ni.sizesPick.otherPlaceholder')}
          aria-label={t('ni.sizesPick.other')}
          className={`w-full ${input}`}
        />
        <button type="button" disabled={!other.trim()} onClick={addOther} className="min-h-11 shrink-0 rounded-2xl border border-brand-300 px-4 text-sm font-bold text-brand-700 active:scale-95 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300">
          {t('ni.sizes.addSize')}
        </button>
      </div>
      <p data-testid="size-chips-picked" className="text-sm font-semibold">
        {picked.length === 0 ? t('ni.sizesPick.none') : t('ni.sizesPick.picked', { n: picked.length, sizes: picked.join(', ') })}
      </p>
      {picked.length > MAX_SIZES && <p className="text-sm font-medium text-red-600">{t('cat.err.tooManySizes', { n: MAX_SIZES })}</p>}
    </div>
  );
}

function AddTypeSheet({ section, onClose, onAdded }: { section: { id: string; name: string }; onClose: () => void; onAdded: (type: WizardType) => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  return (
    <ActionSheet title={t('ni.addType.title', { section: section.name })} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startBusy(async () => {
            const result = await addTypeAction({ sectionId: section.id, name, sizes: sizes.join(', ') });
            if (!result.ok) return setError(result.error);
            onAdded(result.type);
          });
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t('ni.addType.name')}
          <LangText required autoFocus maxLength={40} value={name} onValueChange={setName} placeholder={t('ni.addType.placeholder')} inputClassName={`${input} min-w-0 flex-1 text-lg`} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t('ni.addType.sizes')}</span>
          <SizeChips picked={sizes} onChange={setSizes} />
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={sheetPrimary}>
          {busy ? t('common.saving') : t('ni.addType.save')}
        </button>
        <button type="button" onClick={onClose} className={sheetSecondary}>
          {t('common.cancel')}
        </button>
      </form>
    </ActionSheet>
  );
}
