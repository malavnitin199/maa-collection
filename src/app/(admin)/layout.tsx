import { RoleHeader } from '@/components/layout/role-header';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <RoleHeader
        role="Admin"
        links={[
          { href: '/admin/dashboard', label: 'Dashboard' },
          { href: '/admin/labels', label: 'Labels' },
        ]}
      />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</div>
    </div>
  );
}
