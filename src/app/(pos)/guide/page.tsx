import Link from 'next/link';
import { card, link, muted, secondaryButton } from '@/components/ui/styles';
import { HangTag } from '@/features/catalog/hang-tag';
import { GuideProgress, LessonDone, LessonTick } from '@/features/guide/progress';
import { AUDIENCES, LESSONS, type Lesson } from '@/features/guide/lessons';
import { inStoreEan13 } from '@/features/scanning/ean13';
import '@/features/guide/guide.css';

export const metadata = { title: 'Guide · Maa Collection' };

const SAMPLE_TAG = {
  product: { sku: 'MAA-KU-003', barcode: inStoreEan13(1), name: 'Cotton Straight Kurta', brand: 'Laxmi Fashion House', size: 'L', color: 'Blue', mrpPaise: 149900 },
  sizes: ['S', 'M', 'L', 'XL'],
};

const TAG_PARTS = [
  ['QR code', 'Staff open the item with the phone camera. Customers only see the login page.'],
  ['Size, big — and the colour', 'The first thing to check against the piece.'],
  ['All sizes of this design', 'This piece’s size is in black: easy to find another size for the customer.'],
  ['Name and ART. number', 'ART. is the item code (SKU). On the right: the purchase price in your secret letters, if switched on.'],
  ['Barcode', 'Scan it at the counter (camera or scanner), or type the number under it.'],
  ['MRP', 'The highest price. The agreed (bargained) price is entered when selling.'],
];

const ROUTINE = [
  ['Every morning · 5 min', 'Home: low stock. Catalog → Needs attention: items without photo, company or stock.'],
  ['When goods arrive', 'Enter them the same day (new design / many products / more of existing) → print tags → attach → shelf.'],
  ['Every sale or exchange', 'Always scan. Stock updates by itself on every phone.'],
  ['Every evening', 'Print today’s labels; tag any piece still without a tag.'],
  ['Every week', 'Reports → Not selling (move or discount) and Best sellers (reorder). Count one shelf against the stock on Products.'],
  ['Every month', 'Download the sales and stock CSV for the accountant.'],
];

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">{i + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function TagAnatomy() {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <HangTag product={SAMPLE_TAG.product} sizes={SAMPLE_TAG.sizes} qrValue="Sample tag – Maa Collection guide" priceCode="CKE" />
      <ol className="flex flex-col gap-2" aria-label="Parts of a tag">
        {TAG_PARTS.map(([title, text], i) => (
          <li key={title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
              {i + 1}
            </span>
            <span>
              <strong>{title}</strong>
              <span className={`block ${muted}`}>{text}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Routine() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Inventory routine</caption>
        <tbody className="align-top">
          {ROUTINE.map(([when, what]) => (
            <tr key={when} className="border-t border-zinc-200 dark:border-zinc-800">
              <th scope="row" className="w-[38%] py-2 pr-3 font-semibold">
                {when}
              </th>
              <td className="py-2">{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`mt-2 text-xs ${muted}`}>
        Shelf has fewer pieces than the app (lost or damaged)? Tell the owner — reducing stock by hand isn&apos;t in the app yet, so
        the history stays honest.
      </p>
    </div>
  );
}

function LessonCard({ lesson, number }: { lesson: Lesson; number: number }) {
  return (
    <section id={lesson.id} aria-labelledby={`${lesson.id}-title`} className={`${card} flex scroll-mt-20 flex-col gap-4`}>
      <div className="flex flex-col gap-1">
        <p className={`text-xs font-medium tracking-wide uppercase ${muted}`}>
          Lesson {number} · {lesson.minutes} min
        </p>
        <h3 id={`${lesson.id}-title`} className="text-lg font-semibold">
          {lesson.title}
        </h3>
        <p className={`text-sm ${muted}`}>{lesson.intro}</p>
      </div>
      {lesson.extra === 'tag-anatomy' ? (
        <TagAnatomy />
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {lesson.art && <div className="flex justify-center rounded-lg bg-zinc-50 p-3 sm:w-72 sm:shrink-0 dark:bg-zinc-900">{lesson.art}</div>}
          <div className="flex flex-1 flex-col gap-3 text-sm leading-relaxed">
            <Steps items={lesson.steps} />
            {lesson.extra === 'routine' && <Routine />}
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

export default function GuidePage() {
  let number = 0;
  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Guide</h1>
        <p className={`text-sm ${muted}`}>
          Learn the app step by step: {LESSONS.length} short lessons, 1–4 minutes each. Pick your part, try each screen with the{' '}
          <em>Open</em> buttons, and tick a lesson when you know it.
        </p>
        <GuideProgress ids={LESSONS.map((l) => l.id)} />
      </div>

      <nav aria-label="Guide lessons" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {AUDIENCES.map((a) => (
          <div key={a.id} className={`${card} flex flex-col gap-2`}>
            <a href={`#for-${a.id}`} className="font-semibold">
              {a.label} <span className={`text-xs font-normal ${muted}`}>· {a.who}</span>
            </a>
            <ul className="flex flex-col gap-1 text-sm">
              {LESSONS.filter((l) => l.audience === a.id).map((l) => (
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
            {a.label} <span className={`text-sm font-normal ${muted}`}>· {a.who}</span>
          </h2>
          {LESSONS.filter((l) => l.audience === a.id).map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} number={++number} />
          ))}
        </div>
      ))}

      <section className={`${card} flex flex-col gap-2 text-sm`}>
        <h2 className="text-lg font-semibold">Stuck?</h2>
        <p>
          <Link href="/help#faq" className={link}>
            Problems &amp; fixes
          </Link>{' '}
          (camera, scanner, PIN, printing) and the{' '}
          <Link href="/help#required" className={link}>
            quick reference
          </Link>{' '}
          of required fields.
        </p>
      </section>
    </main>
  );
}
