import { Suspense } from 'react';
import { card, muted, sectionTitle } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { AddStaffForm, ResetPinForm, ToggleActiveForm } from '@/features/catalog/small-forms';
import { STORE_ID } from '@/lib/app-config';
import { createStaffAction, resetPinAction, setStaffActiveAction } from '@/server/actions/admin';
import { requireAdmin } from '@/server/auth';
import { listStaff } from '@/server/services/staff';

async function StaffList() {
  const me = await requireAdmin();
  const people = await listStaff(await requestDb(), STORE_ID);
  return (
    <ul data-testid="staff-list" className="flex flex-col gap-2">
      {people.map((person) => (
        <li key={person.id} className={`${card} flex flex-wrap items-center justify-between gap-3 py-3`}>
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
        </li>
      ))}
    </ul>
  );
}

export default function StaffPage() {
  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Staff</h1>
        <p className={`text-sm ${muted}`}>
          Everyone logs in with their name and PIN. Salesmen can sell, exchange, credit a sale to a colleague, and see
          their own sales. Admins can do everything.
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
