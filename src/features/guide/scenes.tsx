import { IconDots, IconMenu, IconHome, IconPencil, IconRupee, IconScan, IconSwap, IconCamera } from '@/components/ui/icons';
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
      <div className="bg-brand-800 px-3 pt-2 pb-1 text-white dark:bg-brand-950">
        {band ?? <p className="font-display text-[11px]">Maa Collection</p>}
        <div className="zari mt-1 !h-1.5 opacity-90" />
      </div>
      <div className="relative flex flex-1 flex-col gap-2 p-3">{children}</div>
      {dock}
    </div>
  );
}

const SAMPLE_TAG = { sku: 'MAA-KU-003', barcode: inStoreEan13(1), name: 'Cotton Straight Kurta', brand: 'Laxmi Fashion House', size: 'L', color: 'Blue', mrpPaise: 149900 };
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
      const on = 'st-target bg-white/30';
      return (
        <Phone
          band={
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/15 text-[7px] font-bold ring-1 ring-white/30">MC</span>
                <p className="font-display text-[10px]">Maa Collection</p>
              </div>
              <div className="flex items-center gap-1">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${scene.tap === 'lang' ? on : 'bg-white/10'}`}>अ</span>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${scene.tap === 'menu' ? on : 'bg-white/10'}`}>
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
                <span className="rounded bg-brand-100 px-1.5 py-0.5 text-brand-900 dark:bg-brand-900 dark:text-brand-100">L</span>
                <span className="rounded bg-brand-100 px-1.5 py-0.5 text-brand-900 dark:bg-brand-900 dark:text-brand-100">Blue</span>
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

    case 'table':
      return (
        <Phone>
          <div className="mt-2 overflow-hidden rounded-xl bg-surface text-[11px] ring-1 ring-black/5 dark:ring-white/10">
            {[
              ['M', '₹999'],
              ['L', '₹999'],
              ['XL', '₹1,099'],
            ].map(([size, price], i) => (
              <div key={size} className={`flex items-center justify-between border-b border-zinc-100 px-3 py-2 last:border-0 dark:border-zinc-800 ${i === 2 ? 'st-target bg-brand-50 font-bold text-brand-900 dark:bg-brand-950 dark:text-brand-100' : 'text-zinc-500 dark:text-zinc-400'}`}>
                <span>{size}</span>
                <span className="font-mono">{price}</span>
              </div>
            ))}
          </div>
          <div className={`${row} mt-2 w-1/2`} />
          <Tap x={70} y={31} />
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
          <div className={`${row} w-2/3`} />
          <Tap x={73} y={30} />
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
