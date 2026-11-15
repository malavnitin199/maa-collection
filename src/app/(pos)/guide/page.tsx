import Link from 'next/link';
import { card, link, muted, secondaryButton } from '@/components/ui/styles';
import { HangTag } from '@/features/catalog/hang-tag';
import { GuideProgress, LessonDone, LessonTick } from '@/features/guide/progress';
import { AUDIENCES, LESSONS, type Lesson } from '@/features/guide/lessons';
import { HI_LESSONS } from '@/features/guide/lessons.hi';
import { inStoreEan13 } from '@/features/scanning/ean13';
import type { MessageKey, T } from '@/lib/i18n';
import { getLocale, getT } from '@/server/i18n';
import '@/features/guide/guide.css';

export const metadata = { title: 'Guide · Maa Collection' };

const SAMPLE_TAG = {
  product: { sku: 'MAA-KU-003', barcode: inStoreEan13(1), name: 'Cotton Straight Kurta', brand: 'Laxmi Fashion House', size: 'L', color: 'Blue', mrpPaise: 149900 },
  sizes: ['M', 'L', 'XL', 'XXL'],
};

const TAG_PARTS = [1, 2, 3, 4, 5, 6].map((n) => [`tag.part${n}`, `tag.part${n}.text`] as [MessageKey, MessageKey]);

const ROUTINE = (['morning', 'arrive', 'sale', 'evening', 'week', 'month'] as const).map(
  (when) => [`help.routine.${when}`, `help.routine.${when}.text`] as const,
);

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{i + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function TagAnatomy({ t }: { t: T }) {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <HangTag product={SAMPLE_TAG.product} sizes={SAMPLE_TAG.sizes} qrValue="Sample tag – Maa Collection guide" priceCode="CKE" />
      <ol className="flex flex-col gap-2" aria-label={t('guide.partsLabel')}>
        {TAG_PARTS.map(([title, text], i) => (
          <li key={title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
              {i + 1}
            </span>
            <span>
              <strong>{t(title)}</strong>
              <span className={`block ${muted}`}>{t(text)}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Routine({ t }: { t: T }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{t('help.routine.caption')}</caption>
        <tbody className="align-top">
          {ROUTINE.map(([when, what]) => (
            <tr key={when} className="border-t border-zinc-200 dark:border-zinc-800">
              <th scope="row" className="w-[38%] py-2 pr-3 font-semibold">
                {t(when)}
              </th>
              <td className="py-2">{t(what)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`mt-2 text-xs ${muted}`}>{t('help.routine.note')}</p>
    </div>
  );
}

function LessonCard({ lesson, number, t, englishOnly }: { lesson: Lesson; number: number; t: T; englishOnly: boolean }) {
  return (
    <section id={lesson.id} aria-labelledby={`${lesson.id}-title`} className={`${card} flex scroll-mt-20 flex-col gap-4`}>
      <div className="flex flex-col gap-1">
        <p className={`text-xs font-medium tracking-wide uppercase ${muted}`}>
          {t('guide.lesson', { n: number, min: lesson.minutes })}
        </p>
        <h3 id={`${lesson.id}-title`} className="text-lg font-semibold">
          {lesson.title}
        </h3>
        <p className={`text-sm ${muted}`}>{lesson.intro}</p>
        {englishOnly && <p className="text-xs text-amber-700 dark:text-amber-400">{t('guide.englishOnly')}</p>}
      </div>
      {lesson.extra === 'tag-anatomy' ? (
        <TagAnatomy t={t} />
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {lesson.art && <div className="flex justify-center rounded-lg bg-zinc-50 p-3 sm:w-72 sm:shrink-0 dark:bg-zinc-900">{lesson.art}</div>}
          <div className="flex flex-1 flex-col gap-3 text-sm leading-relaxed">
            <Steps items={lesson.steps} />
            {lesson.extra === 'routine' && <Routine t={t} />}
          </div>
        </div>
      )}
      {lesson.tip && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">💡 {lesson.tip}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {lesson.open?.map((o) => (
          <Link key={o.href} href={o.href} className={secondaryButton}>
            {o.label} →
          </Link>
        ))}
        <LessonDone id={lesson.id} title={lesson.title} />
      </div>
    </section>
  );
}

export default async function GuidePage() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  // Lessons in the reader's language where a translation exists (Hindi: all lessons, lessons.hi.tsx).
  const lessons = LESSONS.map((l) => ({ ...l, ...(locale === 'hi' ? HI_LESSONS[l.id] : undefined) }));
  const englishOnly = (id: string) => locale === 'hi' && !HI_LESSONS[id];
  const audience = (id: string) => t(`aud.${id}` as MessageKey);
  const who = (id: string) => t(`aud.${id}.who` as MessageKey);
  let number = 0;
  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t('guide.title')}</h1>
        <p className={`text-sm ${muted}`}>{t('guide.intro', { n: lessons.length })}</p>
        <GuideProgress ids={lessons.map((l) => l.id)} />
      </div>

      <nav aria-label={t('guide.lessons')} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {AUDIENCES.map((a) => (
          <div key={a.id} className={`${card} flex flex-col gap-2`}>
            <a href={`#for-${a.id}`} className="font-semibold">
              {audience(a.id)} <span className={`text-xs font-normal ${muted}`}>· {who(a.id)}</span>
            </a>
            <ul className="flex flex-col gap-1 text-sm">
              {lessons.filter((l) => l.audience === a.id).map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <a href={`#${l.id}`} className={link}>
                    {l.title}
                  </a>
                  <LessonTick id={l.id} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {AUDIENCES.map((a) => (
        <div key={a.id} id={`for-${a.id}`} className="flex scroll-mt-20 flex-col gap-4">
          <h2 className="text-xl font-semibold">
            {audience(a.id)} <span className={`text-sm font-normal ${muted}`}>· {who(a.id)}</span>
          </h2>
          {lessons.filter((l) => l.audience === a.id).map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} number={++number} t={t} englishOnly={englishOnly(lesson.id)} />
          ))}
        </div>
      ))}

      <section className={`${card} flex flex-col gap-2 text-sm`}>
        <h2 className="text-lg font-semibold">{t('guide.stuck')}</h2>
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
