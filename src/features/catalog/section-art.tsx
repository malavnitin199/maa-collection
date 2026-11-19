import type { SectionIcon } from '@/lib/sections';

/**
 * Plan v19 — the pictures on the New item tiles, drawn for this app (no icon
 * set): who an item is for (Man, Woman, Girl, Boy …) and what it is (Jeans,
 * Shirt, Kurti …). Line art on a 48 px grid in `currentColor`; decorative —
 * the tile's text names it.
 */
type ArtProps = { className?: string };

const art = (paths: React.ReactNode, className = 'h-12 w-12') => (
  <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);

const SECTION_ART: Record<SectionIcon, React.ReactNode> = {
  // Short hair, a collar.
  man: (
    <>
      <circle cx="24" cy="15" r="7" />
      <path d="M17.2 13.5c.8-4.6 3.6-6.8 6.8-6.8s6 2.2 6.8 6.8c-2.4-1.4-4.6-2-6.8-2s-4.4.6-6.8 2Z" fill="currentColor" stroke="none" />
      <path d="M9 42c0-8.5 6.5-13 15-13s15 4.5 15 13" />
      <path d="m20 29 4 5 4-5" />
    </>
  ),
  // Long hair to the shoulders, a necklace.
  woman: (
    <>
      <path d="M16.5 25c-1.8-3.4-2-7.4-1.2-10.6C16.6 9.3 20 6.5 24 6.5s7.4 2.8 8.7 7.9c.8 3.2.6 7.2-1.2 10.6" />
      <circle cx="24" cy="15.5" r="6.5" />
      <path d="M10 42c0-7.6 6-12.5 14-12.5S38 34.4 38 42" />
      <path d="M20 30.5c1 2.6 2.4 3.8 4 3.8s3-1.2 4-3.8" />
    </>
  ),
  // Two plaits with bows.
  girl: (
    <>
      <circle cx="24" cy="18" r="6.5" />
      <path d="M18 16.5c.9-3.6 3.2-5.5 6-5.5s5.1 1.9 6 5.5" />
      <path d="M17.6 18.5c-2.4.8-3.6 2.8-3.4 5.4M30.4 18.5c2.4.8 3.6 2.8 3.4 5.4" />
      <path d="m12 24 2.3-1.3 2.3 1.3-2.3 1.3ZM31.4 24l2.3-1.3 2.3 1.3-2.3 1.3Z" fill="currentColor" />
      <path d="M13 42c.4-6.4 4.8-10 11-10s10.6 3.6 11 10" />
    </>
  ),
  // A cap with its peak.
  boy: (
    <>
      <circle cx="24" cy="19" r="6.5" />
      <path d="M17.3 16.4c.4-3.8 3.2-6.2 6.7-6.2s6.3 2.4 6.7 6.2Z" fill="currentColor" stroke="none" />
      <path d="M29.5 16.2h6" />
      <path d="M13 42c.4-6.4 4.8-10 11-10s10.6 3.6 11 10" />
    </>
  ),
  baby: (
    <>
      <circle cx="24" cy="20" r="9" />
      <path d="M24 11c1.8-1.2 2-3 .4-4" />
      <circle cx="21" cy="19.5" r=".6" fill="currentColor" />
      <circle cx="27" cy="19.5" r=".6" fill="currentColor" />
      <path d="M21.5 23.5c1.6 1.2 3.4 1.2 5 0" />
      <path d="M15 42c.6-5 4.2-8 9-8s8.4 3 9 8" />
    </>
  ),
  family: (
    <>
      <circle cx="18" cy="14" r="5.5" />
      <path d="M8 38c0-7 4.4-11.5 10-11.5 3 0 5.4 1.2 7 3.2" />
      <circle cx="32.5" cy="22" r="4.2" />
      <path d="M25 40c.3-5 3.4-8 7.5-8s7.2 3 7.5 8" />
    </>
  ),
  bag: (
    <>
      <path d="M11 19h26l-2.2 21H13.2Z" />
      <path d="M18 19v-3a6 6 0 0 1 12 0v3" />
      <path d="M17 25h14" />
    </>
  ),
  shoe: (
    <>
      <path d="M7 34V23.5c3.6 1.4 7.2.4 10-3l4.6 4.4c4.4 4 10.6 5.2 16.8 5.6 2.2.2 3.6 1.6 3.6 3.5v1H7Z" />
      <path d="M7 34v4h35.6v-4M20 27l2.2-2M23.6 29.2l2.2-2" />
    </>
  ),
  hanger: (
    <>
      <path d="M21 12.5a3.2 3.2 0 1 1 3.2 3.2V19" />
      <path d="M24.2 19 40 30.2c1 .7.5 2.3-.7 2.3H8.7c-1.2 0-1.7-1.6-.7-2.3Z" />
    </>
  ),
};

export function SectionArt({ icon, className }: ArtProps & { icon: SectionIcon }) {
  return art(SECTION_ART[icon] ?? SECTION_ART.hanger, className);
}

type Garment = 'jeans' | 'shorts' | 'leggings' | 'tshirt' | 'shirt' | 'kurta' | 'saree' | 'lehenga' | 'dupatta' | 'skirt' | 'dress' | 'nightsuit' | 'top' | 'jacket' | 'hanger';

const GARMENT_ART: Record<Garment, React.ReactNode> = {
  jeans: (
    <>
      <path d="M14 7h20l2.4 34.5h-9.2L24 20l-3.2 21.5h-9.2Z" />
      <path d="M14.2 11.5h19.6M24 11.5V20M18 11.5c-.2 3 1 5 3.4 5.6M30 11.5c.2 3-1 5-3.4 5.6" />
    </>
  ),
  shorts: (
    <>
      <path d="M12.5 12h23l2.5 21h-10.5L24 23l-3.5 10H10Z" />
      <path d="M12.8 16h22.4M24 16v7" />
    </>
  ),
  leggings: (
    <>
      <path d="M17 7h14l-1 34.5h-4.5L24 17l-1.5 24.5H18Z" />
      <path d="M17.1 10.5h13.8" />
    </>
  ),
  tshirt: <path d="M17.5 8c1.6 2.8 3.8 4.2 6.5 4.2S28.9 10.8 30.5 8L41 13.5 37.4 21 33 18.8V41H15V18.8L10.6 21 7 13.5Z" />,
  shirt: (
    <>
      <path d="M16.5 8 8 13.5l3.2 8 3.8-2V41h18V19.5l3.8 2 3.2-8L31.5 8" />
      <path d="M16.5 8 20 14.5l4-4.3 4 4.3L31.5 8M24 10.2V41" />
      <circle cx="26.2" cy="20" r=".5" fill="currentColor" />
      <circle cx="26.2" cy="27" r=".5" fill="currentColor" />
      <circle cx="26.2" cy="34" r=".5" fill="currentColor" />
    </>
  ),
  kurta: (
    <>
      <path d="M17.5 7.5c1.6 2.4 3.8 3.6 6.5 3.6s4.9-1.2 6.5-3.6L39 12.5l-3 7.5-3.4-1.6.8 23.6H14.6l.8-23.6-3.4 1.6-3-7.5Z" />
      <path d="M24 11v7M15 33.5l2.6.5M33 33.5l-2.6.5" />
    </>
  ),
  saree: (
    <>
      <path d="M15.5 10c2.4-1.8 5.2-2.7 8.5-2.7s6.1.9 8.5 2.7L35 41.5H13Z" />
      <path d="M16 10.4 34 31.5M13.6 37.5h20.8" />
    </>
  ),
  lehenga: (
    <>
      <path d="M18.5 7h11l-1 8.5h-9Z" />
      <path d="M17.5 18.5h13L40.5 41.5h-33Z" />
      <path d="M11 36.5h26" />
      <circle cx="18" cy="31" r=".6" fill="currentColor" />
      <circle cx="24" cy="31" r=".6" fill="currentColor" />
      <circle cx="30" cy="31" r=".6" fill="currentColor" />
    </>
  ),
  dupatta: (
    <>
      <path d="M8 13c6-4.6 11.4-3.8 15 1.6s9 7.8 17-1.6v8.6c-8 9.4-13.4 7-17 1.6S14 15.2 8 21.6Z" />
      <path d="M8 21.6v4M10.5 19.6v4M40 21.6v4M37.5 23.6v4" />
    </>
  ),
  skirt: (
    <>
      <path d="M15.5 9h17v5h-17Z" />
      <path d="M15.5 14 9 40h30l-6.5-26" />
      <path d="M20 14l-2.6 26M28 14l2.6 26M24 14v26" />
    </>
  ),
  dress: (
    <>
      <path d="M19.5 6v4.5l-1.5 8M28.5 6v4.5l1.5 8" />
      <path d="M18.5 10.5h11l.8 8H17.7Z" />
      <path d="M17.7 18.5 10 41h28l-7.7-22.5" />
    </>
  ),
  nightsuit: (
    <>
      <path d="M17 7.5c1.5 2 4 3 7 3s5.5-1 7-3l8 5-2.8 6.5-3.2-1.5V26H15V17.5L11.8 19 9 12.5Z" />
      <path d="M16 28.5h16l1.2 13h-6.4L24 32.5l-2.8 9h-6.4Z" />
      <path d="M33 4.5a3 3 0 1 0 3 3.6 2.4 2.4 0 0 1-3-3.6Z" />
    </>
  ),
  top: (
    <>
      <path d="M18.5 7h2c.8 2.6 2 4 3.5 4s2.7-1.4 3.5-4h2l1 9.5c3 3.2 4.2 9 3.2 13.5H14.3c-1-4.5.2-10.3 3.2-13.5Z" />
      <path d="M14.5 30c3 2.6 6.2 3.8 9.5 3.8s6.5-1.2 9.5-3.8" />
    </>
  ),
  jacket: (
    <>
      <path d="M17 7.5 8.5 13l3 8 3.5-2v22h18V19l3.5 2 3-8L31 7.5" />
      <path d="M17 7.5 24 17l7-9.5M24 17v24M20 25h-3M31 25h-3" />
    </>
  ),
  hanger: SECTION_ART.hanger,
};

/** Which picture a type gets, from words in its name (any language the owner types falls back to a hanger). */
export function garmentFor(name: string): Garment {
  const n = name.toLowerCase();
  if (/legging|jegging/.test(n)) return 'leggings';
  if (/short/.test(n)) return 'shorts';
  if (/jean|denim|trouser|pant|chino/.test(n)) return 'jeans';
  if (/t-?\s?shirt|\btee/.test(n)) return 'tshirt';
  if (/night|pyjama|pajama/.test(n)) return 'nightsuit';
  if (/shirt/.test(n)) return 'shirt';
  if (/kurt|tunic/.test(n)) return 'kurta';
  if (/saree|sari\b/.test(n)) return 'saree';
  if (/lehenga|ghagra|lehnga/.test(n)) return 'lehenga';
  if (/dupatta|stole|scarf|chunni|shawl/.test(n)) return 'dupatta';
  if (/skirt/.test(n)) return 'skirt';
  if (/dress|gown|frock|maxi/.test(n)) return 'dress';
  if (/top|blouse|crop|cami/.test(n)) return 'top';
  if (/jacket|coat|blazer|hood|sweat/.test(n)) return 'jacket';
  return 'hanger';
}

export function TypeArt({ name, className }: ArtProps & { name: string }) {
  return art(GARMENT_ART[garmentFor(name)], className);
}
