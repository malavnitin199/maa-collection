'use server';

import { z } from 'zod';
import { getDb } from '@/db/client';
import { STORE_ID } from '@/lib/app-config';
import { requireStaff } from '@/server/auth';
import { errorText, getT } from '@/server/i18n';
import { DomainError } from '@/server/services/errors';
import { findReturnableSales, recordExchange, type ReturnableSale } from '@/server/services/exchanges';
import { findProductByCode, toCounterProduct, type CounterProduct } from '@/server/services/products';
import { recordSale } from '@/server/services/sales';
import { imageSrc, mainImages } from '@/server/services/images';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Runs a counter action; errors come back in the person's language. */
async function run<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    const t = await getT();
    if (error instanceof DomainError) return { ok: false, error: errorText(error, t) };
    if (error instanceof z.ZodError) return { ok: false, error: t('error.invalid') };
    console.error(error);
    return { ok: false, error: t('error.generic') };
  }
}

/** Scan / typed code → product details for the counter (never includes cost). */
export async function lookupProductAction(code: string): Promise<ActionResult<CounterProduct | null>> {
  await requireStaff();
  return run(async () => {
    const db = await getDb();
    const product = await findProductByCode(db, STORE_ID, z.string().max(200).parse(code));
    if (!product) return null;
    const photo = (await mainImages(db, STORE_ID, [product.id])).get(product.id);
    return { ...toCounterProduct(product), imageSrc: photo ? imageSrc(photo) : null };
  });
}

const saleSchema = z.object({
  operationId: z.string().min(8).max(100),
  productId: z.uuid(),
  quantity: z.number().int(),
  unitPricePaise: z.number().int(),
  soldBy: z.uuid(),
});

export async function recordSaleAction(
  input: z.input<typeof saleSchema>,
): Promise<ActionResult<{ stockLeft: number; totalPaise: number; duplicate: boolean }>> {
  const current = await requireStaff();
  return run(async () => {
    const data = saleSchema.parse(input);
    const result = await recordSale(await getDb(), STORE_ID, { ...data, recordedBy: current.id });
    return { stockLeft: result.stockLeft, totalPaise: result.sale.totalPaise, duplicate: result.duplicate };
  });
}

/** Exchange step 1: the item the customer brought back → its recent, still-returnable sales. */
export async function returnableSalesAction(
  code: string,
): Promise<ActionResult<{ product: CounterProduct; sales: ReturnableSale[] } | null>> {
  await requireStaff();
  return run(async () => {
    const db = await getDb();
    const product = await findProductByCode(db, STORE_ID, z.string().max(200).parse(code));
    if (!product) return null;
    return { product: toCounterProduct(product), sales: await findReturnableSales(db, STORE_ID, product.id) };
  });
}

const exchangeSchema = z.object({
  operationId: z.string().min(8).max(100),
  originalSaleId: z.uuid(),
  returnedQuantity: z.number().int(),
  issuedProductId: z.uuid(),
  issuedQuantity: z.number().int(),
  issuedUnitPricePaise: z.number().int(),
  creditedTo: z.uuid(),
});

export async function recordExchangeAction(
  input: z.input<typeof exchangeSchema>,
): Promise<ActionResult<{ differencePaise: number; duplicate: boolean }>> {
  const current = await requireStaff();
  return run(async () => {
    const data = exchangeSchema.parse(input);
    const result = await recordExchange(await getDb(), STORE_ID, { ...data, recordedBy: current.id });
    return { differencePaise: result.exchange.differencePaise, duplicate: result.duplicate };
  });
}
