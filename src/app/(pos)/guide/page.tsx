import Link from 'next/link';
import { card, link, muted } from '@/components/ui/styles';
import { GuideProgress } from '@/features/guide/progress';
import { STORIES, type Audience } from '@/features/guide/stories';
import { GuideBrowser } from '@/features/guide/story-player';
import { canAny } from '@/lib/permissions';
import { getCurrentStaff } from '@/server/auth';
import { getT } from '@/server/i18n';

export const metadata = { title: 'Guide · Maa Collection' };

/**
 * The Guide (plan v10): short stories instead of long pages. Pick your part,
 * tap a lesson, and it plays step by step — an animated phone, a few words, and
 * the phone's own voice. Open without logging in. /guide#sell opens a lesson.
 */
export default async function GuidePage() {
  const [t, me] = await Promise.all([getT(), getCurrentStaff()]);
  // Start on the part that fits the person; anyone can switch.
  const mine: Audience = !me ? 'everyone' : me.role === 'admin' ? 'owner' : canAny(me, ['catalog', 'stock']) ? 'stock' : 'sellers';
  return (
    <main className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t('guide.title')}</h1>
        <p className={`text-sm ${muted}`}>{t('guide.short')}</p>
        <GuideProgress ids={STORIES.map((s) => s.id)} />
      </div>

      <GuideBrowser defaultAudience={mine} />

      <section className={`${card} flex flex-col gap-1 text-sm`}>
        <h2 className="text-base font-semibold">{t('guide.stuck')}</h2>
        <p>
          <Link href="/help#faq" className={link}>
            {t('guide.problems')}
          </Link>{' '}
          {t('guide.stuckText')}{' '}
          <Link href="/help#required" className={link}>
            {t('guide.quickRef')}
          </Link>{' '}
          {t('guide.stuckEnd')}
        </p>
      </section>
    </main>
  );
}
