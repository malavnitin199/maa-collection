import { ImageResponse } from 'next/og';

export const BRAND_GREEN = '#047857';

/**
 * App icon: white "MC" on brand green, full-bleed so Android can mask it
 * (circle, squircle) without cutting the letters (kept in the middle 60%).
 */
export function appIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BRAND_GREEN,
          color: 'white',
          fontSize: size * 0.34,
          fontWeight: 700,
          letterSpacing: -size * 0.01,
          fontFamily: 'sans-serif',
        }}
      >
        MC
      </div>
    ),
    { width: size, height: size },
  );
}
