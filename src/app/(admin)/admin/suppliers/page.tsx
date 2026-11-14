import Link from 'next/link';
import { Suspense } from 'react';
import { card, muted, sectionTitle } from '@/components/ui/styles';
import { SupplierForm } from '@/features/catalog/setup-forms';
import { STORE_ID } from '@/lib/app-config';
import { createSupplierAction } from '@/server/actions/admin';
import { requireAdmin } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { listSuppliers } from '@/server/services/catalog';

const date = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });

async function SupplierList() {
  await requireAdmin();
  const rows = await listSuppliers(await requestDb(), STORE_ID);
  if (rows.length === 0) {
    return <p className={`text-sm ${muted}`}>No suppliers yet. Add the first company you buy from above.</p>;
  }
  return (
    <ul data-testid="supplier-list" className="flex flex-col gap-2">
      {rows.map((s) => (
        <li key={s.id}>
          <Link href={`/admin/suppliers/${s.id}`} className={`${card} flex items-center justify-between gap-3 active:bg-zinc-50 dark:active:bg-zinc-900`}>
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {s.name}
                {!s.active && <span className={`ml-1 text-xs font-normal ${muted}`}>(inactive)</span>}
              </span>
              <span className={`block text-xs ${muted}`}>
                {[s.contactName, s.phone].filter(Boolean).join(' · ') || 'No contact saved'}
              </span>
              <span className={`block text-xs ${muted}`}>
                {s.productCount} products · {s.stockUnits} pcs in stock
                {s.lastReceiptAt && ` · last delivery ${date.format(s.lastReceiptAt)}`}
              </span>
            </span>
            <span aria-hidden className={muted}>
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function SuppliersPage() {
  return (
    <main className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <p className={`text-sm ${muted}`}>Companies you buy stock from.</p>
      </div>
      <details className={card}>
        <summary className="cursor-pointer font-medium text-emerald-700 dark:text-emerald-400">+ Add supplier</summary>
        <div className="mt-3">
          <SupplierForm action={createSupplierAction} submitLabel="Add supplier" />
        </div>
      </details>
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>All suppliers</h2>
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
          <SupplierList />
        </Suspense>
      </section>
    </main>
  );
}
