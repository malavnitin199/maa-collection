import { formatDate, type Locale, type T } from '@/lib/i18n';
import { shopDay, type TagGroup } from '@/lib/tag-library';

const DAY = 86_400_000;

/** A group's heading in the reader's language: Today / Yesterday / a date, a company, a category, or a delivery. */
export function groupTitle(group: TagGroup<unknown>, t: T, locale: Locale, now: Date = new Date()): string {
  if (group.by === 'date') {
    if (group.key === shopDay(now)) return t('stk.lib.today');
    if (group.key === shopDay(new Date(now.getTime() - DAY))) return t('stk.lib.yesterday');
    return formatDate(locale, `${group.key}T12:00:00Z`, 'date');
  }
  if (group.by === 'company') return group.name ?? t('stk.lib.noCompany');
  if (group.by === 'category') return group.name ?? t('stk.lib.noCategory');
  if (group.key === 'none') return t('stk.lib.oneByOne');
  const bill = group.delivery?.bill;
  return [group.name ?? t('stk.lib.noCompany'), bill && t('stk.labels.bill', { bill })].filter(Boolean).join(' · ');
}

/** The small line under a heading: a delivery's date and person; the date itself under Today / Yesterday. */
export function groupNote(group: TagGroup<unknown>, t: T, locale: Locale, now: Date = new Date()): string | null {
  if (group.by === 'delivery' && group.delivery) {
    const by = group.delivery.by;
    return [formatDate(locale, group.delivery.at, 'dateTime'), by && t('stk.labels.by', { name: by })].filter(Boolean).join(' · ');
  }
  if (group.by === 'date' && groupTitle(group, t, locale, now) !== formatDate(locale, `${group.key}T12:00:00Z`, 'date')) {
    return formatDate(locale, `${group.key}T12:00:00Z`, 'date');
  }
  return null;
}
