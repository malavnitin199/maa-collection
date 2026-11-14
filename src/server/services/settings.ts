import { eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { stores } from '@/db/schema';
import { codeWordProblem, encodePriceCode, normalizeCodeWord } from '@/lib/price-code';
import { DomainError } from './errors';

export type StoreSettings = { name: string; priceCodeWord: string | null; printPriceCode: boolean };

export async function getStoreSettings(db: Db, storeId: string): Promise<StoreSettings> {
  const [row] = await db
    .select({ name: stores.name, priceCodeWord: stores.priceCodeWord, printPriceCode: stores.printPriceCode })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);
  if (!row) throw new DomainError('Shop not found.');
  return row;
}

/** Save the code word (blank = none) and whether labels print the code price. */
export async function updatePriceCode(
  db: Db,
  storeId: string,
  input: { priceCodeWord: string; printPriceCode: boolean },
): Promise<StoreSettings> {
  const word = normalizeCodeWord(input.priceCodeWord);
  if (word) {
    const problem = codeWordProblem(word);
    if (problem) throw new DomainError(problem);
  }
  if (input.printPriceCode && !word) throw new DomainError('Set a code word before printing code prices on labels.');
  await db
    .update(stores)
    .set({ priceCodeWord: word || null, printPriceCode: input.printPriceCode })
    .where(eq(stores.id, storeId));
  return getStoreSettings(db, storeId);
}

/** The code price to print on a label, or null if switched off / no purchase price. */
export function labelPriceCode(settings: StoreSettings, costPaise: number | null): string | null {
  if (!settings.printPriceCode || !settings.priceCodeWord || costPaise === null) return null;
  return encodePriceCode(costPaise, settings.priceCodeWord);
}
