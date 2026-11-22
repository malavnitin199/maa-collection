import { expect, type Page } from '@playwright/test';

/**
 * Products (ADR-058) lists every design as one card, with no search: find a card by the
 * design's exact name. (A size with its own MRP is a card of its own, so a name can match more.)
 */
export function productCard(page: Page, name: string) {
  return page.getByTestId('design-list').getByTestId('product-card').filter({ has: page.getByRole('link', { name, exact: true }) });
}

/** New item's "Sizes & more" fold (owner, 2026-11-22, ADR-065): opened before sizes, boxes, bill no. … */
export async function openMore(page: Page) {
  const more = page.getByTestId('more-details').filter({ visible: true });
  if (!(await more.evaluate((d) => (d as HTMLDetailsElement).open))) await more.locator('summary').click();
  await expect(more).toHaveAttribute('open', '');
}

/** Products → the card of this design → its item page (the design's first size in shop order). */
export async function openProduct(page: Page, name: string) {
  await page.goto('/admin/products');
  await productCard(page, name).getByRole('link', { name, exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);
}

/** New bill / Edit bill (ADR-061): the bill editor on screen (Next keeps a visited page's hidden copy). */
export const billEditor = (page: Page) => page.getByTestId('bill-editor').filter({ visible: true });

/** Chooses the bill's one company in the bill editor. */
export async function chooseBillCompany(page: Page, company: string) {
  await billEditor(page).getByRole('combobox', { name: /^Company/ }).click();
  await page.getByRole('listbox').getByRole('option', { name: company, exact: true }).click();
}

/**
 * Finds a product in the bill editor's list (searching for its name, as the list shows the
 * newest first) and taps one size chip — `size` as the chip shows it (size, then colour) —
 * or, without `size`, + All sizes (a one-size product: its only chip).
 */
export async function addToBill(page: Page, name: string, size?: string) {
  await billEditor(page).getByLabel('Search an item: name, code or barcode').fill(name);
  const card = billEditor(page).getByTestId('bill-product').filter({ has: page.getByText(name, { exact: true }) });
  await expect(card).toHaveCount(1);
  if (size) return card.getByRole('button', { name: `Add ${name} · ${size}`, exact: true }).click();
  const all = card.getByRole('button', { name: `+ All sizes: ${name}` });
  if ((await all.count()) > 0) return all.click();
  await card.getByRole('button', { name: new RegExp(`^Add ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · `) }).click();
}
