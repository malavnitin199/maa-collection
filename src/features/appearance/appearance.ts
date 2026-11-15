/**
 * Theme (colour) and day/night mode, chosen per phone (plan v8). Stored in
 * localStorage; applied as data-theme / data-mode on <html> before the first
 * paint by APPEARANCE_SCRIPT, so there is no flash of the wrong colours.
 */
export const THEMES = ['peacock', 'marigold', 'rani', 'neel', 'mehendi'] as const;
export type Theme = (typeof THEMES)[number];
export const MODES = ['light', 'dark', 'system'] as const;
export type Mode = (typeof MODES)[number];

export const THEME_KEY = 'maa-theme';
export const MODE_KEY = 'maa-mode';
export const DEFAULT_THEME: Theme = 'peacock';

/** Swatch colours for the picker (main colour + zari accent), same as globals.css. */
export const THEME_SWATCH: Record<Theme, { main: string; accent: string }> = {
  peacock: { main: '#0f766e', accent: '#d4a017' },
  marigold: { main: '#c2410c', accent: '#7a1f2b' },
  rani: { main: '#be185d', accent: '#e0a800' },
  neel: { main: '#4f46e5', accent: '#eab308' },
  mehendi: { main: '#5c6c1d', accent: '#c2562f' },
};

export const isTheme = (v: unknown): v is Theme => typeof v === 'string' && (THEMES as readonly string[]).includes(v);
export const isMode = (v: unknown): v is Mode => typeof v === 'string' && (MODES as readonly string[]).includes(v);

/** Runs in <head> before anything paints. Plain ES5, wrapped in try: never breaks the page. */
export const APPEARANCE_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('${THEME_KEY}');var m=localStorage.getItem('${MODE_KEY}')||'system';if(${JSON.stringify(THEMES)}.indexOf(t)<0)t='${DEFAULT_THEME}';var dark=m==='dark'||(m!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);d.setAttribute('data-theme',t);d.setAttribute('data-mode',dark?'dark':'light');}catch(e){}})();`;

export function readAppearance(): { theme: Theme; mode: Mode } {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    const mode = localStorage.getItem(MODE_KEY);
    return { theme: isTheme(theme) ? theme : DEFAULT_THEME, mode: isMode(mode) ? mode : 'system' };
  } catch {
    return { theme: DEFAULT_THEME, mode: 'system' };
  }
}

/** Applies a choice now and remembers it on this phone. */
export function applyAppearance(next: { theme: Theme; mode: Mode }): void {
  try {
    localStorage.setItem(THEME_KEY, next.theme);
    localStorage.setItem(MODE_KEY, next.mode);
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
  const root = document.documentElement;
  const dark = next.mode === 'dark' || (next.mode === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-theme', next.theme);
  root.setAttribute('data-mode', dark ? 'dark' : 'light');
  window.dispatchEvent(new Event('maa-appearance-change'));
}
