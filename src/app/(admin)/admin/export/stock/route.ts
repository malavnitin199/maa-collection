import { STORE_ID } from '@/lib/app-config';
import { rupees, toCsv } from '@/lib/csv';
import { csvResponse, exportAllowed } from '@/server/export-auth';
import { requestDb } from '@/server/request-db';
import { listProducts } from '@/server/services/products';

/** Current stock of every product as CSV, with values at MRP and at purchase price. Owner only. */
export async function GET() {
  if (!(await exportAllowed())) return new Response('Owner only', { status: 403 });
  const items = await listProducts(await requestDb(), STORE_ID);
  const header = ['SKU', 'Barcode', 'Product', 'Brand', 'Category', 'Company', 'Size', 'Colour', 'MRP ₹', 'Selling ₹', 'Purchase ₹', 'Stock', 'Value at MRP ₹', 'Value at purchase ₹', 'Active'];
  const rows = items.map((p) => [
    p.sku, p.barcode, p.name, p.brand, p.category, p.supplierName ?? '', p.size, p.color,
    rupees(p.mrpPaise), rupees(p.pricePaise), rupees(p.costPaise), p.stock,
    rupees(p.stock * p.mrpPaise), p.costPaise === null ? '' : rupees(p.stock * p.costPaise), p.active ? 'Yes' : 'No',
  ]);
  return csvResponse(toCsv(header, rows), 'maa-collection-stock.csv');
}
