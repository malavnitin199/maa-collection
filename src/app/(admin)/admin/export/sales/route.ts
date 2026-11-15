import { STORE_ID } from '@/lib/app-config';
import { rupees, toCsv } from '@/lib/csv';
import { csvResponse, exportAllowed } from '@/server/export-auth';
import { requestDb } from '@/server/request-db';
import { REPORT_PERIODS, salesExportRows, type ReportPeriod } from '@/server/services/reports';

const stamp = new Intl.DateTimeFormat('en-IN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Kolkata', hour12: false });

/** Sales + exchanges for a period as CSV (opens in Excel / Google Sheets). Owner only. */
export async function GET(request: Request) {
  if (!(await exportAllowed())) return new Response('Owner only', { status: 403 });
  const param = new URL(request.url).searchParams.get('period');
  const period: ReportPeriod = REPORT_PERIODS.some((p) => p.value === param) ? (param as ReportPeriod) : 'month';
  const { saleRows, exchangeRows } = await salesExportRows(await requestDb(), STORE_ID, period);
  const header = ['Type', 'Date & time (IST)', 'SKU', 'Product', 'Size', 'Colour', 'Category', 'Company', 'Qty', 'Unit price ₹', 'Amount ₹', 'MRP ₹', 'Purchase ₹', 'Profit ₹', 'Credited to', 'Recorded by'];
  const rows = [
    ...saleRows.map((s) => [
      'Sale', stamp.format(s.at), s.sku, s.name, s.size, s.color, s.category, s.company ?? '', s.quantity,
      rupees(s.unitPricePaise), rupees(s.totalPaise), rupees(s.mrpPaise), rupees(s.costPaise),
      s.costPaise === null ? '' : rupees(s.quantity * (s.unitPricePaise - s.costPaise)), s.creditedTo, s.recordedBy,
    ]),
    ...exchangeRows.map((e) => [
      'Exchange', stamp.format(e.at), e.issuedSku, `Returned ${e.returnedQuantity} × ${e.returnedName} → ${e.issuedQuantity} × ${e.issuedName}`,
      '', '', '', '', e.issuedQuantity, '', rupees(e.differencePaise), '', '', '', e.creditedTo, e.recordedBy,
    ]),
  ];
  return csvResponse(toCsv(header, rows), `maa-collection-sales-${period}.csv`);
}
