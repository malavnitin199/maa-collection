'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
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
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [billNumber, setBillNumber] = useState(initial.billNumber ?? '');
  const [stockDate, setStockDate] = useState(initial.stockDate ?? '');
  const [brand, setBrand] = useState('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [pieces, setPieces] = useState<Record<string, number>>({});
  const [reached, setReached] = useState(startSection ? 1 : 0);
  const [sheet, setSheet] = useState<'section' | 'type' | null>(null);
  // Just added on this step (a section or a category): shown chosen with a glow; tap it to go on.
  const [fresh, setFresh] = useState<string | null>(null);
  // The two panels of the Details & sizes step: both open at first; each can be closed.
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [sizesOpen, setSizesOpen] = useState(true);
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
  const totalPieces = ordered.reduce((n, size) => n + count(size), 0);
  const mrpPaise = rupeesToPaise(mrp);
  const costPaise = showCost && cost.trim() ? rupeesToPaise(cost) : null;
  const pricePaise = price.trim() ? rupeesToPaise(price) : null;
  // The name is optional (owner, 2026-11-21): a blank one becomes "<category> <number>" on save.
  const detailsOk = Boolean(supplierId) && mrpPaise !== null && (!cost.trim() || costPaise !== null) && (!price.trim() || pricePaise !== null);
  const pcs = (n: number) => t(n === 1 ? 'stk.item.pcs.one' : 'stk.item.pcs.other', { n });
  const sizesOk = ordered.length > 0 && totalPieces > 0;
  const shownName = name.trim() || (type ? t('ni.name.auto', { type: type.name }) : '');
  const sizeLine = ordered.map((size) => `${size} × ${count(size)}`).join(' · ');

  const go = (next: Step) => {
    const index = next === 'start' ? -1 : FLOW.indexOf(next);
    setDirection(index < stepIndex ? 'back' : 'next');
    setReached((r) => Math.max(r, index));
    setStep(next);
    setError(null);
    setFresh(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
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
    setDetailsOpen(true);
    setSizesOpen(true);
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
        colors: [],
        mrp,
        price,
        cost,
        quantityEach: '1',
        quantities: Object.fromEntries(ordered.map((size) => [size, count(size)])),
        billNumber,
        stockDate,
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
        { label: t('done.line.purchase'), value: costPaise !== null ? formatPaise(costPaise * totalPieces) : '' },
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
  /** Next on the Details & sizes step: both parts must be done; else the part that is missing opens. */
  const finishDetails = () => {
    if (!detailsOk) {
      setDetailsOpen(true);
      document.getElementById('ni-details-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!sizesOk) {
      setSizesOpen(true);
      document.getElementById('ni-sizes-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    toReview();
  };

  return (
    <div className="flex flex-col gap-5">
      {done.node}
      <ResumeSheet asking={resume.asking} what="collection" onKeep={resume.keep} onFresh={resume.fresh} />
      {/* Where you are: five steps, then what was chosen (tap a chip to go back to it). */}
      <div className="flex flex-col gap-3">
        {(step !== 'start' || dirty) && (
          <div className="flex justify-end">
            <StartOver onStartOver={startOver} dirty={dirty} />
          </div>
        )}
        {step !== 'start' && (
          <ol aria-label={t('ni.steps')} className="grid grid-cols-4 gap-1.5">
            {FLOW.map((s, i) => (
              <li key={s} aria-current={s === step ? 'step' : undefined} className="flex flex-col gap-1">
                <span className={`h-1.5 rounded-full transition-colors duration-300 ${i <= stepIndex ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
                <span className={`text-[11px] font-semibold ${i === stepIndex ? 'text-brand-700 dark:text-brand-300' : muted}`}>{t(SHORT[s])}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="flex items-center gap-2">
          {step !== 'start' && (
            <button
              type="button"
              onClick={() => go(stepIndex === 0 ? 'start' : FLOW[stepIndex - 1])}
              aria-label={t('ni.back')}
              className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-700 transition hover:bg-brand-50 active:scale-90 dark:text-brand-300 dark:hover:bg-brand-950"
            >
              <IconBack className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0">
            {step !== 'start' && <p className={`text-xs font-semibold tracking-wide uppercase ${muted}`}>{t('ni.progress', { n: stepIndex + 1 })}</p>}
            <h2 className="text-xl font-bold">{title[step]}</h2>
          </div>
        </div>
        {crumbs.length > 0 && (
          <div data-testid="wizard-path" className="flex flex-wrap items-center gap-1.5">
            {crumbs.map((crumb, i) => (
              <span key={crumb.step} className="flex items-center gap-1.5">
                {i > 0 && <IconChevron className="h-3.5 w-3.5 text-zinc-400" />}
                <button
                  type="button"
                  onClick={() => go(crumb.step)}
                  className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800 ring-1 ring-brand-200 transition hover:bg-brand-100 active:scale-95 dark:bg-brand-950 dark:text-brand-200 dark:ring-brand-900"
                >
                  {crumb.label}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div key={step} className={direction === 'next' ? 'step-next' : 'step-back'}>
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
                {ordered.map((size) => (
                  <li key={size} className="rounded-xl bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-900 ring-1 ring-brand-100 dark:bg-brand-950 dark:text-brand-100 dark:ring-brand-900">
                    {size} × {count(size)}
                  </li>
                ))}
              </ul>
              <p data-testid="review-total" className="font-semibold">
                {t('ni.review.pieces', { pieces: pcs(totalPieces), items: t(ordered.length === 1 ? 'ni.review.items.one' : 'ni.review.items.other', { n: ordered.length }) })}
              </p>
              <p className="text-sm">
                {mrpPaise !== null && t('ni.review.mrp', { amount: formatPaise(mrpPaise) })}
                {pricePaise !== null && ` · ${t('ni.review.price', { amount: formatPaise(pricePaise) })}`}
              </p>
              {showCost && costPaise !== null && (
                <p data-testid="review-cost" className="text-sm">
                  {t('ni.review.cost', { amount: formatPaise(costPaise), total: formatPaise(costPaise * totalPieces) })}
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

      {/* Details & sizes (owner's feedback 2026-11-21): one step, two panels that open and close.
          Stays mounted once reached (the company list it may grow lives inside it). */}
      {reached >= 2 && (
        <div hidden={step !== 'details'} data-testid="details-step" className={`flex flex-col gap-3 ${step === 'details' ? (direction === 'next' ? 'step-next' : 'step-back') : ''}`}>
          <Panel
            id="ni-details-panel"
            title={t('ni.panel.details')}
            summary={[supplierName, shownName, mrpPaise !== null ? t('ni.review.mrp', { amount: formatPaise(mrpPaise) }) : ''].filter(Boolean).join(' · ')}
            done={detailsOk}
            open={detailsOpen}
            onToggle={() => setDetailsOpen(!detailsOpen)}
          >
            <form
              id="ni-details"
              data-testid="details-form"
              noValidate
              className="flex flex-col gap-4"
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
                required
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
              <div className="grid grid-cols-2 gap-3">
                <label className={field}>
                  {t('ni.mrp')}
                  <input required inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value)} className={`${input} text-lg tabular-nums`} />
                </label>
                {showCost && (
                  <label className={field}>
                    {t('ni.cost')}
                    <input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className={`${input} text-lg tabular-nums`} />
                    <span className={`text-xs ${muted}`}>{t('ni.perPiece')}</span>
                  </label>
                )}
              </div>
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
            </form>
          </Panel>
          {type && (
            <Panel
              id="ni-sizes-panel"
              title={t(mode === 'one' ? 'ni.step.size' : 'ni.step.sizes')}
              summary={sizeLine}
              done={sizesOk}
              open={sizesOpen}
              onToggle={() => setSizesOpen(!sizesOpen)}
            >
              <SizeStep
                type={type}
                single={mode === 'one'}
                offered={offered}
                sizes={sizes}
                pieces={pieces}
                onToggle={toggleSize}
                onAll={(all) => setSizes(all ? offered : [])}
                onPieces={(size, value) => setPieces({ ...pieces, [size]: Math.max(0, Math.min(999, value)) })}
                onTypeSizes={(next) => addToList(sectionId, (s) => ({ ...s, types: s.types.map((x) => (x.id === type.id ? { ...x, sizes: next } : x)) }))}
              />
            </Panel>
          )}
        </div>
      )}

      {step === 'details' && type && (
        <div className="sticky bottom-24 z-10 flex items-center justify-between gap-3 rounded-3xl bg-surface/95 p-3 shadow-lg ring-1 ring-brand-100 backdrop-blur sm:bottom-4 dark:ring-brand-900">
          <p data-testid="size-summary" className="pl-2 text-sm font-semibold">
            {!detailsOk
              ? t('ni.panel.needDetails')
              : ordered.length === 0
                ? t(mode === 'one' ? 'ni.sizes.pickSingle' : 'ni.sizes.pickOne')
                : t('ni.sizes.summary', { sizes: t(ordered.length === 1 ? 'ni.sizes.count.one' : 'ni.sizes.count.other', { n: ordered.length }), pieces: pcs(totalPieces) })}
          </p>
          <button type="submit" form="ni-details" disabled={!detailsOk || !sizesOk} className={nextButton}>
            {t('ni.next')}
            <IconChevron className="h-5 w-5" />
          </button>
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

/** A part of the Details & sizes step that opens and closes; the closed header still says what is in it. */
function Panel({ id, title, summary, done, open, onToggle, children }: { id: string; title: string; summary: string; done: boolean; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-3xl bg-surface ring-1 ring-brand-100 dark:ring-brand-900">
      <button type="button" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <span
          aria-hidden
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-emerald-600 text-white' : 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'}`}
        >
          {done ? '✓' : '•'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold">{title}</span>
          {summary && <span className={`block truncate text-xs ${muted}`}>{summary}</span>}
        </span>
        <IconChevron className={`h-5 w-5 shrink-0 text-brand-700 transition-transform duration-200 dark:text-brand-300 ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>
      <div id={`${id}-body`} hidden={!open} className="px-4 pb-4">
        {children}
      </div>
    </section>
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{t('stk.design.sizesFor', { name: type.name })}</p>
        {!single && offered.length > 1 && (
          <button type="button" onClick={() => onAll(!allChosen)} className="rounded-full px-3 py-1.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50 active:scale-95 dark:text-brand-300 dark:hover:bg-brand-950">
            {allChosen ? t('ni.sizes.none') : t('ni.sizes.all')}
          </button>
        )}
      </div>
      {offered.length === 0 && <p className={`text-sm ${muted}`}>{t('ni.sizes.noSizes')}</p>}
      <div data-testid="size-cards" className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {offered.map((size) => {
          const on = chosen(size);
          const count = pieces[size] ?? 1;
          return (
            <div key={size} className={`flex flex-col overflow-hidden rounded-2xl ring-1 transition ${on ? 'bg-brand-600 text-white shadow-md ring-brand-600' : 'bg-surface ring-zinc-200 dark:ring-zinc-700'}`}>
              <button type="button" aria-pressed={on} aria-label={t('stk.sizeAria', { size })} onClick={() => onToggle(size)} className="flex min-h-16 items-center justify-center px-2 text-2xl font-bold tabular-nums transition active:scale-95">
                {size}
              </button>
              {on && (
                <div className="flex items-center justify-between bg-black/15 px-1 py-1">
                  <button type="button" aria-label={t('ni.sizes.less', { size })} onClick={() => onPieces(size, count - 1)} className="flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold active:scale-90">
                    −
                  </button>
                  <input
                    inputMode="numeric"
                    aria-label={t('ni.sizes.piecesOf', { size })}
                    value={String(count)}
                    onChange={(e) => onPieces(size, /^\d+$/.test(e.target.value) ? Number(e.target.value) : 0)}
                    className="w-10 bg-transparent text-center text-lg font-bold tabular-nums outline-none"
                  />
                  <button type="button" aria-label={t('ni.sizes.more', { size })} onClick={() => onPieces(size, count + 1)} className="flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold active:scale-90">
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
          className={`w-full ${input}`}
        />
        <button type="button" disabled={busy || !newSize.trim()} onClick={addSize} className="min-h-11 shrink-0 rounded-2xl border border-brand-300 px-4 text-sm font-bold text-brand-700 transition hover:bg-brand-50 active:scale-95 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950">
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
