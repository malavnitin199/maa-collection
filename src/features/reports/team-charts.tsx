import { muted } from '@/components/ui/styles';
import { formatPaise } from '@/lib/money';
import type { TeamSeller } from '@/server/services/reports';

const rupees = (paise: number) => formatPaise(paise).replace(/\.00$/, '');
const pct = (value: number) => `${value >= 10 || value === 0 ? Math.round(value) : value.toFixed(1)}%`;
const dayLabel = (day: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));

/**
 * Share of the team's sales: ranked horizontal bars on one baseline, one hue,
 * largest first. Each row: name, bar, amount and share. Hover shows the details.
 */
export function ShareBars({ sellers }: { sellers: TeamSeller[] }) {
  const max = Math.max(0, ...sellers.map((s) => s.netPaise));
  return (
    <ol data-testid="team-share" className="viz-root flex flex-col gap-2">
      {sellers.map((s) => {
        const width = max > 0 ? Math.max(0, (s.netPaise / max) * 100) : 0;
        const details = `${s.name}: ${formatPaise(s.netPaise)}, ${pct(s.sharePct)} of team sales, ${s.bills} bills, ${s.units} pieces`;
        return (
          <li key={s.id} title={details} aria-label={details} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[8rem_1fr_auto]">
            <span className="truncate font-medium">{s.name}</span>
            <span className="relative h-5">
              {width > 0 && (
                <span className="absolute inset-y-0.5 left-0 rounded-r-[4px] bg-[var(--series-1)]" style={{ width: `${width}%` }} />
              )}
            </span>
            <span className="text-right tabular-nums">
              {rupees(s.netPaise)} <span className={`text-xs ${muted}`}>· {pct(s.sharePct)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * One seller's sales per day: thin columns (max 24 px, 4 px rounded top) from
 * one baseline, on a scale shared by every seller (`max`) so the cards compare
 * fairly. Hovering a day (its whole slot) shows the amount; first, best and
 * last day are labelled under the axis.
 */
export function DailyColumns({ name, days, values, max }: { name: string; days: string[]; values: number[]; max: number }) {
  const best = values.reduce((bi, v, i) => (v > values[bi] ? i : bi), 0);
  return (
    <figure className="viz-root flex flex-col gap-1">
      <div role="img" aria-label={`${name}: sales per day`} className="flex h-16 items-end gap-[2px] border-b border-[var(--viz-axis)]">
        {values.map((value, i) => {
          const h = max > 0 && value > 0 ? Math.max(3, (value / max) * 100) : 0;
          return (
            <div key={days[i]} title={`${dayLabel(days[i])}: ${formatPaise(value)}`} className="flex h-full flex-1 items-end justify-center">
              {h > 0 && <div className="w-[70%] max-w-[24px] rounded-t-[4px] bg-[var(--series-1)]" style={{ height: `${h}%` }} />}
            </div>
          );
        })}
      </div>
      <figcaption className={`flex justify-between gap-2 text-xs ${muted}`}>
        <span>{dayLabel(days[0])}</span>
        {values[best] > 0 && days.length > 1 && (
          <span>
            best {dayLabel(days[best])}: {rupees(values[best])}
          </span>
        )}
        {days.length > 1 && <span>{dayLabel(days[days.length - 1])}</span>}
      </figcaption>
    </figure>
  );
}

export { pct as formatShare };
