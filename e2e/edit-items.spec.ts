import { test, expect, type Page } from '@playwright/test';
import { openProduct } from './products';

// Owner, 2026-11-22 (ADR-054/061): edit an item on its page (even one with no brand or size) — tap a size,
// ✎ Edit details, + Add size, + Add pieces; bills keep their own copy (unit tests: bill-copy.test.ts).
const PIN = '1234';
const run = Date.now().toString(36);

async function loginOwner(page: Page) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByText('Owner', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test('edit an item made with no brand and no size; add sizes; add pieces', async ({ page }, info) => {
  await loginOwner(page);
  const name = `Edit Kurta ${run}${info.project.name[0]}`;
  // New item with no size and no brand (both allowed).
  await page.goto('/admin/stock/new');
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  await page.getByRole('button', { name: /^Kurta/ }).click();
  await page.getByLabel('Product name').fill(name);
  await page.getByLabel('Sale price', { exact: true }).fill('600');
  await page.getByTestId('details-form').getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.keyboard.press('Escape');

  await openProduct(page, name);

  // The item page (ADR-061): the no-size item shows N/A; tap it to give it size M and a colour.
  const sizes = page.getByTestId('size-row');
  await expect(sizes).toHaveCount(1);
  await expect(sizes).toContainText('N/A');
  await page.getByRole('button', { name: 'Change N/A', exact: true }).click();
  await page.getByLabel('Size', { exact: true }).fill('M');
  await page.getByLabel('Colour', { exact: true }).fill('Blue');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByTestId('done-overlay')).toContainText('Saved');
  await page.keyboard.press('Escape');
  await expect(sizes.first()).toContainText('M · Blue');

  // ✎ Edit details: a new MRP.
  await page.getByTestId('edit-details').click();
  const details = page.getByTestId('details-sheet');
  await details.getByLabel('MRP ₹').fill('650');
  await details.getByLabel('Selling ₹').fill('650');
  await details.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByTestId('done-overlay')).toContainText('Saved');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('item-prices')).toContainText('MRP ₹650.00');

  // + Add size: L (2 pieces), then XL (1); they take the design's name, prices and colour.
  for (const [size, pieces] of [['L', '2'], ['XL', '1']] as const) {
    await page.getByRole('button', { name: '+ Add size' }).click();
    await page.getByLabel('New size', { exact: true }).fill(size);
    await page.getByLabel(`Pieces of ${size}`, { exact: true }).fill(pieces);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByTestId('done-overlay')).toContainText('1 new size added');
    await page.keyboard.press('Escape');
  }
  await expect(sizes).toHaveCount(3);
  await expect(sizes.filter({ hasText: 'L · Blue' }).first()).toContainText('2 pcs');

  // + Add on M: 3 more came in (1 → 4).
  await page.getByRole('button', { name: 'Add pieces: M · Blue' }).click();
  await page.getByLabel('Pieces of M · Blue', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Add 3 pieces' }).click();
  await expect(page.getByTestId('done-overlay')).toContainText('3 pieces added');
  await page.keyboard.press('Escape');
  // The design now holds M 4 + L 2 + XL 1 = 7 pieces.
  await expect(page.getByTestId('item-pieces')).toHaveText('7');
});
