import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core';
import type { Db } from '@/db/client';
import { approvalDecisions, exchanges, products, sales, staff, stockMovements } from '@/db/schema';
import { STORE_TIMEZONE } from '@/lib/app-config';
import { DomainError, isUniqueViolation } from './errors';

/*
 * Owner approval of what the counter records (plan v12).
 *
 * A sale or exchange is written once and never edited. Whether it counts is
 * decided by one row in `approval_decisions`: no row = waiting for the owner,
 * one row = approved or rejected. A unique index allows at most one decision
 * per sale / exchange, so a double tap, "Approve all" and a single approve
 * racing each other can never decide (or reverse stock) twice.
 */

export type ApprovalStatus = 'waiting' | 'approved' | 'rejected';
export const REJECT_REASONS = ['wrong_price', 'wrong_item', 'duplicate', 'not_sold', 'other'] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

/** SQL: this sale is approved. The one predicate every report uses. */
export const saleApproved = sql`exists (select 1 from ${approvalDecisions} d where d.sale_id = ${sales.id} and d.decision = 'approved')`;
/** SQL: this sale has no decision yet. */
export const saleWaiting = sql`not exists (select 1 from ${approvalDecisions} d where d.sale_id = ${sales.id})`;
export const exchangeApproved = sql`exists (select 1 from ${approvalDecisions} d where d.exchange_id = ${exchanges.id} and d.decision = 'approved')`;
export const exchangeWaiting = sql`not exists (select 1 from ${approvalDecisions} d where d.exchange_id = ${exchanges.id})`;
/** SQL: the owner rejected this sale (its pieces are back in stock). */
export const saleRejected = sql`exists (select 1 from ${approvalDecisions} d where d.sale_id = ${sales.id} and d.decision = 'rejected')`;
/** SQL: this sale's status for a list row. */
export const saleStatus = sql<ApprovalStatus>`coalesce((select d.decision from ${approvalDecisions} d where d.sale_id = ${sales.id}), 'waiting')`;
export const exchangeStatus = sql<ApprovalStatus>`coalesce((select d.decision from ${approvalDecisions} d where d.exchange_id = ${exchanges.id}), 'waiting')`;

/** Only the owner decides. */
export async function assertOwner(db: Db, storeId: string, staffId: string) {
  const [person] = await db
    .select({ role: staff.role })
    .from(staff)
    .where(and(eq(staff.storeId, storeId), eq(staff.id, staffId), eq(staff.active, true)))
    .limit(1);
  if (!person || person.role !== 'admin') throw new DomainError('Only the owner can approve sales.', { key: 'appr.err.ownerOnly' });
}

/** True when this person's own entries are approved as they are recorded (the owner's are). */
export async function isOwner(db: Db, storeId: string, staffId: string): Promise<boolean> {
  const [person] = await db
    .select({ role: staff.role })
    .from(staff)
    .where(and(eq(staff.storeId, storeId), eq(staff.id, staffId)))
    .limit(1);
  return person?.role === 'admin';
}

type DecisionInput = {
  storeId: string;
  saleId?: string;
  exchangeId?: string;
  decision: 'approved' | 'rejected';
  reason?: RejectReason | null;
  note?: string | null;
  decidedBy: string;
  auto?: boolean;
  batchId?: string | null;
};

/**
 * Writes the one decision row. Returns false when a decision already existed
 * (another tap, another phone), so the caller does nothing else — this is what
 * keeps stock from being returned twice.
 */
async function insertDecision(tx: Db, input: DecisionInput): Promise<boolean> {
  const rows = await tx
    .insert(approvalDecisions)
    .values({
      storeId: input.storeId,
      saleId: input.saleId ?? null,
      exchangeId: input.exchangeId ?? null,
      decision: input.decision,
      reason: input.reason ?? null,
      note: input.note?.trim().slice(0, 200) || null,
      decidedBy: input.decidedBy,
      auto: input.auto ?? false,
      batchId: input.batchId ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: approvalDecisions.id });
  return rows.length > 0;
}

/** Approve the owner's own entry as it is recorded (inside the sale's transaction). */
export async function autoApproveOwnEntry(tx: Db, input: { storeId: string; saleId?: string; exchangeId?: string; decidedBy: string }) {
  await insertDecision(tx, { ...input, decision: 'approved', auto: true });
}

export type DecisionResult = { changed: boolean; status: ApprovalStatus; stockReturned?: number };

/** What was decided about this sale / exchange already (null = waiting). */
async function decisionFor(db: Db, column: 'saleId' | 'exchangeId', id: string) {
  const [row] = await db
    .select({ decision: approvalDecisions.decision })
    .from(approvalDecisions)
    .where(eq(approvalDecisions[column], id))
    .limit(1);
  return row?.decision ?? null;
}

/**
 * Approve one sale: nothing moves, the sale simply starts counting. Approving
 * again returns `changed: false`.
 */
export async function approveSale(
  db: Db,
  storeId: string,
  input: { saleId: string; decidedBy: string; batchId?: string | null },
): Promise<DecisionResult> {
  await assertOwner(db, storeId, input.decidedBy);
  const [sale] = await db.select({ id: sales.id }).from(sales).where(and(eq(sales.storeId, storeId), eq(sales.id, input.saleId))).limit(1);
  if (!sale) throw new DomainError('Sale not found.', { key: 'error.saleNotFound' });
  const already = await decisionFor(db, 'saleId', input.saleId);
  if (already) return { changed: false, status: already };
  try {
    const changed = await insertDecision(db, { storeId, saleId: input.saleId, decision: 'approved', decidedBy: input.decidedBy, batchId: input.batchId });
    return { changed, status: 'approved' };
  } catch (error) {
    if (isUniqueViolation(error)) return { changed: false, status: (await decisionFor(db, 'saleId', input.saleId)) ?? 'approved' };
    throw error;
  }
}

/**
 * Reject one sale: the piece goes back into the stock count through a new
 * movement (never by editing the sale), and the sale leaves every total.
 * A manual sale moved no stock, so nothing comes back.
 */
export async function rejectSale(
  db: Db,
  storeId: string,
  input: { saleId: string; decidedBy: string; reason: RejectReason; note?: string },
): Promise<DecisionResult> {
  await assertOwner(db, storeId, input.decidedBy);
  if (!REJECT_REASONS.includes(input.reason)) throw new DomainError('Choose a reason.', { key: 'appr.err.reason' });
  const already = await decisionFor(db, 'saleId', input.saleId);
  if (already) return { changed: false, status: already };
  return db.transaction(async (tx) => {
    const [sale] = await tx
      .select()
      .from(sales)
      .where(and(eq(sales.storeId, storeId), eq(sales.id, input.saleId)))
      .for('update')
      .limit(1);
    if (!sale) throw new DomainError('Sale not found.', { key: 'error.saleNotFound' });
    // An exchange built on this sale must be dealt with first, or the ledger would not add up.
    const [linked] = await tx
      .select({ id: exchanges.id })
      .from(exchanges)
      .where(and(eq(exchanges.originalSaleId, sale.id), sql`not exists (select 1 from ${approvalDecisions} d where d.exchange_id = ${exchanges.id} and d.decision = 'rejected')`))
      .limit(1);
    if (linked) throw new DomainError('This sale has an exchange. Reject the exchange first.', { key: 'appr.err.hasExchange' });

    const changed = await insertDecision(tx, {
      storeId,
      saleId: sale.id,
      decision: 'rejected',
      reason: input.reason,
      note: input.note,
      decidedBy: input.decidedBy,
    });
    if (!changed) return { changed: false, status: (await decisionFor(tx, 'saleId', sale.id)) ?? 'rejected' };

    if (!sale.productId) return { changed: true, status: 'rejected', stockReturned: 0 };
    // If the owner cleared the stock count after this sale, putting the piece back would be wrong.
    const [cleared] = await tx
      .select({ id: stockMovements.id })
      .from(stockMovements)
      .where(and(eq(stockMovements.productId, sale.productId), eq(stockMovements.reason, 'cleared'), gte(stockMovements.createdAt, sale.createdAt)))
      .limit(1);
    if (cleared) return { changed: true, status: 'rejected', stockReturned: 0 };

    await tx.update(products).set({ stock: sql`${products.stock} + ${sale.quantity}` }).where(eq(products.id, sale.productId));
    await tx.insert(stockMovements).values({
      storeId,
      productId: sale.productId,
      quantityChange: sale.quantity,
      reason: 'sale_rejected',
      refId: sale.id,
      staffId: input.decidedBy,
      note: input.note?.trim().slice(0, 200) || null,
    });
    return { changed: true, status: 'rejected', stockReturned: sale.quantity };
  });
}

export async function approveExchange(
  db: Db,
  storeId: string,
  input: { exchangeId: string; decidedBy: string; batchId?: string | null },
): Promise<DecisionResult> {
  await assertOwner(db, storeId, input.decidedBy);
  const [row] = await db.select({ id: exchanges.id }).from(exchanges).where(and(eq(exchanges.storeId, storeId), eq(exchanges.id, input.exchangeId))).limit(1);
  if (!row) throw new DomainError('Exchange not found.', { key: 'appr.err.exchangeNotFound' });
  const already = await decisionFor(db, 'exchangeId', input.exchangeId);
  if (already) return { changed: false, status: already };
  try {
    const changed = await insertDecision(db, { storeId, exchangeId: input.exchangeId, decision: 'approved', decidedBy: input.decidedBy, batchId: input.batchId });
    return { changed, status: 'approved' };
  } catch (error) {
    if (isUniqueViolation(error)) return { changed: false, status: (await decisionFor(db, 'exchangeId', input.exchangeId)) ?? 'approved' };
    throw error;
  }
}

/** Reject an exchange: the swap is undone — the new item comes back, the returned piece goes out again. */
export async function rejectExchange(
  db: Db,
  storeId: string,
  input: { exchangeId: string; decidedBy: string; reason: RejectReason; note?: string },
): Promise<DecisionResult> {
  await assertOwner(db, storeId, input.decidedBy);
  if (!REJECT_REASONS.includes(input.reason)) throw new DomainError('Choose a reason.', { key: 'appr.err.reason' });
  const already = await decisionFor(db, 'exchangeId', input.exchangeId);
  if (already) return { changed: false, status: already };
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(exchanges)
      .where(and(eq(exchanges.storeId, storeId), eq(exchanges.id, input.exchangeId)))
      .for('update')
      .limit(1);
    if (!row) throw new DomainError('Exchange not found.', { key: 'appr.err.exchangeNotFound' });

    const changed = await insertDecision(tx, {
      storeId,
      exchangeId: row.id,
      decision: 'rejected',
      reason: input.reason,
      note: input.note,
      decidedBy: input.decidedBy,
    });
    if (!changed) return { changed: false, status: (await decisionFor(tx, 'exchangeId', row.id)) ?? 'rejected' };

    // The returned piece leaves the shelf again; it must still be there.
    const [back] = await tx
      .update(products)
      .set({ stock: sql`${products.stock} - ${row.returnedQuantity}` })
      .where(and(eq(products.id, row.returnedProductId), gte(products.stock, row.returnedQuantity)))
      .returning({ stock: products.stock });
    if (!back) throw new DomainError('That returned piece has already been sold again, so this exchange cannot be undone.', { key: 'appr.err.returnedGone' });
    await tx.update(products).set({ stock: sql`${products.stock} + ${row.issuedQuantity}` }).where(eq(products.id, row.issuedProductId));
    await tx.insert(stockMovements).values([
      {
        storeId,
        productId: row.returnedProductId,
        quantityChange: -row.returnedQuantity,
        reason: 'exchange_rejected' as const,
        refId: row.id,
        staffId: input.decidedBy,
        note: input.note?.trim().slice(0, 200) || null,
      },
      {
        storeId,
        productId: row.issuedProductId,
        quantityChange: row.issuedQuantity,
        reason: 'exchange_rejected' as const,
        refId: row.id,
        staffId: input.decidedBy,
        note: input.note?.trim().slice(0, 200) || null,
      },
    ]);
    return { changed: true, status: 'rejected' };
  });
}

// ------------------------------------------------------------- the owner's list

export type PendingEntry = {
  kind: 'sale' | 'exchange';
  id: string;
  at: Date;
  manual: boolean;
  /** What was sold / swapped, for the card. */
  title: string;
  detail: string;
  quantity: number;
  amountPaise: number;
  /** Scanned sale: the item's MRP and usual selling price, so the owner can see a cut price. */
  mrpPaise: number | null;
  listPricePaise: number | null;
  /** Sale only (plan v17): purchase price per piece saved with the sale — owner's screen only, for profit / loss. */
  costPaise: number | null;
  note: string | null;
  soldBy: string;
  recordedBy: string;
  /** Exchange only. */
  swap?: { returned: string; issued: string; hasBill: boolean };
};

export type ApprovalDay = { day: string; entries: PendingEntry[]; totalPaise: number };

const tz = sql.raw(`'${STORE_TIMEZONE.replace(/'/g, "''")}'`);

/**
 * Everything waiting for the owner, newest first, grouped by shop day so he can
 * approve a whole day (or week) at once. Owner only: sales carry their purchase
 * price snapshot (plan v17) so the screen can mark profit or loss.
 */
export async function pendingForOwner(db: Db, storeId: string, { limit = 200 }: { limit?: number } = {}): Promise<ApprovalDay[]> {
  const credited = alias(staff, 'credited');
  const recorder = alias(staff, 'recorder');
  const returned = alias(products, 'returned');
  const item = alias(products, 'item');
  const [saleRows, exchangeRows] = await Promise.all([
    db
      .select({
        id: sales.id,
        at: sales.createdAt,
        manual: sales.manual,
        manualNote: sales.manualNote,
        name: sales.productName,
        size: sales.size,
        color: sales.color,
        sku: sales.sku,
        quantity: sales.quantity,
        unitPricePaise: sales.unitPricePaise,
        totalPaise: sales.totalPaise,
        mrpPaise: sales.mrpPaise,
        listPricePaise: item.pricePaise,
        costPaise: sales.costPaise,
        soldBy: credited.name,
        recordedBy: recorder.name,
        day: sql<string>`to_char(${sales.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`,
      })
      .from(sales)
      .innerJoin(credited, eq(credited.id, sales.soldBy))
      .innerJoin(recorder, eq(recorder.id, sales.recordedBy))
      .leftJoin(item, eq(item.id, sales.productId))
      .where(and(eq(sales.storeId, storeId), saleWaiting))
      .orderBy(desc(sales.createdAt))
      .limit(limit),
    db
      .select({
        id: exchanges.id,
        at: exchanges.createdAt,
        returnedName: returned.name,
        returnedSize: returned.size,
        returnedQuantity: exchanges.returnedQuantity,
        returnedUnitPricePaise: exchanges.returnedUnitPricePaise,
        issuedName: exchanges.issuedProductName,
        issuedSize: exchanges.issuedSize,
        issuedQuantity: exchanges.issuedQuantity,
        issuedUnitPricePaise: exchanges.issuedUnitPricePaise,
        issuedMrpPaise: exchanges.issuedMrpPaise,
        differencePaise: exchanges.differencePaise,
        hasBill: sql<boolean>`${exchanges.originalSaleId} is not null`,
        soldBy: credited.name,
        recordedBy: recorder.name,
        day: sql<string>`to_char(${exchanges.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`,
      })
      .from(exchanges)
      .innerJoin(returned, eq(returned.id, exchanges.returnedProductId))
      .innerJoin(credited, eq(credited.id, exchanges.creditedTo))
      .innerJoin(recorder, eq(recorder.id, exchanges.recordedBy))
      .where(and(eq(exchanges.storeId, storeId), exchangeWaiting))
      .orderBy(desc(exchanges.createdAt))
      .limit(limit),
  ]);

  const entries: (PendingEntry & { day: string })[] = [
    ...saleRows.map((r) => ({
      kind: 'sale' as const,
      id: r.id,
      at: r.at,
      day: r.day,
      manual: r.manual,
      title: r.name,
      detail: [r.size, r.color].filter(Boolean).join(' · ') || (r.manual ? '' : r.sku),
      quantity: r.quantity,
      amountPaise: r.totalPaise,
      mrpPaise: r.mrpPaise,
      listPricePaise: r.listPricePaise ?? null,
      costPaise: r.costPaise ?? null,
      note: r.manualNote,
      soldBy: r.soldBy,
      recordedBy: r.recordedBy,
    })),
    ...exchangeRows.map((r) => ({
      kind: 'exchange' as const,
      id: r.id,
      at: r.at,
      day: r.day,
      manual: false,
      title: r.issuedName,
      detail: r.issuedSize,
      quantity: r.issuedQuantity,
      amountPaise: r.differencePaise,
      mrpPaise: r.issuedMrpPaise,
      listPricePaise: null,
      costPaise: null,
      note: null,
      soldBy: r.soldBy,
      recordedBy: r.recordedBy,
      swap: {
        returned: `${r.returnedQuantity} × ${r.returnedName} (${r.returnedSize})`,
        issued: `${r.issuedQuantity} × ${r.issuedName} (${r.issuedSize})`,
        hasBill: Boolean(r.hasBill),
      },
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const days = new Map<string, ApprovalDay>();
  for (const { day, ...entry } of entries) {
    const bucket = days.get(day) ?? { day, entries: [], totalPaise: 0 };
    bucket.entries.push(entry);
    bucket.totalPaise += entry.amountPaise;
    days.set(day, bucket);
  }
  return [...days.values()];
}

/** How many entries are waiting (for the badge on the owner's Home). */
export async function pendingCount(
  db: Db,
  storeId: string,
): Promise<{ sales: number; exchanges: number; total: number; oldestDay: string | null; losses: number }> {
  const [saleRow] = await db
    .select({
      n: sql<number>`count(*)`.mapWith(Number),
      oldest: sql<string | null>`to_char(min(${sales.createdAt}) AT TIME ZONE ${tz}, 'YYYY-MM-DD')`,
      // Plan v17: waiting sales sold below their purchase price (owner's Home tile).
      losses: sql<number>`count(*) filter (where ${sales.costPaise} is not null and ${sales.unitPricePaise} < ${sales.costPaise})`.mapWith(Number),
    })
    .from(sales)
    .where(and(eq(sales.storeId, storeId), saleWaiting));
  const [exchangeRow] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number), oldest: sql<string | null>`to_char(min(${exchanges.createdAt}) AT TIME ZONE ${tz}, 'YYYY-MM-DD')` })
    .from(exchanges)
    .where(and(eq(exchanges.storeId, storeId), exchangeWaiting));
  const oldest = [saleRow.oldest, exchangeRow.oldest].filter(Boolean).sort()[0] ?? null;
  return { sales: saleRow.n, exchanges: exchangeRow.n, total: saleRow.n + exchangeRow.n, oldestDay: oldest, losses: saleRow.losses };
}

export type ApproveManyRange = { from?: Date; to?: Date; day?: string };

/**
 * Approve everything still waiting in a range — one day, a week, or all of it.
 * Each entry gets its own decision row under one batch id, and anything already
 * decided is skipped, so tapping twice approves nothing extra.
 */
export async function approveAll(
  db: Db,
  storeId: string,
  input: { decidedBy: string; batchId: string; range?: ApproveManyRange },
): Promise<{ sales: number; exchanges: number; total: number }> {
  await assertOwner(db, storeId, input.decidedBy);
  if (!input.batchId || input.batchId.length > 100) throw new DomainError('Missing operation id.');
  const range = input.range ?? {};
  const dayFilter = (column: SQL | AnyPgColumn) =>
    range.day ? sql`to_char(${column} AT TIME ZONE ${tz}, 'YYYY-MM-DD') = ${range.day}` : undefined;

  return db.transaction(async (tx) => {
    const waitingSales = await tx
      .select({ id: sales.id })
      .from(sales)
      .where(
        and(
          eq(sales.storeId, storeId),
          saleWaiting,
          range.from ? gte(sales.createdAt, range.from) : undefined,
          range.to ? lte(sales.createdAt, range.to) : undefined,
          dayFilter(sales.createdAt),
        ),
      )
      .orderBy(asc(sales.createdAt));
    const waitingExchanges = await tx
      .select({ id: exchanges.id })
      .from(exchanges)
      .where(
        and(
          eq(exchanges.storeId, storeId),
          exchangeWaiting,
          range.from ? gte(exchanges.createdAt, range.from) : undefined,
          range.to ? lte(exchanges.createdAt, range.to) : undefined,
          dayFilter(exchanges.createdAt),
        ),
      )
      .orderBy(asc(exchanges.createdAt));

    const rows = [
      ...waitingSales.map((s) => ({ storeId, saleId: s.id, exchangeId: null, decision: 'approved' as const, decidedBy: input.decidedBy, batchId: input.batchId })),
      ...waitingExchanges.map((e) => ({ storeId, saleId: null, exchangeId: e.id, decision: 'approved' as const, decidedBy: input.decidedBy, batchId: input.batchId })),
    ];
    if (rows.length === 0) return { sales: 0, exchanges: 0, total: 0 };
    const inserted = await tx.insert(approvalDecisions).values(rows).onConflictDoNothing().returning({ saleId: approvalDecisions.saleId });
    const salesDone = inserted.filter((r) => r.saleId !== null).length;
    return { sales: salesDone, exchanges: inserted.length - salesDone, total: inserted.length };
  });
}

/** The status of these sales, for lists that show a chip per row. */
export async function statusesForSales(db: Db, saleIds: string[]): Promise<Map<string, ApprovalStatus>> {
  const map = new Map<string, ApprovalStatus>(saleIds.map((id) => [id, 'waiting' as ApprovalStatus]));
  if (saleIds.length === 0) return map;
  const rows = await db
    .select({ saleId: approvalDecisions.saleId, decision: approvalDecisions.decision })
    .from(approvalDecisions)
    .where(inArray(approvalDecisions.saleId, saleIds));
  for (const row of rows) if (row.saleId) map.set(row.saleId, row.decision);
  return map;
}

export async function statusesForExchanges(db: Db, exchangeIds: string[]): Promise<Map<string, ApprovalStatus>> {
  const map = new Map<string, ApprovalStatus>(exchangeIds.map((id) => [id, 'waiting' as ApprovalStatus]));
  if (exchangeIds.length === 0) return map;
  const rows = await db
    .select({ exchangeId: approvalDecisions.exchangeId, decision: approvalDecisions.decision })
    .from(approvalDecisions)
    .where(inArray(approvalDecisions.exchangeId, exchangeIds));
  for (const row of rows) if (row.exchangeId) map.set(row.exchangeId, row.decision);
  return map;
}

/** Decisions the owner made, newest first (his own record of what he checked). */
export async function recentDecisions(db: Db, storeId: string, limit = 50) {
  const decider = alias(staff, 'decider');
  return db
    .select({
      id: approvalDecisions.id,
      at: approvalDecisions.createdAt,
      decision: approvalDecisions.decision,
      reason: approvalDecisions.reason,
      note: approvalDecisions.note,
      auto: approvalDecisions.auto,
      saleId: approvalDecisions.saleId,
      exchangeId: approvalDecisions.exchangeId,
      decidedBy: decider.name,
      saleName: sales.productName,
      saleTotalPaise: sales.totalPaise,
      saleManual: sales.manual,
    })
    .from(approvalDecisions)
    .innerJoin(decider, eq(decider.id, approvalDecisions.decidedBy))
    .leftJoin(sales, eq(sales.id, approvalDecisions.saleId))
    .where(and(eq(approvalDecisions.storeId, storeId), eq(approvalDecisions.auto, false)))
    .orderBy(desc(approvalDecisions.createdAt))
    .limit(limit);
}

