/**
 * Small animated drawings for the Guide (CSS in ./guide.css; still pictures
 * for people who prefer reduced motion). Decorative: each has a text caption
 * next to it, so they are hidden from screen readers.
 */

import { THEME_SWATCH, THEMES } from '@/features/appearance/appearance';

const frame = 'h-auto w-full max-w-[280px] text-zinc-800 dark:text-zinc-200';
const paper = 'fill-white dark:fill-zinc-900';
const soft = 'fill-zinc-100 dark:fill-zinc-800';
const line = 'stroke-zinc-300 dark:stroke-zinc-700';
const green = 'fill-brand-600';

function Svg({ children, h = 150 }: { children: React.ReactNode; h?: number }) {
  return (
    <svg viewBox={`0 0 280 ${h}`} aria-hidden="true" className={frame} fill="none">
      {children}
    </svg>
  );
}

function Bars({ x, y, w = 60, h = 26 }: { x: number; y: number; w?: number; h?: number }) {
  const widths = [2, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 2, 3, 1, 2, 1];
  let at = x;
  const scale = w / widths.reduce((a, b) => a + b + 1, 0);
  return (
    <g className="fill-current">
      {widths.map((bw, i) => {
        const rect = <rect key={i} x={at} y={y} width={bw * scale} height={h} />;
        at += (bw + 1) * scale;
        return rect;
      })}
    </g>
  );
}

function Qr({ x, y, s = 30 }: { x: number; y: number; s?: number }) {
  const cells = ['1110111', '1010101', '1110111', '0001000', '1011101', '0110011', '1011010'];
  const c = s / 7;
  return (
    <g className="fill-current">
      {cells.flatMap((row, r) => row.split('').map((v, k) => (v === '1' ? <rect key={`${r}-${k}`} x={x + k * c} y={y + r * c} width={c} height={c} /> : null)))}
    </g>
  );
}

/** A phone camera scanning a tag: the red line sweeps, then a green tick. */
export function ScanArt() {
  return (
    <Svg>
      <rect x="20" y="20" width="110" height="110" rx="10" className={soft} />
      <rect x="40" y="35" width="70" height="80" rx="6" className={`${paper} ${line}`} strokeWidth="1.5" />
      <Bars x={48} y={62} w={54} h={26} />
      <rect x="44" y="74" width="62" height="2" className="g-scanline fill-red-500" />
      <rect x="150" y="10" width="90" height="130" rx="14" className={`${paper} ${line}`} strokeWidth="2" />
      <rect x="160" y="30" width="70" height="40" rx="4" className={soft} />
      <Bars x={168} y={38} w={54} h={24} />
      <circle cx="195" cy="100" r="16" className={`g-pop ${green}`} style={{ '--d': '0.6s' } as React.CSSProperties} />
      <path d="M187 100l6 6 10-12" className="g-pop stroke-white" strokeWidth="3" strokeLinecap="round" style={{ '--d': '0.6s' } as React.CSSProperties} />
    </Svg>
  );
}

/** Phone camera on a tag's QR → the item opens. */
export function QrArt() {
  return (
    <Svg>
      <rect x="22" y="20" width="80" height="110" rx="8" className={`${paper} ${line}`} strokeWidth="1.5" />
      <circle cx="62" cy="30" r="4" className={line} strokeWidth="1.5" />
      <Qr x={70} y={40} s={24} />
      <text x="34" y="92" className="fill-current text-[22px] font-bold">M</text>
      <Bars x={34} y={102} w={56} h={16} />
      <path d="M112 75h26" className="g-blink stroke-brand-600" strokeWidth="3" strokeDasharray="5 4" />
      <path d="M134 69l8 6-8 6" className="g-blink stroke-brand-600" strokeWidth="3" fill="none" />
      <rect x="150" y="10" width="110" height="130" rx="14" className={`${paper} ${line}`} strokeWidth="2" />
      <rect x="162" y="26" width="86" height="40" rx="6" className={`g-pop ${soft}`} style={{ '--d': '0.4s' } as React.CSSProperties} />
      <rect x="162" y="74" width="60" height="8" rx="4" className="g-pop fill-zinc-400" style={{ '--d': '0.6s' } as React.CSSProperties} />
      <rect x="162" y="88" width="40" height="8" rx="4" className="g-pop fill-zinc-300" style={{ '--d': '0.7s' } as React.CSSProperties} />
      <rect x="162" y="106" width="86" height="20" rx="6" className={`g-pop ${green}`} style={{ '--d': '0.9s' } as React.CSSProperties} />
    </Svg>
  );
}

/** Returned item goes back, new item goes out. */
export function ExchangeArt() {
  return (
    <Svg h={120}>
      <g className="g-swap-a">
        <rect x="30" y="30" width="60" height="70" rx="8" className="fill-sky-200 dark:fill-sky-900" />
        <text x="60" y="72" textAnchor="middle" className="fill-current text-[16px] font-bold">L</text>
      </g>
      <g className="g-swap-b">
        <rect x="190" y="30" width="60" height="70" rx="8" className="fill-amber-200 dark:fill-amber-900" />
        <text x="220" y="72" textAnchor="middle" className="fill-current text-[16px] font-bold">XL</text>
      </g>
      <path d="M110 50h60M160 42l10 8-10 8" className="stroke-zinc-400" strokeWidth="2" />
      <path d="M170 82h-60M120 74l-10 8 10 8" className="stroke-zinc-400" strokeWidth="2" />
    </Svg>
  );
}

/** Sizes × colours fill in one by one; the XL column gets its own price. */
export function DesignGridArt() {
  const sizes = ['M', 'L', 'XL'];
  const colours = ['fill-zinc-800', 'fill-zinc-200', 'fill-rose-400'];
  return (
    <Svg h={160}>
      {sizes.map((s, i) => (
        <text key={s} x={90 + i * 62} y="22" textAnchor="middle" className={`text-[13px] font-semibold ${s === 'XL' ? 'fill-brand-600' : 'fill-current'}`}>
          {s}
        </text>
      ))}
      {colours.map((c, r) => (
        <g key={c}>
          <circle cx="32" cy={50 + r * 38} r="10" className={`${c} stroke-zinc-400`} />
          {sizes.map((s, i) => (
            <rect
              key={s}
              x={64 + i * 62}
              y={34 + r * 38}
              width="52"
              height="30"
              rx="6"
              className={`g-pop ${s === 'XL' ? 'fill-brand-100 stroke-brand-600 dark:fill-brand-950' : `${soft} ${line}`}`}
              strokeWidth="1.5"
              style={{ '--d': `${(r * 3 + i) * 0.12}s` } as React.CSSProperties}
            />
          ))}
        </g>
      ))}
      <text x="214" y="153" textAnchor="middle" className="g-blink fill-brand-600 text-[11px] font-semibold">₹600</text>
      <text x="121" y="153" textAnchor="middle" className="fill-zinc-500 text-[11px]">₹500</text>
    </Svg>
  );
}

/** Tags come out of the printer. */
export function PrintArt() {
  return (
    <Svg h={150}>
      <rect x="70" y="20" width="140" height="50" rx="10" className="fill-zinc-300 dark:fill-zinc-700" />
      <rect x="90" y="62" width="100" height="8" rx="2" className="fill-zinc-500" />
      {[0, 1, 2].map((i) => (
        <g key={i} className="g-drop" style={{ '--d': `${i * 0.5}s` } as React.CSSProperties}>
          <rect x={92 + i * 34} y="78" width="28" height="56" rx="4" className={`${paper} ${line}`} strokeWidth="1.5" />
          <Qr x={104 + i * 34} y={82} s={12} />
          <Bars x={96 + i * 34} y={112} w={20} h={10} />
        </g>
      ))}
    </Svg>
  );
}

/** Taking a photo: the shutter flashes. */
export function PhotoArt() {
  return (
    <Svg h={140}>
      <rect x="60" y="30" width="160" height="96" rx="14" className="fill-zinc-700 dark:fill-zinc-600" />
      <rect x="110" y="18" width="60" height="20" rx="6" className="fill-zinc-700 dark:fill-zinc-600" />
      <circle cx="140" cy="78" r="32" className="fill-zinc-900" />
      <circle cx="140" cy="78" r="20" className="fill-sky-300 dark:fill-sky-700" />
      <circle cx="196" cy="48" r="5" className="fill-amber-300" />
      <rect x="0" y="0" width="280" height="140" opacity="0" className="g-flash fill-white" />
    </Svg>
  );
}

/** Scanning each piece adds one: 1 → 2 → 3. */
export function CountArt() {
  return (
    <Svg h={120}>
      <rect x="20" y="25" width="70" height="70" rx="8" className={`${paper} ${line}`} strokeWidth="1.5" />
      <Bars x={30} y={45} w={50} h={30} />
      <rect x="24" y="58" width="62" height="2" className="g-scanline fill-red-500" />
      <path d="M105 60h40M137 52l8 8-8 8" className="stroke-zinc-400" strokeWidth="2" />
      <rect x="160" y="25" width="100" height="70" rx="10" className={soft} />
      {['+1  → 1', '+1  → 2', '+1  → 3'].map((t, i) => (
        <text
          key={t}
          x="210"
          y="68"
          textAnchor="middle"
          className={`g-frame ${i === 2 ? 'g-final' : ''} fill-brand-700 text-[20px] font-bold dark:fill-brand-400`}
          style={{ '--d': `${i * 1.2}s` } as React.CSSProperties}
        >
          {t}
        </text>
      ))}
    </Svg>
  );
}

/** Goods flow: supplier → receive → tag → shelf → sold → reports. `labels`: the six stop names (another language). */
export function StockFlowArt({ labels: stops = ['Supplier', 'Receive', 'Tag', 'Shelf', 'Sell', 'Report'] }: { labels?: readonly string[] }) {
  return (
    <Svg h={110}>
      <path d="M22 50H258" className={line} strokeWidth="3" />
      {stops.map((s, i) => (
        <g key={s}>
          <circle cx={22 + i * 47.2} cy="50" r="9" className={i === 5 ? green : 'fill-brand-100 stroke-brand-600 dark:fill-brand-950'} strokeWidth="2" />
          <text x={22 + i * 47.2} y="80" textAnchor="middle" className="fill-current text-[10px]">
            {s}
          </text>
        </g>
      ))}
      {[0, 1.3, 2.6].map((d) => (
        <rect key={d} x="14" y="24" width="16" height="12" rx="2" className="g-move fill-amber-400" style={{ '--d': `${d}s`, '--dx': '236px' } as React.CSSProperties} />
      ))}
    </Svg>
  );
}

/** Report bars growing. */
export function ReportArt() {
  const heights = [40, 70, 55, 90, 65];
  return (
    <Svg h={130}>
      <path d="M30 110H250" className={line} strokeWidth="2" />
      {heights.map((h, i) => (
        <rect key={i} x={45 + i * 42} y={110 - h} width="26" height={h} rx="3" className={`g-grow ${i === 3 ? green : 'fill-brand-300 dark:fill-brand-800'}`} style={{ '--d': `${i * 0.15}s` } as React.CSSProperties} />
      ))}
    </Svg>
  );
}

/** Name + PIN: the four PIN dots fill in. */
export function LoginArt() {
  return (
    <Svg h={140}>
      <rect x="85" y="4" width="110" height="132" rx="14" className={`${paper} ${line}`} strokeWidth="2" />
      {/* Name circles: the first one is chosen (zari ring). */}
      {['V', 'N', 'P'].map((n, i) => (
        <g key={n}>
          <circle cx={112 + i * 28} cy="24" r="10" className={i === 0 ? green : 'fill-brand-800/70'} />
          {i === 0 && <circle cx="112" cy="24" r="13" className="stroke-zari" strokeWidth="2" />}
          <text x={112 + i * 28} y="28" textAnchor="middle" className="fill-white text-[10px] font-semibold">
            {n}
          </text>
        </g>
      ))}
      {/* PIN dots fill in as keys are pressed. */}
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={122 + i * 12} cy="50" r="3.5" className="g-pop fill-current" style={{ '--d': `${i * 0.35}s` } as React.CSSProperties} />
      ))}
      {/* Number keys. */}
      {Array.from({ length: 12 }, (_, k) => (
        <rect
          key={k}
          x={103 + (k % 3) * 25}
          y={62 + Math.floor(k / 3) * 17}
          width="21"
          height="13"
          rx="4"
          className={k === 9 ? 'fill-none' : `${soft} g-blink`}
          style={{ '--d': `${(k % 4) * 0.35}s` } as React.CSSProperties}
        />
      ))}
    </Svg>
  );
}

/** Colours and day/night: the five dye swatches (one ticked) and the day/night switch. */
export function ThemeArt() {
  return (
    <Svg h={140}>
      {THEMES.map((name, i) => {
        const cx = 40 + i * 50;
        return (
          <g key={name}>
            <clipPath id={`g-swatch-${name}`}>
              <circle cx={cx} cy="46" r="17" />
            </clipPath>
            <g clipPath={`url(#g-swatch-${name})`}>
              <rect x={cx - 17} y="29" width="34" height="34" style={{ fill: THEME_SWATCH[name].main }} />
              <rect x={cx - 17} y="54" width="34" height="9" style={{ fill: THEME_SWATCH[name].accent }} />
            </g>
            {i === 0 && <path d={`M${cx - 6} 46l4 4 8-9`} className="g-pop stroke-white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
          </g>
        );
      })}
      {/* Day / night switch: the knob slides from the sun to the moon. */}
      <rect x="95" y="90" width="90" height="34" rx="17" className={`${soft} ${line}`} strokeWidth="1.5" />
      <circle cx="112" cy="107" r="5" className="stroke-current" strokeWidth="2" />
      <path d="M170 101a7 7 0 1 0 5 10a6 6 0 0 1-5-10Z" className="fill-current" />
      <circle cx="112" cy="107" r="12" className="g-slide fill-brand-600 opacity-60" />
    </Svg>
  );
}

/** Owner ticks rights for a person. `labels`: the four right names (another language). */
export function TeamArt({ labels: rights = ['Catalog', 'Prices', 'Stock', 'Purchase'] }: { labels?: readonly string[] }) {
  return (
    <Svg h={140}>
      <circle cx="50" cy="60" r="22" className={soft} />
      <circle cx="50" cy="52" r="8" className="fill-zinc-400" />
      <path d="M36 74c4-10 24-10 28 0" className="stroke-zinc-400" strokeWidth="3" />
      {rights.map((r, i) => (
        <g key={r}>
          <rect x="100" y={14 + i * 30} width="20" height="20" rx="5" className={i === 3 ? `${paper} ${line}` : green} strokeWidth="1.5" />
          {i < 3 && <path d={`M105 ${24 + i * 30}l4 4 7-8`} className="g-pop stroke-white" strokeWidth="2.5" style={{ '--d': `${i * 0.3}s` } as React.CSSProperties} />}
          <text x="130" y={28 + i * 30} className="fill-current text-[12px]">
            {r}
          </text>
        </g>
      ))}
    </Svg>
  );
}

/** Price by size: the XL row turns green. */
export function PricesArt() {
  const rows = [
    ['M', '₹500', false],
    ['L', '₹550', true],
    ['XL', '₹600', true],
  ] as const;
  return (
    <Svg h={130}>
      {rows.map(([size, price, own], i) => (
        <g key={size}>
          <text x="40" y={34 + i * 36} className={`text-[14px] font-bold ${own ? 'fill-brand-600' : 'fill-current'}`}>
            {size}
          </text>
          <rect
            x="90"
            y={14 + i * 36}
            width="150"
            height="28"
            rx="6"
            strokeWidth="1.5"
            className={own ? 'g-blink fill-brand-50 stroke-brand-600 dark:fill-brand-950' : `${paper} ${line}`}
            style={{ '--d': `${i * 0.4}s` } as React.CSSProperties}
          />
          <text x="165" y={33 + i * 36} textAnchor="middle" className={`text-[13px] ${own ? 'fill-current font-semibold' : 'fill-zinc-400'}`}>
            {price}
          </text>
        </g>
      ))}
    </Svg>
  );
}
