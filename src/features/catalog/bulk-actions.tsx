'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { barButton, barDanger, useSelection } from '@/components/ui/selection';
import { input, primaryButton, secondaryButton } from '@/components/ui/styles';
import { TagChooser } from '@/features/catalog/item-parts';
import { useT } from '@/features/i18n/i18n-provider';
import type { MessageKey } from '@/lib/i18n';
import type { ProductTags } from '@/lib/product-tags';
import { PRINT_MAX } from '@/lib/selection-limits';
import { bulkProductsAction, setCompaniesActiveAction, type BulkProductInput } from '@/server/actions/admin';

type Option = { id: string; name: string };
type Panel = 'hide' | 'rename' | 'company' | 'category' | 'tags' | 'prices';


/**
 * Products → Select (plan v17): what can be done to the chosen items. Each
 * action opens a small form in the bar; Apply changes them all at once.
 */
export function ProductBulkActions({
  companies,
  categories,
  canCatalog,
  canPrices,
  canPrint,
  hiddenView,
}: {
  companies: Option[];
  categories: (Option & { code: string })[];
  /** Hide / bring back / rename / company / category / tags need the Catalog right. */
  canCatalog: boolean;
  canPrices: boolean;
  canPrint: boolean;
  /** Showing hidden items: the action is Bring back. */
  hiddenView: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const { selected, clear } = useSelection();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [name, setName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState<ProductTags>({ forGender: null, ageGroup: null });
  const [mrp, setMrp] = useState('');
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, startBusy] = useTransition();
  const none = selected.length === 0;

  const run = (change: BulkProductInput) =>
    startBusy(async () => {
      setMessage(null);
      const result = await bulkProductsAction(selected, change);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      setMessage({ ok: true, text: result.message });
      setPanel(null);
      clear();
      router.refresh();
    });

  const open = (next: Panel) => {
    setMessage(null);
    setPanel(panel === next ? null : next);
  };
  const actions: { id: Panel; label: MessageKey; show: boolean }[] = [
    { id: 'rename', label: 'bulk.rename', show: !hiddenView && canCatalog },
    { id: 'company', label: 'bulk.company', show: !hiddenView && canCatalog },
    { id: 'category', label: 'bulk.category', show: !hiddenView && canCatalog },
    { id: 'tags', label: 'bulk.tags', show: !hiddenView && canCatalog },
    { id: 'prices', label: 'bulk.prices', show: !hiddenView && canPrices },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canCatalog &&
          (hiddenView ? (
            <button type="button" disabled={none || busy} onClick={() => run({ kind: 'show' })} className={barButton}>
              {t('bulk.bringBack')}
            </button>
          ) : (
            <button type="button" disabled={none || busy} onClick={() => open('hide')} className={barDanger}>
              {t('bulk.hide')}
            </button>
          ))}
        {actions
          .filter((a) => a.show)
          .map((a) => (
            <button key={a.id} type="button" aria-pressed={panel === a.id} disabled={none || busy} onClick={() => open(a.id)} className={`${barButton} ${panel === a.id ? 'bg-amber-400 text-slate-900 hover:bg-amber-300' : ''}`}>
              {t(a.label)}
            </button>
          ))}
        {canPrint && !hiddenView && (
          <button
            type="button"
            disabled={none || busy}
            onClick={() => {
              if (selected.length > PRINT_MAX) return setMessage({ ok: false, text: t('bulk.printMax', { n: PRINT_MAX }) });
              router.push(`/admin/labels/print?${new URLSearchParams({ items: selected.join(',') })}`);
            }}
            className={barButton}
          >
            {t('bulk.print')}
          </button>
        )}
      </div>

      {panel && (
        <div data-testid="bulk-panel" className="flex flex-col gap-3 rounded-2xl bg-white p-3 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
          {panel === 'hide' && (
            <>
              <p className="text-sm">{t('bulk.hideConfirm', { n: selected.length })}</p>
              <button type="button" disabled={busy} onClick={() => run({ kind: 'hide' })} className={`${barDanger} w-fit`}>
                {t('bulk.hideYes', { n: selected.length })}
              </button>
            </>
          )}
          {panel === 'rename' && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run({ kind: 'rename', name });
              }}
            >
              <input required autoFocus aria-label={t('bulk.newName')} placeholder={t('bulk.newName')} value={name} onChange={(e) => setName(e.target.value)} className={`${input} w-full min-w-0`} />
              <button type="submit" disabled={busy} className={primaryButton}>
                {t('bulk.apply')}
              </button>
            </form>
          )}
          {panel === 'company' && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run({ kind: 'company', supplierId });
              }}
            >
              <select aria-label={t('bulk.company')} value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`${input} w-full min-w-0`}>
                <option value="">{t('cat.product.noCompany')}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={busy} className={primaryButton}>
                {t('bulk.apply')}
              </button>
            </form>
          )}
          {panel === 'category' && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run({ kind: 'category', categoryId });
              }}
            >
              <select required aria-label={t('bulk.category')} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${input} w-full min-w-0`}>
                <option value="">{t('stk.chooseCategory')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <button type="submit" disabled={busy} className={primaryButton}>
                {t('bulk.apply')}
              </button>
            </form>
          )}
          {panel === 'tags' && (
            <>
              <TagChooser value={tags} onChange={setTags} />
              <button type="button" disabled={busy} onClick={() => run({ kind: 'tags', forGender: tags.forGender ?? '', ageGroup: tags.ageGroup ?? '' })} className={`${primaryButton} w-fit`}>
                {t('bulk.apply')}
              </button>
            </>
          )}
          {panel === 'prices' && (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run({ kind: 'prices', mrp, price });
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                <input inputMode="decimal" aria-label={t('bulk.newMrp')} placeholder={t('bulk.newMrp')} value={mrp} onChange={(e) => setMrp(e.target.value)} className={`${input} min-w-0`} />
                <input inputMode="decimal" aria-label={t('bulk.newPrice')} placeholder={t('bulk.newPrice')} value={price} onChange={(e) => setPrice(e.target.value)} className={`${input} min-w-0`} />
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('bulk.pricesHint')}</p>
              <button type="submit" disabled={busy} className={`${primaryButton} w-fit`}>
                {t('bulk.apply')}
              </button>
            </form>
          )}
          <button type="button" onClick={() => setPanel(null)} className={`${secondaryButton} w-fit text-xs`}>
            {t('cat.company.cancel')}
          </button>
        </div>
      )}
      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-amber-200' : 'text-red-300'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

/** All tags → Select (plan v17): print just the chosen tags. */
export function PrintSelected() {
  const t = useT();
  const router = useRouter();
  const { selected } = useSelection();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={selected.length === 0}
        onClick={() => {
          if (selected.length > PRINT_MAX) return setError(t('bulk.printMax', { n: PRINT_MAX }));
          router.push(`/admin/labels/print?${new URLSearchParams({ items: selected.join(',') })}`);
        }}
        className={`${barButton} w-fit`}
      >
        {t('bulk.printN', { n: selected.length })}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

/** Companies → Select (plan v17): hide the chosen companies (they move to "Previous companies") or bring them back. */
export function CompanyBulkActions() {
  const t = useT();
  const router = useRouter();
  const { selected, clear } = useSelection();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, startBusy] = useTransition();
  const run = (active: boolean) =>
    startBusy(async () => {
      const result = await setCompaniesActiveAction(selected, active);
      setMessage(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
      if (result.ok) {
        clear();
        router.refresh();
      }
    });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={selected.length === 0 || busy} onClick={() => run(false)} className={barDanger}>
          {t('bulk.hide')}
        </button>
        <button type="button" disabled={selected.length === 0 || busy} onClick={() => run(true)} className={barButton}>
          {t('bulk.bringBack')}
        </button>
      </div>
      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-amber-200' : 'text-red-300'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
