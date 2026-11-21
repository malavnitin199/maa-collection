'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Paged } from '@/components/ui/paged';
import { SelectableItem, SelectionBar, SelectionProvider, SelectToggle } from '@/components/ui/selection';
import { card, input, muted } from '@/components/ui/styles';
import { CompanyBulkActions } from '@/features/catalog/bulk-actions';
import { useT } from '@/features/i18n/i18n-provider';
import { useTypingScript } from '@/features/i18n/lang-text';
import { SpeakButton } from '@/features/i18n/speak-button';
import { formatPaise } from '@/lib/money';
import { hasDevanagari, toEnglish, toHindi } from '@/lib/transliterate';
import type { CompaniesOverview, CompanyOverviewRow } from '@/server/services/company';

export type BrowserRow = Pick<CompanyOverviewRow, 'id' | 'name' | 'location' | 'contactName' | 'phone' | 'active' | 'bills' | 'openBills' | 'collections' | 'amountPaise' | 'duePaise'>;

const fold = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

/** Every way a typed or spoken search could match: as said, and turned into the other script. */
function needles(query: string): string[] {
  const q = fold(query);
  if (!q) return [];
  return [...new Set([q, fold(hasDevanagari(q) ? toEnglish(q) : toHindi(q))])].filter(Boolean);
}

/**
 * The Companies page list (owner's feedback 2026-11-21): a search box with the
 * microphone (name, location, contact or phone; English or Hindi), a Location
 * dropdown, the figures folded away under *Summary*, and short rows ten at a
 * time. Select (hide / bring back) works as before.
 */
export function CompanyBrowser({ rows, totals, showMoney }: { rows: BrowserRow[]; totals: CompaniesOverview['totals']; showMoney: boolean }) {
  const t = useT();
  const [script] = useTypingScript();
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState('');
  const [summary, setSummary] = useState(false);
  const places = useMemo(
    () => [...new Set(rows.map((r) => r.location?.trim()).filter((l): l is string => Boolean(l)))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const shown = useMemo(() => {
    const words = needles(query);
    return rows.filter((row) => {
      if (place && fold(row.location ?? '') !== fold(place)) return false;
      if (words.length === 0) return true;
      const hay = fold([row.name, row.location, row.contactName, row.phone].filter(Boolean).join(' '));
      return words.some((w) => hay.includes(w));
    });
  }, [rows, query, place]);
  const money = (paise: number | null) => (paise === null ? '—' : formatPaise(paise));

  return (
    <SelectionProvider allIds={rows.map((r) => r.id)}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-stretch gap-1.5">
          <label className="sr-only" htmlFor="company-search">
            {t('cat.find.label')}
          </label>
          <input
            id="company-search"
            type="search"
            data-testid="company-search"
            value={query}
            lang={script}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('cat.find.placeholder')}
            className={`${input} min-w-0 flex-1`}
          />
          <SpeakButton script={script} text="" onText={setQuery} />
        </div>
        {/* Second line, small (owner, 2026-11-21): place filter · Summary … count · Select. */}
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
          {places.length > 0 && (
            <select
              aria-label={t('cat.find.location')}
              data-testid="company-location"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              className="h-8 max-w-[10rem] min-w-0 truncate rounded-full border border-zinc-300 bg-surface px-2.5 text-sm dark:border-zinc-700"
            >
              <option value="">{t('cat.find.anywhere')}</option>
              {places.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
          {/* The figures stay folded away until asked for. */}
          <button
            type="button"
            aria-expanded={summary}
            aria-controls="company-summary"
            onClick={() => setSummary(!summary)}
            className="h-8 shrink-0 rounded-full border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-700"
          >
            {t('cat.find.summary')} <span aria-hidden className={`inline-block transition ${summary ? 'rotate-180' : ''}`}>▾</span>
          </button>
          </span>
          <span className="flex items-center gap-2">
            {/* Only while filtering: "3 of 23". */}
            {(query.trim() || place) && (
              <span data-testid="company-count" className={`text-xs whitespace-nowrap tabular-nums ${muted}`}>
                {t('cat.find.count', { n: shown.length, total: rows.length })}
              </span>
            )}
            <SelectToggle testId="select-companies" />
          </span>
        </div>
        {summary && (
          <div id="company-summary" data-testid="company-summary" className={`${card} rise-in py-3 text-sm`}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5">
              <Figure label={t('own.co.companies')} value={String(totals.companies)} />
              <Figure label={t('own.co.bills')} value={showMoney ? `${totals.bills} · ${t('own.co.billsSub', { open: totals.openBills })}` : String(totals.bills)} />
              <Figure label={t('own.co.collections')} value={`${totals.collections} · ${t('own.pcs', { n: totals.pieces })}`} />
              {showMoney && <Figure label={t('own.co.spend')} value={money(totals.purchasesPaise)} />}
              {showMoney && <Figure label={t('own.co.dues')} value={money(totals.duePaise)} />}
            </dl>
          </div>
        )}

        {shown.length === 0 ? (
          <p className={`text-sm ${muted}`}>{t('cat.find.none')}</p>
        ) : (
          <Paged
            key={`${query}\u0000${place}`}
            testId="supplier-list"
            className="flex flex-col gap-1.5"
            items={shown.map((s) => (
              <li key={s.id}>
                <SelectableItem ids={[s.id]} label={s.name} gutter>
                  <Link href={`/admin/suppliers/${s.id}`} className={`${card} flex items-center justify-between gap-3 px-3.5 py-2.5 active:bg-zinc-50 dark:active:bg-zinc-900`}>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {s.name}
                        {!s.active && <span className={`ml-1 text-xs font-normal ${muted}`}>{t('cat.inactiveParen')}</span>}
                      </span>
                      {(s.location || s.contactName || s.phone) && (
                        <span className={`block truncate text-xs ${muted}`}>{[s.location, s.contactName, s.phone].filter(Boolean).join(' · ')}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-right text-xs tabular-nums">
                      <span className={`block ${s.duePaise ? 'font-semibold text-amber-700 dark:text-amber-300' : muted}`}>
                        {showMoney ? t('cat.sup.billsDues', { bills: s.bills, amount: money(s.duePaise) }) : t('cat.sup.bills', { bills: s.bills })}
                      </span>
                      <span className={`block ${muted}`}>{t('cat.find.collections', { n: s.collections })}</span>
                    </span>
                  </Link>
                </SelectableItem>
              </li>
            ))}
          />
        )}
      </div>
      <SelectionBar>
        <CompanyBulkActions />
      </SelectionBar>
    </SelectionProvider>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className={`text-xs ${muted}`}>{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
