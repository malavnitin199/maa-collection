import { card, muted, sectionTitle } from '@/components/ui/styles';
import { formatPaise } from '@/lib/money';
import type { ActivityEntry } from '@/server/services/reports';

export function StatTile({ label, value, sub, testId }: { label: string; value: string; sub?: string; testId?: string }) {
  return (
    <div className={card}>
      <p className={`text-xs ${muted}`}>{label}</p>
      <p data-testid={testId} className="mt-1 text-2xl font-semibold tabular-nums">
        {value}
      </p>
      {sub && <p className={`mt-0.5 text-xs ${muted}`}>{sub}</p>}
    </div>
  );
}

const time = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

export function ActivityList({ entries, title, testId }: { entries: ActivityEntry[]; title: string; testId?: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>{title}</h2>
      {entries.length === 0 ? (
        <p className={`text-sm ${muted}`}>Nothing yet.</p>
      ) : (
        <ul data-testid={testId} className="flex flex-col gap-1 text-sm">
          {entries.map((entry) => (
            <li
              key={`${entry.kind}-${entry.id}`}
              className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
            >
              <span className="min-w-0">
                {entry.kind === 'exchange' && (
                  <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    Exchange
                  </span>
                )}
                {entry.description}
                <span className={`block text-xs ${muted}`}>
                  {time.format(new Date(entry.at))} · credited to {entry.creditedTo}
                  {entry.recordedBy !== entry.creditedTo && ` · recorded by ${entry.recordedBy}`}
                </span>
              </span>
              <span className="font-medium tabular-nums">{formatPaise(entry.amountPaise)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
