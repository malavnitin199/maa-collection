'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { IconBack, IconChevron } from '@/components/ui/icons';
import { ActionSheet, sheetPrimary, sheetSecondary } from '@/components/ui/selection';
import { input, muted } from '@/components/ui/styles';
import { feedback, haptic } from '@/features/feedback/sounds';
import { useT } from '@/features/i18n/i18n-provider';
import type { MessageKey } from '@/lib/i18n';
import { defaultSectionKey, SECTION_ICONS, type SectionIcon } from '@/lib/sections';
import { cleanSizeList, SIZE_PRESETS } from '@/lib/size-lists';
import { sameSize, sortSizes } from '@/lib/size-prices';
import { addTypeSizeAction, createSectionAction, createTypeAction } from '@/server/actions/admin';
import { NewItemForm } from './new-item-form';
import { SectionArt, TypeArt } from './section-art';

type Option = { id: string; name: string };
export type WizardType = { id: string; name: string; code: string; sizes: string[] };
export type WizardSection = { id: string; name: string; icon: SectionIcon; types: WizardType[] };

type Step = 'who' | 'what' | 'sizes' | 'details';
const STEPS: Step[] = ['who', 'what', 'sizes', 'details'];
const STEP_TITLE: Record<Step, MessageKey> = { who: 'ns.step.who', what: 'ns.step.what', sizes: 'ns.step.sizes', details: 'ns.step.details' };
const STEP_SHORT: Record<Step, MessageKey> = { who: 'ns.short.who', what: 'ns.short.what', sizes: 'ns.short.sizes', details: 'ns.short.details' };

const tile =
  'group relative flex min-h-36 flex-col items-center justify-center gap-2 rounded-3xl bg-surface p-4 text-center shadow-sm ring-1 ring-brand-100 transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:ring-brand-900';
const tileOn = 'ring-2 ring-brand-600 bg-brand-50 dark:bg-brand-950';
const artCircle = 'flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition group-hover:scale-105 dark:bg-brand-950 dark:text-brand-300';

/** "28–34" or "M–XXL": a type's size range at a glance. */
function sizeRange(sizes: string[]): string {
  if (sizes.length === 0) return '';
  return sizes.length === 1 ? sizes[0] : `${sizes[0]}–${sizes[sizes.length - 1]}`;
}

/**
 * New item, step by step (plan v19, owner's flow): 1 who it is for (Man,
 * Woman, Girl, Boy …) → 2 what it is (that section's types) → 3 the sizes,
 * with pieces of each → 4 details (name, company, MRP, purchase price; the
 * rest optional) → the tags to print. Big picture tiles, a progress bar whose
 * chips go back to a step, "+ Add" for a new section, type or size on the
 * spot. After saving, the company, bill no., stock date and section stay for
 * the next item from the same bill.
 */
export function NewStockWizard({
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
  initial: { sectionId?: string; supplierId?: string; billNumber?: string; stockDate?: string };
}) {
  const t = useT();
  const router = useRouter();
  const [list, setList] = useState(sections);
  const startSection = list.some((s) => s.id === initial.sectionId) ? initial.sectionId! : '';
  const [step, setStep] = useState<Step>(startSection ? 'what' : 'who');
  const [direction, setDirection] = useState<'next' | 'back'>('next');
  const [sectionId, setSectionId] = useState(startSection);
  const [typeId, setTypeId] = useState('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [pieces, setPieces] = useState<Record<string, number>>({});
  const [supplierId, setSupplierId] = useState(initial.supplierId ?? '');
  const [billNumber, setBillNumber] = useState(initial.billNumber ?? '');
  const [stockDate, setStockDate] = useState(initial.stockDate ?? '');
  // A new key for the details form after each save: it starts empty.
  const [entry, setEntry] = useState(0);
  const [sheet, setSheet] = useState<'section' | 'type' | null>(null);

  const section = list.find((s) => s.id === sectionId);
  const type = section?.types.find((x) => x.id === typeId);
  const sectionLabel = (s: { name: string }) => {
    const key = defaultSectionKey(s.name);
    return key ? t(`sec.default.${key}`) : s.name;
  };
  const totalPieces = sizes.reduce((n, size) => n + (pieces[size] ?? 1), 0);

  const go = (next: Step) => {
    setDirection(STEPS.indexOf(next) < STEPS.indexOf(step) ? 'back' : 'next');
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const pickType = (next: WizardType) => {
    haptic();
    if (next.id !== typeId) {
      setTypeId(next.id);
      // A type with one size (e.g. Free) has it chosen already.
      setSizes(next.sizes.length === 1 ? [next.sizes[0]] : []);
      setPieces({});
    }
    go('sizes');
  };
  const addToList = (sectionIdToChange: string, change: (s: WizardSection) => WizardSection) =>
    setList((current) => current.map((s) => (s.id === sectionIdToChange ? change(s) : s)));

  const stepIndex = STEPS.indexOf(step);
  const crumbs: { step: Step; label: string }[] = [];
  if (section) crumbs.push({ step: 'who', label: sectionLabel(section) });
  if (type) crumbs.push({ step: 'what', label: type.name });
  if (type && sizes.length > 0 && stepIndex >= 3) crumbs.push({ step: 'sizes', label: sortSizes(sizes).join(' · ') });

  return (
    <div className="flex flex-col gap-5">
      {/* Where you are: four steps, then what was chosen (tap to go back to it). */}
      <div className="flex flex-col gap-3">
        <ol aria-label={t('ns.steps')} className="grid grid-cols-4 gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={s === step ? 'step' : undefined} className="flex flex-col gap-1">
              <span className={`h-1.5 rounded-full transition-colors duration-300 ${i <= stepIndex ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
              <span className={`text-[11px] font-semibold ${i === stepIndex ? 'text-brand-700 dark:text-brand-300' : muted}`}>{t(STEP_SHORT[s])}</span>
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={() => go(STEPS[stepIndex - 1])}
              aria-label={t('ns.back')}
              className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-brand-700 transition hover:bg-brand-50 active:scale-90 dark:text-brand-300 dark:hover:bg-brand-950"
            >
              <IconBack className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0">
            <p className={`text-xs font-semibold tracking-wide uppercase ${muted}`}>{t('ns.progress', { n: stepIndex + 1 })}</p>
            <h2 className="text-xl font-bold">{t(STEP_TITLE[step])}</h2>
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
        {step === 'who' && (
          <div role="group" aria-label={t('ns.step.who')} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {list.map((s) => (
              <button key={s.id} type="button" aria-pressed={s.id === sectionId} onClick={() => pickSection(s.id)} className={`${tile} ${s.id === sectionId ? tileOn : ''}`}>
                <span className={artCircle}>
                  <SectionArt icon={s.icon} className="h-14 w-14" />
                </span>
                <span className="text-lg font-bold">{sectionLabel(s)}</span>
              </button>
            ))}
            <AddTile label={t('ns.add')} onClick={() => setSheet('section')} />
          </div>
        )}

        {step === 'what' && section && (
          <div className="flex flex-col gap-3">
            {section.types.length === 0 && <p className={`text-sm ${muted}`}>{t('ns.noTypes')}</p>}
            <div role="group" aria-label={t('ns.step.what')} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {section.types.map((x) => (
                <button key={x.id} type="button" aria-pressed={x.id === typeId} onClick={() => pickType(x)} className={`${tile} min-h-32 ${x.id === typeId ? tileOn : ''}`}>
                  <span className={`${artCircle} h-16 w-16`}>
                    <TypeArt name={x.name} className="h-11 w-11" />
                  </span>
                  <span className="text-base leading-tight font-bold">{x.name}</span>
                  {x.sizes.length > 0 && <span className={`text-xs ${muted}`}>{sizeRange(x.sizes)}</span>}
                </button>
              ))}
              <AddTile label={t('ns.add')} onClick={() => setSheet('type')} />
            </div>
          </div>
        )}

        {step === 'sizes' && type && (
          <SizeStep
            type={type}
            sizes={sizes}
            pieces={pieces}
            onSizes={setSizes}
            onPieces={setPieces}
            onTypeSizes={(next) => addToList(sectionId, (s) => ({ ...s, types: s.types.map((x) => (x.id === type.id ? { ...x, sizes: next } : x)) }))}
          />
        )}

      </div>

      {/* Kept alive while going back to change sizes, so nothing typed is lost. */}
      {type && stepIndex >= 2 && (
          <div hidden={step !== 'details'} className={step === 'details' ? (direction === 'next' ? 'step-next' : 'step-back') : undefined}>
            <NewItemForm
              key={entry}
              suppliers={suppliers}
              previousSuppliers={previousSuppliers}
              type={type}
              path={section ? `${sectionLabel(section)} › ${type.name}` : type.name}
              sizes={sizes}
              pieces={pieces}
              supplierId={supplierId}
              onSupplier={(id) => setSupplierId(id)}
              billNumber={billNumber}
              onBillNumber={setBillNumber}
              stockDate={stockDate}
              onStockDate={setStockDate}
              onChangeSizes={() => go('sizes')}
              showCost={showCost}
              onSaved={(href) => {
                // Next 16 keeps this screen alive: start the next item from "What is it?",
                // same section, company, bill no. and stock date.
                feedback('done');
                setTypeId('');
                setSizes([]);
                setPieces({});
                setEntry((n) => n + 1);
                setDirection('next');
                setStep(sectionId ? 'what' : 'who');
                router.push(href);
              }}
            />
          </div>
        )}

      {step === 'sizes' && type && (
        <div className="sticky bottom-24 z-10 flex items-center justify-between gap-3 rounded-3xl bg-surface/95 p-3 shadow-lg ring-1 ring-brand-100 backdrop-blur sm:bottom-4 dark:ring-brand-900">
          <p data-testid="size-summary" className="pl-2 text-sm font-semibold">
            {sizes.length === 0
              ? t('ns.sizes.pickOne')
              : t('ns.sizes.summary', {
                  sizes: t(sizes.length === 1 ? 'ns.sizes.count.one' : 'ns.sizes.count.other', { n: sizes.length }),
                  pieces: t(totalPieces === 1 ? 'stk.item.pcs.one' : 'stk.item.pcs.other', { n: totalPieces }),
                })}
          </p>
          <button
            type="button"
            disabled={sizes.length === 0}
            onClick={() => {
              haptic();
              go('details');
            }}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl bg-brand-600 px-6 text-base font-bold text-white shadow-md shadow-brand-700/25 transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-40"
          >
            {t('ns.next')}
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
            pickSection(added.id);
          }}
        />
      )}
      {sheet === 'type' && section && (
        <AddTypeSheet
          section={{ id: section.id, label: sectionLabel(section) }}
          onClose={() => setSheet(null)}
          onAdded={(added) => {
            addToList(section.id, (s) => ({ ...s, types: [...s.types, added].sort((a, b) => a.name.localeCompare(b.name)) }));
            setSheet(null);
            pickType(added);
          }}
        />
      )}
    </div>
  );
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

/** Step 3: tap sizes (or Pick all); each chosen size gets − pieces +; "+ Add size" keeps a new size on the type. */
function SizeStep({
  type,
  sizes,
  pieces,
  onSizes,
  onPieces,
  onTypeSizes,
}: {
  type: WizardType;
  sizes: string[];
  pieces: Record<string, number>;
  onSizes: (sizes: string[]) => void;
  onPieces: (pieces: Record<string, number>) => void;
  onTypeSizes: (sizes: string[]) => void;
}) {
  const t = useT();
  const [newSize, setNewSize] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const chosen = (size: string) => sizes.some((s) => sameSize(s, size));
  const toggle = (size: string) => {
    haptic();
    onSizes(chosen(size) ? sizes.filter((s) => !sameSize(s, size)) : [...sizes, size]);
  };
  const setCount = (size: string, value: number) => onPieces({ ...pieces, [size]: Math.max(0, Math.min(999, value)) });
  // The type's sizes in shop order, then any size picked that the type does not list.
  const offered = [...type.sizes, ...sizes.filter((s) => !type.sizes.some((x) => sameSize(x, s)))];
  const allChosen = offered.length > 0 && offered.every(chosen);

  const addSize = () => {
    const size = cleanSizeList([newSize])[0];
    if (!size) return;
    setError(null);
    startBusy(async () => {
      const result = await addTypeSizeAction(type.id, size);
      if (!result.ok) return setError(result.error);
      onTypeSizes(result.sizes);
      if (!chosen(size)) onSizes([...sizes, size]);
      setNewSize('');
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{t('stk.design.sizesFor', { name: type.name })}</p>
        {offered.length > 1 && (
          <button
            type="button"
            onClick={() => onSizes(allChosen ? [] : offered)}
            className="rounded-full px-3 py-1.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50 active:scale-95 dark:text-brand-300 dark:hover:bg-brand-950"
          >
            {allChosen ? t('ns.sizes.none') : t('stk.design.pickAll')}
          </button>
        )}
      </div>
      {offered.length === 0 && <p className={`text-sm ${muted}`}>{t('ns.sizes.noSizes')}</p>}
      <div data-testid="size-cards" className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {offered.map((size) => {
          const on = chosen(size);
          const count = pieces[size] ?? 1;
          return (
            <div key={size} className={`flex flex-col overflow-hidden rounded-2xl ring-1 transition ${on ? 'bg-brand-600 text-white shadow-md ring-brand-600' : 'bg-surface ring-zinc-200 dark:ring-zinc-700'}`}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={t('stk.sizeAria', { size })}
                onClick={() => toggle(size)}
                className="flex min-h-16 items-center justify-center px-2 text-2xl font-bold tabular-nums transition active:scale-95"
              >
                {size}
              </button>
              {on && (
                <div className="flex items-center justify-between bg-black/15 px-1 py-1">
                  <button type="button" aria-label={t('ns.sizes.less', { size })} onClick={() => setCount(size, count - 1)} className="flex h-9 w-9 items-center justify-center rounded-full text-xl font-bold active:scale-90">
                    −
                  </button>
                  <input
                    inputMode="numeric"
                    aria-label={t('ns.sizes.piecesOf', { size })}
                    value={String(count)}
                    onChange={(e) => setCount(size, /^\d+$/.test(e.target.value) ? Number(e.target.value) : 0)}
                    className="w-10 bg-transparent text-center text-lg font-bold tabular-nums outline-none"
                  />
                  <button type="button" aria-label={t('ns.sizes.more', { size })} onClick={() => setCount(size, count + 1)} className="flex h-9 w-9 items-center justify-center rounded-full text-xl font-bold active:scale-90">
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
          aria-label={t('ns.sizes.newSize')}
          className={`w-full ${input}`}
        />
        <button type="button" disabled={busy || !newSize.trim()} onClick={addSize} className="shrink-0 rounded-2xl border border-brand-300 px-4 text-sm font-bold text-brand-700 transition hover:bg-brand-50 active:scale-95 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950">
          {t('ns.sizes.addSize')}
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
    <ActionSheet title={t('ns.addSection.title')} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startBusy(async () => {
            const result = await createSectionAction({ name, icon });
            if (!result.ok) return setError(result.error);
            onAdded({ id: result.section.id, name: result.section.name, icon });
          });
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t('ns.addSection.name')}
          <input required autoFocus maxLength={30} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('ns.addSection.placeholder')} className={`${input} text-lg`} />
        </label>
        <div role="radiogroup" aria-label={t('ns.addSection.picture')} className="grid grid-cols-5 gap-2">
          {SECTION_ICONS.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={icon === key}
              aria-label={t(`ns.icon.${key}` as MessageKey)}
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
          {busy ? t('common.saving') : t('ns.addSection.save')}
        </button>
        <button type="button" onClick={onClose} className={sheetSecondary}>
          {t('common.cancel')}
        </button>
      </form>
    </ActionSheet>
  );
}

function AddTypeSheet({ section, onClose, onAdded }: { section: { id: string; label: string }; onClose: () => void; onAdded: (type: WizardType) => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [sizes, setSizes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  return (
    <ActionSheet title={t('ns.addType.title', { section: section.label })} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startBusy(async () => {
            const result = await createTypeAction({ sectionId: section.id, name, sizes });
            if (!result.ok) return setError(result.error);
            onAdded(result.type);
          });
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t('ns.addType.name')}
          <input required autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('ns.addType.placeholder')} className={`${input} text-lg`} />
        </label>
        <div role="group" aria-label={t('cat.sizes.presets')} className="flex flex-wrap gap-2">
          {SIZE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setSizes(preset.sizes.join(', '))}
              className="rounded-full border border-brand-200 px-3 py-1.5 text-sm font-semibold text-brand-800 transition hover:bg-brand-50 active:scale-95 dark:border-brand-900 dark:text-brand-200 dark:hover:bg-brand-950"
            >
              {sizeRange(preset.sizes)}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t('ns.addType.sizes')}
          <input value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="28, 30, 32, 34" className={input} />
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={sheetPrimary}>
          {busy ? t('common.saving') : t('ns.addType.save')}
        </button>
        <button type="button" onClick={onClose} className={sheetSecondary}>
          {t('common.cancel')}
        </button>
      </form>
    </ActionSheet>
  );
}
