'use client';

import { useState, type ReactNode } from 'react';
import { muted, secondaryButton } from '@/components/ui/styles';
import { useClearOnLeave } from '@/features/forms/fresh-on-return';
import { useT } from '@/features/i18n/i18n-provider';

/**
 * A long list shown a page at a time (companies overview, 2026-11-20): the
 * owner asked for ten rows at a time with Previous / Next for the rest. The
 * rows are rendered by the caller (server components are fine); this only
 * picks which ones show. Lists that fit on one page show no pager. Coming back from
 * another screen starts on the first page again (ADR-068).
 */
export function Paged({ items, size = 10, testId, as: Tag = 'ul', className }: { items: ReactNode[]; size?: number; testId?: string; as?: 'ul' | 'div'; className?: string }) {
  const t = useT();
  const [page, setPage] = useState(0);
  useClearOnLeave(() => setPage(0));
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages - 1);
  const from = current * size;
  const shown = items.slice(from, from + size);
  return (
    <div className="flex flex-col gap-2">
      <Tag data-testid={testId} className={className}>
        {shown}
      </Tag>
      {pages > 1 && (
        <nav aria-label={t('cat.pager.range', { from: from + 1, to: from + shown.length, total: items.length })} className="flex items-center justify-between gap-2 text-sm">
          <button type="button" onClick={() => setPage(current - 1)} disabled={current === 0} className={`${secondaryButton} px-3 py-1.5 text-xs disabled:opacity-40`}>
            ‹ {t('cat.pager.prev')}
          </button>
          <span data-testid={testId ? `${testId}-range` : undefined} className={`tabular-nums ${muted}`}>
            {t('cat.pager.range', { from: from + 1, to: from + shown.length, total: items.length })}
          </span>
          <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pages - 1} className={`${secondaryButton} px-3 py-1.5 text-xs disabled:opacity-40`}>
            {t('cat.pager.next')} ›
          </button>
        </nav>
      )}
    </div>
  );
}
