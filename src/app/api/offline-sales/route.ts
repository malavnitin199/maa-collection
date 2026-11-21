import { z } from 'zod';
import { STORE_ID } from '@/lib/app-config';
import { getCurrentStaff } from '@/server/auth';
import { errorText, getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { statusesForSales } from '@/server/services/approvals';
import { DomainError } from '@/server/services/errors';
import { MANUAL_NAME_MAX, MANUAL_SIZE_MAX, recordSale } from '@/server/services/sales';

const offlineSaleSchema = z.object({
  operationId: z.string().min(8).max(100),
  productId: z.uuid().optional(),
  manual: z.object({ name: z.string().max(MANUAL_NAME_MAX), size: z.string().max(MANUAL_SIZE_MAX).optional() }).optional(),
  quantity: z.number().int(),
  unitPricePaise: z.number().int(),
  /** Whole boxes at a box price (ADR-047). */
  totalPaise: z.number().int().positive().optional(),
  soldBy: z.uuid(),
  /** Who made it on the phone: must be the person logged in now. */
  recordedBy: z.uuid(),
  /** Phone time when it was made. */
  madeAt: z.iso.datetime({ offset: true }),
  /** Scanned item: the MRP the phone showed. */
  mrpPaise: z.number().int().positive().optional(),
});

export type OfflineSaleBody = z.input<typeof offlineSaleSchema>;

function reply(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Plan v18: a sale that waited on the phone while there was no internet. Same
 * rules as the counter (`recordSale`, retry-safe by `operationId`) with the
 * offline exceptions the owner chose: it is recorded even if the stock goes
 * below zero. Only the person who made it can send it, so the credit and
 * "entered by" stay true.
 */
export async function POST(request: Request) {
  // Only the app itself sends these (a JSON body from the same site).
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return reply(403, { ok: false, code: 'origin' });
  if (!request.headers.get('content-type')?.includes('application/json')) return reply(415, { ok: false, code: 'type' });

  const me = await getCurrentStaff();
  if (!me) return reply(401, { ok: false, code: 'login' });
  const t = await getT();
  let body: z.output<typeof offlineSaleSchema>;
  try {
    body = offlineSaleSchema.parse(await request.json());
  } catch {
    return reply(400, { ok: false, code: 'invalid', error: t('error.invalid') });
  }
  if (body.recordedBy !== me.id) return reply(403, { ok: false, code: 'someone-else' });

  try {
    const db = await requestDb();
    const { madeAt, mrpPaise, ...sale } = body;
    const result = await recordSale(db, STORE_ID, { ...sale, recordedBy: me.id, offline: { at: new Date(madeAt), mrpPaise } });
    const status = (await statusesForSales(db, [result.sale.id])).get(result.sale.id) ?? 'waiting';
    return reply(200, { ok: true, duplicate: result.duplicate, status, stockLeft: result.stockLeft });
  } catch (error) {
    if (error instanceof DomainError) return reply(422, { ok: false, code: 'refused', error: errorText(error, t) });
    console.error(error);
    return reply(500, { ok: false, code: 'server' });
  }
}
