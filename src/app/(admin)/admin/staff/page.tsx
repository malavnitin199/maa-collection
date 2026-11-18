import { Suspense } from 'react';
import { Pill } from '@/components/ui/pill';
import { card, muted, sectionTitle } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { AddStaffForm, PermissionsForm, ResetPinForm, ToggleActiveForm } from '@/features/catalog/small-forms';
import { PERMISSIONS, type Permission } from '@/lib/permissions';
import { STORE_ID } from '@/lib/app-config';
import type { MessageKey } from '@/lib/i18n';
import { createStaffAction, resetPinAction, setStaffActiveAction, setStaffPermissionsAction } from '@/server/actions/admin';
import { requireAdmin } from '@/server/auth';
import { getT } from '@/server/i18n';
import { listStaff } from '@/server/services/staff';

/** PERMISSION_INFO (src/lib/permissions.ts) in the reader's language; the English is the same. */
const PERMISSION_KEYS: Record<Permission, { label: MessageKey; description: MessageKey }> = {
  catalog: { label: 'own.perm.catalog', description: 'own.perm.catalog.desc' },
  prices: { label: 'own.perm.prices', description: 'own.perm.prices.desc' },
  stock: { label: 'own.perm.stock', description: 'own.perm.stock.desc' },
  costs: { label: 'own.perm.costs', description: 'own.perm.costs.desc' },
};
const isPermission = (value: string): value is Permission => (PERMISSIONS as readonly string[]).includes(value);

/**
 * Staff (plan v17): add a person, change a PIN, give a salesman extra rights,
 * remove someone (they can't log in; history stays) or bring them back.
 */
async function StaffList() {
  const me = await requireAdmin();
  const t = await getT();
  const people = await listStaff(await requestDb(), STORE_ID);
  const current = people.filter((p) => p.active);
  const removed = people.filter((p) => !p.active);
  return (
    <>
      <section className={`${card} flex flex-col gap-3`}>
        <h2 className={sectionTitle}>{t('own.staff.add')}</h2>
        <AddStaffForm action={createStaffAction} />
      </section>

      <ul data-testid="staff-list" className="flex flex-col gap-2">
        {current.map((person) => (
          <li key={person.id} className={`${card} flex flex-col gap-3 py-3`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {person.name}
                <Pill strong={person.role === 'admin'}>{person.role === 'admin' ? t('role.admin') : t('role.salesman')}</Pill>
                {person.id === me.id && <span className={`text-xs font-normal ${muted}`}>{t('own.staff.you')}</span>}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <ResetPinForm action={resetPinAction.bind(null, person.id)} name={person.name} />
                {person.id !== me.id && <ToggleActiveForm action={setStaffActiveAction.bind(null, person.id, false)} active name={person.name} />}
              </div>
            </div>
            {person.role === 'salesman' ? (
              <details>
                <summary className="cursor-pointer text-sm text-brand-700 dark:text-brand-400">
                  {t('own.staff.permissions', {
                    list: person.permissions.length
                      ? person.permissions.map((p) => (isPermission(p) ? t(PERMISSION_KEYS[p].label) : p)).join(', ')
                      : t('own.staff.counterOnly'),
                  })}
                </summary>
                <div className="mt-2">
                  <PermissionsForm
                    action={setStaffPermissionsAction.bind(null, person.id)}
                    granted={person.permissions}
                    name={person.name}
                    options={PERMISSIONS.map((p) => ({ value: p, label: t(PERMISSION_KEYS[p].label), description: t(PERMISSION_KEYS[p].description) }))}
                  />
                </div>
              </details>
            ) : (
              <p className="text-xs text-zinc-500">{t('own.staff.adminAll')}</p>
            )}
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('cat.staff.removed')}</h2>
        {removed.length === 0 ? (
          <p className={`text-sm ${muted}`}>{t('cat.staff.removedNone')}</p>
        ) : (
          <ul data-testid="removed-staff" className="flex flex-col gap-2">
            {removed.map((person) => (
              <li key={person.id} className={`${card} flex flex-wrap items-center justify-between gap-3 py-3 opacity-80`}>
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {person.name}
                  <Pill>{person.role === 'admin' ? t('role.admin') : t('role.salesman')}</Pill>
                </span>
                <ToggleActiveForm action={setStaffActiveAction.bind(null, person.id, true)} active={false} name={person.name} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default async function StaffPage() {
  const t = await getT();
  return (
    <main className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">{t('own.staff.title')}</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('login.loading')}</p>}>
        <StaffList />
      </Suspense>
    </main>
  );
}
