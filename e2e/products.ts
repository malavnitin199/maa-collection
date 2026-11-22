import { expect, type Page } from '@playwright/test';

/**
 * Products (ADR-058) lists every design as one card, with no search: find a card by the
 * design's exact name. (A size with its own MRP is a card of its own, so a name can match more.)
 */
export function productCard(page: Page, name: string) {
  return page.getByTestId('design-list').getByTestId('product-card').filter({ has: page.getByRole('link', { name, exact: true }) });
}

/** Products → the card of this design → its item page (the design's first size in shop order). */
export async function openProduct(page: Page, name: string) {
  await page.goto('/admin/products');
  await productCard(page, name).getByRole('link', { name, exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);
}
