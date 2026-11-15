/** Re-mounts on every navigation, so each page slides in gently (reduced motion: no movement). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
