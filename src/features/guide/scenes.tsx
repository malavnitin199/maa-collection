import { IconCamera, IconChevron, IconDots, IconHome, IconLock, IconMenu, IconPencil, IconRupee, IconScan, IconSwap, IconTrash } from '@/components/ui/icons';
import { THEME_SWATCH, THEMES } from '@/features/appearance/appearance';
import { HangTag } from '@/features/catalog/hang-tag';
import { inStoreEan13 } from '@/features/scanning/ean13';
import type { Locale } from '@/lib/i18n';
import { pick, type L, type Scene, type TagPart } from './stories';

/*
 * Animated scenes for the Guide's story player (plan v10; CSS in guide.css).
 * A small phone in the app's own colours shows the control a step is about;
 * a round "finger" marker taps it. One loop is 2.8 s. With reduced motion the
 * scenes are still pictures of the end state. Decorative: the step's words and
 * voice carry the meaning, so everything here is hidden from screen readers.
 */

type D = React.CSSProperties & Record<`--${string}`, string | number>;
const delay = (seconds: number): D => ({ '--d': `${seconds}s` });

/** The finger: a soft dot that presses, with a ripple. `x`/`y` in % of the scene. */
function Tap({ x, y }: { x: number; y: number }) {
  return <span className="st-tap" style={{ left: `${x}%`, top: `${y}%` }} />;
}

function Bars({ className = '' }: { className?: string }) {
  const widths = [2, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 2];
  return (
    <span className={`flex items-stretch gap-px ${className}`}>
      {widths.map((w, i) => (
        <span key={i} className="bg-zinc-900" style={{ width: w * 1.6 }} />
      ))}
    </span>
  );
}

function QrGrid() {
  const cells = ['1110111', '1010101', '1110111', '0001000', '1011101', '0110011', '1011010'];
  return (
    <span className="grid h-12 w-12 grid-cols-7 gap-px">
      {cells.flatMap((row, r) => row.split('').map((v, c) => <span key={`${r}-${c}`} className={v === '1' ? 'bg-zinc-900' : ''} />))}
    </span>
  );
}

const row = 'h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700';
const pill = 'flex items-center justify-center rounded-full px-3 py-2 text-[11px] leading-tight font-semibold';

/** The phone: dyed band with the zari edge, then the scene. */
function Phone({ children, band, dock }: { children: React.ReactNode; band?: React.ReactNode; dock?: React.ReactNode }) {
  return (
    <div className="st-root relative flex h-[330px] w-[208px] flex-col overflow-hidden rounded-[2rem] border-[6px] border-zinc-800 bg-[var(--background)] shadow-xl dark:border-zinc-600">
      <div className="st-band bg-brand-800 px-3 pt-2 pb-1 text-white dark:bg-brand-950">
        {band ?? <p className="st-brand font-display text-[11px]">Maa Collection</p>}
        <div className="zari mt-1 !h-1.5 opacity-90" />
      </div>
      <div className="relative flex flex-1 flex-col gap-2 p-3">{children}</div>
      {dock}
    </div>
  );
}

const SAMPLE_TAG = { sku: 'MAA-KU-003', barcode: inStoreEan13(1), name: 'Cotton Straight Kurta', brand: 'Laxmi Fashion House', size: 'L', color: '', mrpPaise: 149900 };
// Where each part sits on the 40 × 60 mm tag (left, top, width, height in %).
const TAG_BOX: Record<TagPart, [number, number, number, number]> = {
  hole: [2.5, 1.3, 9, 6],
  qr: [65.5, 3, 30.5, 20],
  size: [3.3, 10.6, 60.5, 15.6],
  sizes: [3.3, 26.5, 59, 5],
  name: [3.3, 32, 60, 5],
  code: [3.3, 37.3, 94, 4.8],
  barcode: [5, 43.5, 90, 23.5],
  mrp: [3.3, 82.3, 94, 15.6],
};

/** The real tag, a little bigger, with one part ringed. */
function TagScene({ part }: { part: TagPart }) {
  const [left, top, width, height] = TAG_BOX[part];
  return (
    <div className="st-root flex h-[330px] items-center justify-center">
      <div className="relative origin-center scale-[1.3]">
        <HangTag product={SAMPLE_TAG} sizes={['M', 'L', 'XL', 'XXL']} qrValue="Sample tag – Maa Collection guide" priceCode="CKE" />
        <span className="st-ring" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }} />
        {/* The finger sits on the ring's lower edge so it doesn't hide what the ring shows. */}
        <Tap x={left + width * 0.8} y={top + height} />
      </div>
    </div>
  );
}

/** New item's closed fold under the four boxes (ADR-065). */
const MORE: L = { en: 'Sizes & more', hi: 'साइज़ और बाकी' };
const TOTAL: L = { en: 'Total', hi: 'कुल' };

/** The product page's photo box and sheet (ADR-068), in the app's own words. */
const PHOTO_ADD: L = { en: 'Add photo', hi: 'फ़ोटो जोड़ें' };
const PHOTO_TITLE: L = { en: 'Product photo', hi: 'प्रोडक्ट की फ़ोटो' };
const PHOTO_CAMERA: L = { en: '📷 Take photo', hi: '📷 फ़ोटो खींचें' };
const PHOTO_GALLERY: L = { en: '🖼 Gallery', hi: '🖼 गैलरी' };
const PHOTO_CLOSE: L = { en: 'Close', hi: 'बंद करें' };
/** The selecting bar (ADR-057). */
const SEL_COUNT: L = { en: '2 selected', hi: '2 चुने' };
const SEL_ALL: L = { en: 'Select all', hi: 'सब चुनें' };
const SEL_CANCEL: L = { en: 'Cancel', hi: 'रद्द करें' };

const RIGHTS: L[] = [
  { en: 'Catalog', hi: 'कैटलॉग' },
  { en: 'Prices', hi: 'दाम' },
  { en: 'Stock', hi: 'स्टॉक' },
  { en: 'Purchase price', hi: 'खरीद दाम' },
];

export function PhoneScene({ scene, locale }: { scene: Scene; locale: Locale }) {
  const say = (text: L) => pick(text, locale);
  switch (scene.kind) {
    case 'tag':
      return <TagScene part={scene.part} />;

    case 'names':
      return (
        <Phone>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-semibold">
            {['V', 'N', 'P'].map((n, i) => (
              <span key={n} className="flex flex-col items-center gap-1">
                <span className={`flex h-11 w-11 items-center justify-center rounded-full font-display text-base text-white ${i === 0 ? 'st-target bg-brand-600 ring-2 ring-zari ring-offset-2 ring-offset-[var(--background)]' : 'bg-brand-800/70'}`}>{n}</span>
                <span className={`${row} w-9`} />
              </span>
            ))}
          </div>
          <div className={`${row} mt-4 w-2/3`} />
          <div className={`${row} w-1/2`} />
          <Tap x={17} y={12} />
        </Phone>
      );

    case 'keypad':
      return (
        <Phone>
          <div className="flex h-8 items-center justify-center gap-2 rounded-xl bg-surface ring-1 ring-zinc-200 dark:ring-zinc-700">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="st-char h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100" style={delay(0.35 + i * 0.4)} />
            ))}
          </div>
          <div className="grid flex-1 grid-cols-3 gap-1.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => (
              <span key={i} className={`flex items-center justify-center rounded-lg text-xs font-semibold ${k ? 'bg-brand-50 text-brand-900 dark:bg-zinc-800 dark:text-zinc-100' : ''} ${i === 4 ? 'st-target' : ''}`}>
                {k}
              </span>
            ))}
          </div>
          <Tap x={50} y={46} />
        </Phone>
      );

    case 'dock':
      return (
        <Phone
          dock={
            <div className="relative mx-2 mb-2 flex items-end justify-between rounded-2xl bg-surface px-3 pt-1 pb-1.5 shadow ring-1 ring-black/5 dark:ring-white/10">
              <IconHome className="h-4 w-4 text-zinc-400" />
              <IconSwap className="h-4 w-4 text-zinc-400" />
              <span className="st-target -mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-4 ring-[var(--background)]">
                <IconScan className="h-5 w-5" />
              </span>
              <IconRupee className="h-4 w-4 text-zinc-400" />
              <IconMenu className="h-4 w-4 text-zinc-400" />
            </div>
          }
        >
          <div className={`${row} w-2/3`} />
          <div className="h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          <div className={`${row} w-1/2`} />
          <div className={`${row} w-3/4`} />
          <Tap x={50} y={104} />
        </Phone>
      );

    case 'header': {
      // Finger positions (% of the phone) over the header's two buttons: अ · ⋯ (plan v17).
      const at = { lang: 72, menu: 87 }[scene.tap];
      // st-head-btn(-on): drawn like the real header's round buttons in Hara (guide.css).
      const on = 'st-target st-head-btn-on bg-white/30';
      return (
        <Phone
          band={
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <span className="st-badge flex h-5 w-5 items-center justify-center rounded-md bg-white/15 text-[7px] font-bold ring-1 ring-white/30">MC</span>
                <p className="st-brand font-display text-[10px]">Maa Collection</p>
              </div>
              <div className="flex items-center gap-1">
                <span className={`st-head-btn flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${scene.tap === 'lang' ? on : 'bg-white/10'}`}>अ</span>
                <span className={`st-head-btn flex h-6 w-6 items-center justify-center rounded-full ${scene.tap === 'menu' ? on : 'bg-white/10'}`}>
                  <IconDots className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          }
        >
          {scene.tap === 'lang' ? (
            <div className="relative mt-6 h-10 text-center font-display text-2xl text-brand-900 dark:text-brand-100">
              <span className="st-a absolute inset-0">Sell</span>
              <span className="st-b absolute inset-0">बेचें</span>
            </div>
          ) : (
            <div className="h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          )}
          <div className={`${row} w-2/3`} />
          <div className={`${row} w-1/2`} />
          <Tap x={at} y={-9} />
        </Phone>
      );
    }

    case 'swatches':
      return (
        <Phone>
          <div className={`${row} w-1/2`} />
          <div className="mt-auto rounded-2xl bg-surface p-2.5 shadow-lg ring-1 ring-black/5 dark:ring-white/10">
            <div className="grid grid-cols-5 gap-1.5">
              {THEMES.slice(0, 5).map((name, i) => (
                <span key={name} className={`relative block aspect-square overflow-hidden rounded-full ${i === 2 ? 'st-target' : ''}`} style={{ background: THEME_SWATCH[name].main }}>
                  <span className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: THEME_SWATCH[name].accent }} />
                  {i === 2 && <span className="st-pop absolute inset-0 flex items-center justify-center text-xs font-bold text-white">✓</span>}
                </span>
              ))}
            </div>
            <div className={`${row} mx-auto mt-2 w-1/2`} />
          </div>
          <Tap x={50} y={85} />
        </Phone>
      );

    case 'daynight':
      return (
        <Phone>
          <span className="st-night absolute inset-0 bg-zinc-950" />
          <div className="relative mt-8 flex h-10 items-center justify-between rounded-full bg-zinc-200 px-3 text-base dark:bg-zinc-700">
            <span className="st-slide absolute top-1 left-1 h-8 w-[46%] rounded-full bg-brand-600 shadow" />
            <span className="relative w-1/2 text-center">☀</span>
            <span className="relative w-1/2 text-center">☾</span>
          </div>
          <div className={`${row} relative mt-4 w-2/3`} />
          <div className={`${row} relative w-1/2`} />
          <Tap x={72} y={19} />
        </Phone>
      );

    case 'scan':
      return (
        <Phone>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-zinc-900">
            {['top-2 left-2 border-t-2 border-l-2', 'top-2 right-2 border-t-2 border-r-2', 'bottom-2 left-2 border-b-2 border-l-2', 'right-2 bottom-2 border-r-2 border-b-2'].map((c) => (
              <span key={c} className={`absolute h-4 w-4 border-zari ${c}`} />
            ))}
            {scene.label && <span className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-zari px-2 py-0.5 text-[9px] font-bold text-zinc-900">{say(scene.label)}</span>}
            <span className="flex flex-col items-center gap-1 rounded-md bg-white px-3 py-3">
              {scene.qr ? <QrGrid /> : <Bars className="h-10" />}
            </span>
            <span className="st-scanline absolute inset-x-5 top-1/2 h-0.5 bg-red-500" />
            <span className="st-pop absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">✓</span>
          </div>
          <span className={`${pill} bg-white/60 text-brand-800 ring-1 ring-brand-200 dark:bg-zinc-800 dark:text-brand-200 dark:ring-zinc-700`}>
            <IconCamera className="mr-1 h-3.5 w-3.5" />
            <span className={`${row} w-14`} />
          </span>
        </Phone>
      );

    case 'card':
      return (
        <Phone>
          <div className="flex gap-2 rounded-2xl bg-surface p-2 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <span className="h-14 w-11 rounded-lg bg-brand-200 dark:bg-brand-900" />
            <span className="flex flex-1 flex-col gap-1.5 pt-0.5">
              <span className={`${row} w-full`} />
              <span className="flex gap-1 text-[9px] font-bold">
                {/* Size only, like the counter card: colour is shown on the product page alone (ADR-049). */}
                <span className="rounded bg-brand-100 px-1.5 py-0.5 text-brand-900 dark:bg-brand-900 dark:text-brand-100">L</span>
                <span className="st-pop text-brand-600">✓</span>
              </span>
              <span className={`${row} w-2/3`} />
            </span>
          </div>
          <span className={`${pill} st-target mt-2 bg-brand-600 text-white`}>{say(scene.button)}</span>
          <Tap x={50} y={41} />
        </Phone>
      );

    case 'field':
      return (
        <Phone>
          <div className={`${row} w-1/2`} />
          <p className="mt-2 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">{say(scene.label)}</p>
          <div className="st-target flex h-10 items-center rounded-xl bg-surface px-3 font-mono text-lg text-zinc-900 ring-2 ring-brand-500 dark:text-zinc-100">
            {scene.value.split('').map((ch, i) => (
              <span key={i} className="st-char" style={delay(0.3 + i * 0.3)}>
                {ch}
              </span>
            ))}
            <span className="st-caret ml-0.5 h-5 w-0.5 bg-brand-600" />
          </div>
          {scene.note && <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{say(scene.note)}</p>}
          <div className={`${row} mt-2 w-2/3`} />
        </Phone>
      );

    case 'done':
      return (
        <Phone>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <span className="relative flex h-16 w-16 items-center justify-center">
              <span className="st-burst absolute inset-0 rounded-full bg-brand-500/40" />
              <span className="st-pop relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-2xl font-bold text-white">✓</span>
            </span>
            <p className="font-display text-base text-brand-900 dark:text-brand-100">{say(scene.title)}</p>
            <p className="font-display text-xl">{scene.amount}</p>
          </div>
        </Phone>
      );

    case 'chips':
      return (
        <Phone>
          <p className="mt-2 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">{say(scene.label)}</p>
          <div className="flex flex-wrap gap-1.5">
            {scene.chips.map((chip, i) =>
              scene.swatches ? (
                <span key={chip} className="relative h-9 w-9 rounded-full ring-1 ring-black/10" style={{ background: chip }}>
                  <span className="st-pop absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[9px] font-bold text-white" style={delay(i * 0.35)}>
                    ✓
                  </span>
                </span>
              ) : (
                <span key={chip} className={`${i < 3 ? 'st-fill' : ''} rounded-full border border-brand-600 px-2.5 py-1 text-[11px] font-semibold text-brand-800 dark:text-brand-200`} style={delay(i * 0.35)}>
                  {chip}
                </span>
              ),
            )}
          </div>
          <div className={`${row} mt-3 w-2/3`} />
          <div className={`${row} w-1/2`} />
          <Tap x={scene.swatches ? 38 : 30} y={17} />
        </Phone>
      );

    case 'print':
      return (
        <Phone>
          <div className="mx-auto mt-3 h-9 w-28 rounded-lg bg-zinc-700 dark:bg-zinc-500">
            <div className="mx-auto mt-6 h-1 w-20 rounded-full bg-zinc-900" />
          </div>
          <div className="mx-auto flex h-28 items-start gap-1.5 overflow-hidden">
            {[0, 1, 2].map((i) => (
              <span key={i} className="st-print flex h-20 w-9 flex-col items-center justify-between rounded-sm bg-white py-1.5 shadow ring-1 ring-zinc-300" style={delay(i * 0.25)}>
                <span className="h-3 w-3 rounded-sm bg-zinc-900" />
                <Bars className="h-5 scale-[0.5]" />
              </span>
            ))}
          </div>
        </Phone>
      );

    case 'photo':
      return (
        <Phone>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-zinc-200 dark:bg-zinc-700">
            {/* A kurta on a plain background. */}
            <span className="relative h-24 w-16 rounded-b-lg bg-brand-500">
              <span className="absolute -left-4 top-0 h-9 w-5 -rotate-12 rounded bg-brand-500" />
              <span className="absolute -right-4 top-0 h-9 w-5 rotate-12 rounded bg-brand-500" />
              <span className="absolute top-0 left-1/2 h-4 w-5 -translate-x-1/2 rounded-b-full bg-zinc-200 dark:bg-zinc-700" />
            </span>
            <span className="st-flash absolute inset-0 bg-white" />
            <span className="st-pop absolute bottom-2 left-2 h-9 w-7 rounded bg-brand-500 ring-2 ring-white" />
          </div>
          <span className="st-target mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white">
            <IconCamera className="h-5 w-5" />
          </span>
          <Tap x={50} y={90} />
        </Phone>
      );

    case 'edit':
      return (
        <Phone>
          <div className="mt-2 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <div className="relative h-5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
              <span className="st-a absolute inset-0">Kurta M</span>
              <span className="st-b absolute inset-0 text-brand-700 dark:text-brand-300">Kurta L</span>
            </div>
            <Bars className="mt-2 h-6" />
          </div>
          <span className={`${pill} st-target mt-1 gap-1 border border-zinc-300 bg-white/60 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100`}>
            <IconPencil className="h-3.5 w-3.5" />
            <span className={`${row} w-12`} />
          </span>
          <Tap x={50} y={40} />
        </Phone>
      );

    case 'count':
      return (
        <Phone>
          <div className="mt-2 flex items-center gap-2 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <Bars className="h-8" />
            <span className="relative ml-auto h-10 w-10 font-display text-3xl text-brand-700 dark:text-brand-300">
              {['1', '2', '3'].map((n, i) => (
                <span key={n} className="st-f3 absolute inset-0 text-center" data-last={i === 2 || undefined} style={{ '--i': i } as D}>
                  {n}
                </span>
              ))}
            </span>
          </div>
          <span className="st-pop mx-auto rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">+1</span>
          <div className={`${row} w-2/3`} />
        </Phone>
      );

    case 'buttons':
      return (
        <Phone>
          <div className={`${row} mt-1 w-1/2`} />
          <div className="mt-2 flex flex-col gap-2">
            {scene.items.map((item, i) => (
              <span key={i} className={`${pill} ${i === scene.tap ? 'st-target bg-brand-600 text-white' : 'border border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300'}`}>
                {say(item)}
              </span>
            ))}
          </div>
          <Tap x={50} y={19 + scene.tap * 14} />
        </Phone>
      );

    case 'toggles':
      return (
        <Phone>
          <div className="mt-1 flex flex-col gap-2.5">
            {RIGHTS.map((right, i) => (
              <span key={i} className="flex items-center justify-between text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
                {say(right)}
                <span className={`relative h-4 w-8 rounded-full bg-zinc-300 dark:bg-zinc-600 ${i < 3 ? 'st-track' : ''}`} style={delay(i * 0.4)}>
                  <span className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow ${i < 3 ? 'st-knob' : ''}`} style={delay(i * 0.4)} />
                </span>
              </span>
            ))}
          </div>
          <Tap x={88} y={5} />
        </Phone>
      );

    case 'bars':
      return (
        <Phone>
          <div className="mt-2 flex flex-col gap-2.5">
            {[92, 68, 45, 24].map((w, i) => (
              <span key={w} className="flex items-center gap-2">
                <span className="h-5 w-5 shrink-0 rounded-full bg-brand-800/70" />
                <span className="h-3.5 flex-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <span className="st-growx block h-full rounded-full bg-brand-600" style={{ width: `${w}%`, ...delay(i * 0.15) }} />
                </span>
              </span>
            ))}
          </div>
          <div className={`${row} mt-2 w-1/2`} />
        </Phone>
      );

    case 'columns':
      return (
        <Phone>
          <div className="mt-2 flex h-32 items-end gap-1.5 rounded-xl bg-surface p-2 ring-1 ring-black/5 dark:ring-white/10">
            {[40, 65, 30, 85, 55, 100, 70].map((h, i) => (
              <span key={i} className={`st-growy flex-1 rounded-t bg-brand-600 ${i === 5 ? 'st-target' : ''}`} style={{ height: `${h}%`, ...delay(i * 0.1) }} />
            ))}
          </div>
          {/* No finger: a tap on a day shows nothing; the best day is written under each chart. */}
          <div className={`${row} w-2/3`} />
        </Phone>
      );

    case 'tiles':
      // Two columns of tiles, like New item's "Which collection?" and the Categories page.
      return (
        <Phone>
          <div className={`${row} mt-1 w-1/2`} />
          <div className="mt-1 grid grid-cols-2 gap-2">
            {scene.items.map((item, i) => (
              <span
                key={i}
                className={`relative flex h-14 flex-col items-start justify-center rounded-xl px-2.5 text-[11px] leading-tight font-semibold ${
                  i === scene.tap ? 'st-target bg-brand-600 text-white' : 'bg-surface text-zinc-700 ring-1 ring-brand-200 dark:text-zinc-200 dark:ring-zinc-700'
                }`}
              >
                {say(item.name)}
                {item.note && <span className="text-[9px] font-medium opacity-75">{say(item.note)}</span>}
                {item.lock && <IconLock className="absolute top-1.5 right-1.5 h-3 w-3 opacity-70" />}
              </span>
            ))}
          </div>
          <Tap x={scene.tap % 2 ? 86 : 40} y={30 + Math.floor(scene.tap / 2) * 22} />
        </Phone>
      );

    case 'boxes':
      // New item's Details step: four big boxes, the ₹ inside the price boxes, "Sizes & more" closed below.
      return (
        <Phone>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {scene.boxes.map((box, i) => (
              <span
                key={i}
                className={`relative flex h-16 flex-col justify-between rounded-xl bg-surface px-2 py-1.5 ${i === scene.tap ? 'st-target ring-2 ring-brand-500' : 'ring-1 ring-brand-200 dark:ring-zinc-700'}`}
              >
                <span className="text-[9px] font-semibold text-brand-800 dark:text-brand-200">{say(box.label)}</span>
                <span className="flex items-center font-mono text-[13px] text-zinc-900 dark:text-zinc-100">
                  {box.rupee && <span className="mr-0.5 text-zinc-400">₹</span>}
                  {i === scene.tap
                    ? box.value.split('').map((ch, j) => (
                        <span key={j} className="st-char" style={delay(0.3 + j * 0.3)}>
                          {ch}
                        </span>
                      ))
                    : box.value}
                  {i === scene.tap && <span className="st-caret ml-0.5 h-4 w-0.5 bg-brand-600" />}
                </span>
                {scene.calc && i === scene.boxes.length - 1 && (
                  <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-md bg-brand-600 text-[10px] font-bold text-white">%</span>
                )}
              </span>
            ))}
          </div>
          <span className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-[10px] font-semibold text-brand-800 ring-1 ring-brand-200 dark:text-brand-200 dark:ring-zinc-700">
            {say(MORE)}
            <IconChevron className="h-3 w-3" />
          </span>
          <Tap x={scene.tap % 2 ? 88 : 42} y={scene.tap < 2 ? 24 : 49} />
        </Phone>
      );

    case 'figures':
      return (
        <Phone>
          <div className={`${row} mt-1 w-1/2`} />
          <div className={`mt-1 grid gap-2 ${scene.items.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {scene.items.map((figure, i) => (
              <span key={i} className="flex flex-col rounded-xl bg-surface px-2 py-2 ring-1 ring-brand-200 dark:ring-zinc-700">
                <span className={`st-pop origin-left font-display leading-tight text-brand-800 dark:text-brand-200 ${scene.items.length === 3 ? 'text-[13px]' : 'text-base'}`} style={delay(i * 0.2)}>
                  {figure.value}
                </span>
                <span className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400">{say(figure.label)}</span>
              </span>
            ))}
          </div>
          <div className={`${row} mt-2 w-2/3`} />
          <div className={`${row} w-1/2`} />
        </Phone>
      );

    case 'rows':
      // List rows with ✎ / 🗑 on the right, or a lock for the fixed ones.
      return (
        <Phone>
          <div className="mt-1 flex flex-col gap-2">
            {scene.items.map((item, i) => (
              <span key={i} className="flex h-12 items-center gap-1.5 rounded-xl bg-surface px-2 ring-1 ring-brand-200 dark:ring-zinc-700">
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-zinc-900 dark:text-zinc-100">
                    {item.name}
                    {item.lock && <IconLock className="h-2.5 w-2.5 text-zinc-400" />}
                  </span>
                  <span className="text-[8.5px] whitespace-nowrap text-zinc-500 dark:text-zinc-400">{say(item.note)}</span>
                </span>
                {!item.lock && (
                  <>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-zinc-200 dark:ring-zinc-700 ${i === scene.at && scene.tap === 'edit' ? 'st-target bg-brand-600 text-white' : 'text-brand-700 dark:text-brand-300'}`}>
                      <IconPencil className="h-3 w-3" />
                    </span>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-zinc-200 dark:ring-zinc-700 ${i === scene.at && scene.tap === 'delete' ? 'st-target bg-red-600 text-white' : 'text-red-600 dark:text-red-400'}`}>
                      <IconTrash className="h-3 w-3" />
                    </span>
                  </>
                )}
              </span>
            ))}
          </div>
          <Tap x={scene.tap === 'edit' ? 68 : 84} y={14 + scene.at * 19.5} />
        </Phone>
      );

    case 'bill': {
      // A bill table: one grid, so every row shares the columns; the first (item) column takes the room,
      // numbers on the right, the total row pops in last.
      const wide = 0;
      // minmax(0, 1fr): the product name wraps before the numbers are pushed out of the phone.
      const cols = { gridTemplateColumns: scene.head.map((_, i) => (i === wide ? 'minmax(0, 1fr)' : 'auto')).join(' ') };
      const cell = (j: number, head = false) => `px-1 py-1.5 ${j > wide ? `text-right ${head ? '' : 'font-mono'}` : ''}`;
      const totalCell = 'st-pop border-t-2 border-brand-200 font-bold text-brand-900 dark:border-zinc-700 dark:text-brand-100';
      return (
        <Phone>
          <div className="mt-1 grid overflow-hidden rounded-xl bg-surface text-[9px] ring-1 ring-brand-200 dark:ring-zinc-700" style={cols}>
            {scene.head.map((h, j) => (
              <span key={`h${j}`} className={`${cell(j, true)} bg-brand-50 font-semibold text-brand-900 dark:bg-brand-950 dark:text-brand-100`}>
                {say(h)}
              </span>
            ))}
            {scene.rows.flatMap((cells, i) =>
              cells.map((c, j) => (
                <span key={`${i}-${j}`} className={`${cell(j)} border-t border-zinc-100 text-zinc-700 dark:border-zinc-800 dark:text-zinc-200`}>
                  {c}
                </span>
              )),
            )}
            <span className={`${cell(0)} ${totalCell}`} style={{ gridColumn: `span ${wide + 1}` }}>
              {say(TOTAL)}
            </span>
            {scene.total.map((c, j) => (
              <span key={`t${j}`} className={`${cell(j + wide + 1)} ${totalCell}`}>
                {c}
              </span>
            ))}
          </div>
          <div className={`${row} mt-2 w-2/3`} />
        </Phone>
      );
    }

    case 'photobox':
      // The page top with the dashed Add photo box; the finger taps it, then the sheet slides over the page.
      return (
        <Phone>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 rounded-2xl bg-surface p-2 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              <span className="st-target flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-200">
                <IconCamera className="h-4 w-4" />
                <span className="px-0.5 text-center text-[7px] leading-tight font-bold">{say(PHOTO_ADD)}</span>
              </span>
              <span className="flex flex-1 flex-col gap-1.5 pt-1">
                <span className={`${row} w-full`} />
                <span className={`${row} w-2/3`} />
                <span className="h-3 w-10 rounded-full bg-brand-100 dark:bg-brand-900" />
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-9 rounded-lg bg-brand-50 dark:bg-brand-950" />
              ))}
            </div>
          </div>
          <span className="st-a">
            <Tap x={24} y={17} />
          </span>
          <span className="st-b absolute inset-0 bg-slate-950/25" />
          <div className="st-b absolute inset-x-0 bottom-0 flex flex-col gap-1.5 rounded-t-2xl bg-surface p-2.5 shadow-[0_-6px_16px_rgb(0_0_0/0.15)] ring-1 ring-black/5 dark:ring-white/10">
            <span className="mx-auto h-1 w-8 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            <span className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100">{say(PHOTO_TITLE)}</span>
            <span className="grid grid-cols-2 gap-1.5">
              <span className={`${pill} st-target bg-brand-600 px-1 text-[10px] whitespace-nowrap text-white`}>{say(PHOTO_CAMERA)}</span>
              <span className={`${pill} border border-zinc-300 px-1 text-[10px] whitespace-nowrap text-zinc-700 dark:border-zinc-600 dark:text-zinc-200`}>{say(PHOTO_GALLERY)}</span>
            </span>
            <span className={`${pill} border border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300`}>{say(PHOTO_CLOSE)}</span>
            {/* On the button's lower edge, so its words stay readable. */}
            <Tap x={42} y={58} />
          </div>
        </Phone>
      );

    case 'select':
      // Cards with round ticks (two chosen), and the one bar at the bottom with the screen's own button.
      return (
        <Phone>
          <div className="mt-1 flex flex-col gap-1.5">
            {[0, 1, 2].map((i) => {
              const chosen = i < 2;
              return (
                <span
                  key={i}
                  className={`relative flex items-center gap-2 rounded-xl p-1.5 pl-7 ring-1 ${chosen ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-950' : 'bg-surface ring-black/5 dark:ring-white/10'}`}
                >
                  <span
                    className={`absolute left-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 text-[8px] font-bold ${chosen ? 'st-pop border-brand-600 bg-brand-600 text-white' : 'border-zinc-300 dark:border-zinc-600'}`}
                    style={delay(i * 0.3)}
                  >
                    {chosen ? '✓' : ''}
                  </span>
                  <span className="h-7 w-6 rounded bg-brand-100 dark:bg-brand-900" />
                  <span className="flex flex-1 flex-col gap-1">
                    <span className={`${row} w-full`} />
                    <span className={`${row} w-1/2`} />
                  </span>
                </span>
              );
            })}
          </div>
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-slate-900 px-2 pt-1.5 pb-2 text-white">
            <p className="text-center text-[9px] font-bold">{say(SEL_COUNT)}</p>
            <div className="mt-1 grid grid-cols-[1fr_1fr_1.7fr] gap-1 text-center text-[8px] leading-tight font-bold">
              <span className="flex items-center justify-center rounded-lg bg-white/10 px-1 py-1.5">{say(SEL_ALL)}</span>
              <span className="flex items-center justify-center rounded-lg bg-white/10 px-1 py-1.5">{say(SEL_CANCEL)}</span>
              <span className={`st-target flex items-center justify-center rounded-lg px-1 py-1.5 ${scene.danger ? 'bg-red-600' : 'bg-emerald-600'}`}>{say(scene.action)}</span>
            </div>
          </div>
          {/* On the action's lower-right corner, so its words stay readable. */}
          <Tap x={88} y={95} />
        </Phone>
      );

    case 'list':
      return (
        <Phone>
          <div className="mt-1 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`flex items-center gap-2 rounded-xl bg-surface p-2 ring-1 ring-black/5 dark:ring-white/10 ${i === 0 ? 'st-target' : ''}`}>
                <span className="h-7 w-6 rounded bg-zinc-200 dark:bg-zinc-700" />
                <span className={`${row} flex-1`} />
                {i === 0 ? (
                  <span className="relative h-4 w-4 text-[11px] font-bold">
                    <span className="st-a absolute inset-0 text-amber-600">!</span>
                    <span className="st-b absolute inset-0 text-brand-600">✓</span>
                  </span>
                ) : (
                  <span className="w-4 text-[11px] font-bold text-amber-600">!</span>
                )}
              </span>
            ))}
          </div>
          <Tap x={50} y={10} />
        </Phone>
      );
  }
}
