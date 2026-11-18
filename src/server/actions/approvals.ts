'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { STORE_ID } from '@/lib/app-config';
import { requireAdmin } from '@/server/auth';
import { errorText, getT } from '@/server/i18n';
import {
  approveAll,
  approveExchange,
  approveSale,
  rejectExchange,
  rejectSale,
  REJECT_REASONS,
  type DecisionResult,
} from '@/server/services/approvals';
import { DomainError } from '@/server/services/errors';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Runs an owner decision; errors come back in the owner's language. */
async function run<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await work();
    // Totals everywhere change with a decision: Home, Reports, Sales team, My sales.
    revalidatePath('/', 'layout');
    return { ok: true, data };
  } catch (error) {
    const t = await getT();
    if (error instanceof DomainError) return { ok: false, error: errorText(error, t) };
    if (error instanceof z.ZodError) return { ok: false, error: t('error.invalid') };
    console.error(error);
    return { ok: false, error: t('error.generic') };
  }
}

const id = z.uuid();
const rejectSchema = z.object({ id: z.uuid(), reason: z.enum(REJECT_REASONS), note: z.string().max(200).optional() });

export async function approveSaleAction(saleId: string): Promise<ActionResult<DecisionResult>> {
  const me = await requireAdmin();
  return run(async () => approveSale(await getDb(), STORE_ID, { saleId: id.parse(saleId), decidedBy: me.id }));
}

export async function rejectSaleAction(input: z.input<typeof rejectSchema>): Promise<ActionResult<DecisionResult>> {
  const me = await requireAdmin();
  return run(async () => {
    const data = rejectSchema.parse(input);
    return rejectSale(await getDb(), STORE_ID, { saleId: data.id, reason: data.reason, note: data.note, decidedBy: me.id });
  });
}

export async function approveExchangeAction(exchangeId: string): Promise<ActionResult<DecisionResult>> {
  const me = await requireAdmin();
  return run(async () => approveExchange(await getDb(), STORE_ID, { exchangeId: id.parse(exchangeId), decidedBy: me.id }));
}

export async function rejectExchangeAction(input: z.input<typeof rejectSchema>): Promise<ActionResult<DecisionResult>> {
  const me = await requireAdmin();
  return run(async () => {
    const data = rejectSchema.parse(input);
    return rejectExchange(await getDb(), STORE_ID, { exchangeId: data.id, reason: data.reason, note: data.note, decidedBy: me.id });
  });
}

const approveAllSchema = z.object({ batchId: z.string().min(8).max(100), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

/** Approve everything still waiting — one shop day, or all of it. Retrying the same batch approves nothing extra. */
export async function approveAllAction(input: z.input<typeof approveAllSchema>): Promise<ActionResult<{ sales: number; exchanges: number; total: number }>> {
  const me = await requireAdmin();
  return run(async () => {
    const data = approveAllSchema.parse(input);
    return approveAll(await getDb(), STORE_ID, { decidedBy: me.id, batchId: data.batchId, range: data.day ? { day: data.day } : undefined });
  });
}

const selectedSchema = z.object({
  items: z.array(z.object({ kind: z.enum(['sale', 'exchange']), id: z.uuid() })).min(1).max(200),
  decision: z.enum(['approve', 'reject']),
  reason: z.enum(REJECT_REASONS).optional(),
  note: z.string().max(200).optional(),
});

export type SelectedResult = { approved: number; rejected: number; stockReturned: number; already: number; failed: string[] };

/**
 * Approvals → Select (plan v17): approve or reject just the chosen entries.
 * Each one is its own decision (made once; a second tap changes nothing).
 * Rejecting does exchanges first, so a sale whose exchange is also chosen can follow.
 */
export async function decideSelectedAction(input: z.input<typeof selectedSchema>): Promise<ActionResult<SelectedResult>> {
  const me = await requireAdmin();
  return run(async () => {
    const data = selectedSchema.parse(input);
    if (data.decision === 'reject' && !data.reason) throw new DomainError('Choose a reason.', { key: 'appr.err.reason' });
    const db = await getDb();
    const t = await getT();
    const order = data.decision === 'reject' ? [...data.items].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'exchange' ? -1 : 1)) : data.items;
    const result: SelectedResult = { approved: 0, rejected: 0, stockReturned: 0, already: 0, failed: [] };
    for (const item of order) {
      try {
        const decided =
          data.decision === 'approve'
            ? item.kind === 'sale'
              ? await approveSale(db, STORE_ID, { saleId: item.id, decidedBy: me.id })
              : await approveExchange(db, STORE_ID, { exchangeId: item.id, decidedBy: me.id })
            : item.kind === 'sale'
              ? await rejectSale(db, STORE_ID, { saleId: item.id, reason: data.reason!, note: data.note, decidedBy: me.id })
              : await rejectExchange(db, STORE_ID, { exchangeId: item.id, reason: data.reason!, note: data.note, decidedBy: me.id });
        if (!decided.changed) result.already++;
        else if (decided.status === 'approved') result.approved++;
        else {
          result.rejected++;
          result.stockReturned += decided.stockReturned ?? 0;
        }
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        result.failed.push(errorText(error, t));
      }
    }
    return result;
  });
}
