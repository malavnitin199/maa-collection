import Link from 'next/link';

/**
 * A big action shaped like the shop's hang tag: notched top corners, a punch
 * hole and a loop of zari thread. Used for the main actions only (Home quick
 * actions, the Stock hub), so the shape keeps its meaning.
 */
export function TagTile({
  href,
  title,
  hint,
  icon,
  primary = false,
}: {
  href: string;
  title: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  /** The main action: filled with the theme's dye. */
  primary?: boolean;
}) {
  return (
    // The drop shadow sits on the wrapper so it follows the cut tag shape.
    <div className="group relative pt-2 [filter:drop-shadow(0_1px_0.5px_rgb(0_0_0/0.10))_drop-shadow(0_8px_14px_rgb(0_0_0/0.07))] dark:[filter:drop-shadow(0_0_0.6px_rgb(255_255_255/0.35))]">
      {/* Thread loop above the hole. */}
      <svg aria-hidden viewBox="0 0 24 14" className="absolute top-0 left-1/2 z-10 h-3.5 w-6 -translate-x-1/2 text-zari" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
        <path d="M12 13C12 6 6 2 3 4M12 13c0-7 6-11 9-9" />
      </svg>
      <Link
        href={href}
        className={`tag-shape relative flex h-full flex-col gap-1 px-4 pt-7 pb-4 transition duration-200 group-hover:-translate-y-0.5 active:scale-[0.98] ${
          primary ? 'bg-brand-600 text-white' : 'bg-surface text-zinc-900 dark:text-zinc-100'
        }`}
      >
        {/* Punch hole. */}
        <span aria-hidden className={`absolute top-3 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[var(--background)] ring-2 ${primary ? 'ring-white/40' : 'ring-brand-200 dark:ring-zinc-700'}`} />
        {icon && <span className={primary ? 'text-white/90' : 'text-brand-600 dark:text-brand-300'}>{icon}</span>}
        <span className="text-base leading-snug font-bold">{title}</span>
        {hint && <span className={`text-sm leading-snug ${primary ? 'text-white/80' : 'text-zinc-500 dark:text-zinc-400'}`}>{hint}</span>}
      </Link>
    </div>
  );
}
