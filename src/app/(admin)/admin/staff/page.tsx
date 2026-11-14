import { Suspense } from 'react';
import { card, muted, sectionTitle } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { AddStaffForm, PermissionsForm, ResetPinForm, ToggleActiveForm } from '@/features/catalog/small-forms';
import { PERMISSION_INFO, PERMISSIONS } from '@/lib/permissions';
import { STORE_ID } from '@/lib/app-config';
import { createStaffAction, resetPinAction, setStaffActiveAction, setStaffPermissionsAction } from '@/server/actions/admin';
import { requireAdmin } from '@/server/auth';
import { listStaff } from '@/server/services/staff';

async function StaffList() {
  const me = await requireAdmin();
  const people = await listStaff(await requestDb(), STORE_ID);
  return (
    <ul data-testid="staff-list" className="flex flex-col gap-2">
      {people.map((person) => (
        <li key={person.id} className={`${card} flex flex-col gap-3 py-3`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-medium">
            {person.name}
            <span className={`ml-2 text-xs font-normal ${muted}`}>
              {person.role === 'admin' ? 'Admin' : 'Salesman'}
              {!person.active && ' · inactive'}
              {person.id === me.id && ' · you'}
            </span>
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <ResetPinForm action={resetPinAction.bind(null, person.id)} name={person.name} />
            {person.id !== me.id && (
              <ToggleActiveForm action={setStaffActiveAction.bind(null, person.id, !person.active)} active={person.active} />
            )}
          </div>
          </div>
          {person.role === 'salesman' ? (
            <details>
              <summary className="cursor-pointer text-sm text-emerald-700 dark:text-emerald-400">
                Permissions: {person.permissions.length ? person.permissions.map((p) => PERMISSION_INFO[p as keyof typeof PERMISSION_INFO]?.label ?? p).join(', ') : 'counter only'}
              </summary>
              <div className="mt-2">
                <PermissionsForm
                  action={setStaffPermissionsAction.bind(null, person.id)}
                  granted={person.permissions}
                  name={person.name}
                  options={PERMISSIONS.map((p) => ({ value: p, ...PERMISSION_INFO[p] }))}
                />
              </div>
            </details>
          ) : (
            <p className="text-xs text-zinc-500">Admin: can do everything.</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function StaffPage() {
  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Staff & permissions</h1>
        <p className={`text-sm ${muted}`}>
          Everyone logs in with their name and PIN. Salesmen can sell, exchange, credit a sale to a colleague, and see
          their own sales. Give a salesman extra rights below to make them a catalog / QC or stock person. Admins can do
          everything.
        </p>
      </div>
      <section className={`${card} flex flex-col gap-3`}>
        <h2 className={sectionTitle}>Add a person</h2>
        <AddStaffForm action={createStaffAction} />
      </section>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading staff…</p>}>
        <StaffList />
      </Suspense>
    </main>
  );
}
