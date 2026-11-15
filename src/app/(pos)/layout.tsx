import { RoleHeader } from '@/components/layout/role-header';

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <RoleHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-32 sm:pb-10">{children}</div>
    </div>
  );
}
