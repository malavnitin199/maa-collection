'use client';

import { DUMMY_CATALOG } from '@/features/catalog/dummy-catalog';
import { resetDemo, useInventory } from '@/features/inventory/dummy-store';
import { LOW_STOCK_THRESHOLD } from '@/features/inventory/inventory';
import { formatPaise } from '@/lib/money';

export function AdminDashboard() {
  const { stock, sales } = useInventory();

  const totalRevenuePaise = sales.reduce((sum, s) => sum + s.totalPaise, 0);
  const unitsSold = sales.reduce((sum, s) => sum + s.quantity, 0);

  const bySalesperson = new Map<string, { units: number; revenuePaise: number }>();
  for (const sale of sales) {
    const row = bySalesperson.get(sale.salesperson) ?? { units: 0, revenuePaise: 0 };
    row.units += sale.quantity;
    row.revenuePaise += sale.totalPaise;
    bySalesperson.set(sale.salesperson, row);
  }

  return (
    <main className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button
          type="button"
          onClick={resetDemo}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Reset demo data
        </button>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Total revenue</p>
          <p data-testid="total-revenue" className="mt-1 text-2xl font-semibold">
            {formatPaise(totalRevenuePaise)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Units sold</p>
          <p data-testid="units-sold" className="mt-1 text-2xl font-semibold">{unitsSold}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Bills</p>
          <p data-testid="sales-count" className="mt-1 text-2xl font-semibold">{sales.length}</p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Sales by salesperson
        </h2>
        {bySalesperson.size === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No sales recorded yet.</p>
        ) : (
          <table data-testid="sales-by-person" className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2 font-medium">Salesperson</th>
                <th className="py-2 font-medium">Units</th>
                <th className="py-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[...bySalesperson.entries()].map(([name, row]) => (
                <tr key={name} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2">{name}</td>
                  <td className="py-2">{row.units}</td>
                  <td className="py-2 text-right">{formatPaise(row.revenuePaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Inventory
        </h2>
        <table data-testid="inventory-table" className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="py-2 font-medium">SKU</th>
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 font-medium">MRP</th>
              <th className="py-2 text-right font-medium">Stock</th>
            </tr>
          </thead>
          <tbody>
            {DUMMY_CATALOG.map((item) => {
              const available = stock[item.sku] ?? 0;
              return (
                <tr key={item.sku} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 font-mono text-xs">{item.sku}</td>
                  <td className="py-2">
                    {item.design} · {item.size} · {item.color}
                  </td>
                  <td className="py-2">{formatPaise(item.mrpPaise)}</td>
                  <td className="py-2 text-right">
                    <span
                      className={
                        available <= 0
                          ? 'font-semibold text-red-600 dark:text-red-400'
                          : available <= LOW_STOCK_THRESHOLD
                            ? 'font-semibold text-amber-600 dark:text-amber-400'
                            : ''
                      }
                    >
                      {available}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Recent sales
        </h2>
        {sales.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nothing sold yet. Open the POS as Salesman and scan an item.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {sales.slice(0, 10).map((sale) => (
              <li
                key={sale.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <span>
                  {new Date(sale.at).toLocaleTimeString()} — {sale.quantity} × {sale.design} (
                  {sale.size}, {sale.color}) — {sale.salesperson}
                </span>
                <span className="font-medium">{formatPaise(sale.totalPaise)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
