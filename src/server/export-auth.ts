import { getCurrentStaff } from '@/server/auth';

/** Exports include purchase prices and profit: owner (admin) only. */
export async function exportAllowed(): Promise<boolean> {
  const me = await getCurrentStaff();
  return me?.role === 'admin';
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
