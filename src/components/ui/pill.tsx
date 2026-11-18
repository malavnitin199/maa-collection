/**
 * A small tag on an item's header (plan v17): size, category, who it is for.
 * `strong` = the theme's dye (who it is for); default = soft grey-dyed.
 */
export function Pill({ children, strong = false, testId }: { children: React.ReactNode; strong?: boolean; testId?: string }) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        strong ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-800 ring-1 ring-brand-100 dark:bg-brand-950 dark:text-brand-200 dark:ring-brand-900'
      }`}
    >
      {children}
    </span>
  );
}
