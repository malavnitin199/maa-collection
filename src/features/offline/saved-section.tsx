'use client';

import { sectionTitle } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import { useOutbox } from './hooks';
import { SavedSales } from './saved-sales';

/** My sales (plan v18): sales still on this phone, shown only when there are some. */
export function SavedSalesSection({ me }: { me: { id: string } }) {
  const t = useT();
  const outbox = useOutbox();
  if (!outbox.some((s) => s.recordedBy === me.id)) return null;
  return (
    <section data-testid="my-saved" className="flex flex-col gap-2">
      <h2 className={sectionTitle}>{t('off.list.title')}</h2>
      <SavedSales me={me} />
    </section>
  );
}
