/**
 * Small pictures for empty moments (UI clean-up, v15): drawn here, in the
 * theme's colours (`currentColor` = the brand dye, `--zari` = its accent), so
 * they follow every theme and day/night. Decorative only: the text next to
 * them says what to do. Motion lives in globals.css (`art-*`) and stops when
 * the phone asks for reduced motion.
 */
type ArtProps = { className?: string };

function Sparkle({ x, y, size = 4 }: { x: number; y: number; size?: number }) {
  const s = size;
  return <path className="art-twinkle" d={`M${x} ${y - s}L${x + s * 0.3} ${y - s * 0.3}L${x + s} ${y}L${x + s * 0.3} ${y + s * 0.3}L${x} ${y + s}L${x - s * 0.3} ${y + s * 0.3}L${x - s} ${y}L${x - s * 0.3} ${y - s * 0.3}Z`} fill="var(--zari)" />;
}

/** A hang tag swinging on its thread, a scan line sweeping over its barcode. */
export function ScanTagArt({ className }: ArtProps) {
  const bars = [0, 3, 5, 9, 11, 14, 18, 20, 23, 27, 29, 32, 35];
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" focusable="false" className={className} fill="none">
      <path d="M48 0v14" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" strokeLinecap="round" />
      <g className="art-swing">
        <path d="M34 14h28l12 12v52a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6V26z" fill="white" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="48" cy="24" r="3.2" stroke="currentColor" strokeWidth="2" />
        <rect x="30" y="33" width="15" height="11" rx="2" fill="currentColor" fillOpacity="0.16" />
        <rect x="50" y="35" width="16" height="2.5" rx="1.25" fill="currentColor" fillOpacity="0.35" />
        <rect x="50" y="40" width="11" height="2.5" rx="1.25" fill="currentColor" fillOpacity="0.25" />
        {bars.map((x, i) => (
          <rect key={x} x={30 + x} y="52" width={i % 3 === 0 ? 2.4 : 1.4} height="20" fill="currentColor" />
        ))}
        <rect className="art-scan" x="25" y="46" width="46" height="2.5" rx="1.25" fill="var(--zari)" />
      </g>
      <Sparkle x={14} y={32} />
      <Sparkle x={83} y={44} size={3} />
      <Sparkle x={80} y={82} size={3.5} />
    </svg>
  );
}

/** A kurta on a hanger, swaying a little: the photo box of a new item before a photo is chosen. */
export function GarmentArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" focusable="false" className={className} fill="none">
      <g className="art-swing">
        <path d="M43 12a5 5 0 1 1 5 5c-1.8 0-3 1.2-3 3v3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M48 23 21 37h54z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <path
          d="M31 37 18 47l6 8 8-5v38h32V50l8 5 6-8-13-10c-4 3.5-9 5-17 5s-13-1.5-17-5z"
          fill="white"
          fillOpacity="0.85"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M48 42v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="48" cy="60" r="1.6" fill="var(--zari)" />
        <circle cx="48" cy="66" r="1.6" fill="var(--zari)" />
        <path d="M32 80h32" stroke="var(--zari)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 4" />
      </g>
      <Sparkle x={16} y={30} />
      <Sparkle x={82} y={26} size={3} />
    </svg>
  );
}

/** A tick in a ring that pops in, with a little twinkle: nothing left to do. */
export function AllDoneArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" focusable="false" className={className} fill="none">
      <g className="art-pop">
        <circle cx="48" cy="50" r="30" fill="currentColor" fillOpacity="0.12" />
        <circle cx="48" cy="50" r="30" stroke="currentColor" strokeWidth="3" />
        <path d="M35 51l9 9 18-20" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <Sparkle x={16} y={22} />
      <Sparkle x={82} y={24} size={3} />
      <Sparkle x={84} y={78} size={3.5} />
    </svg>
  );
}
