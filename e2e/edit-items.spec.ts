import { test, expect, type Page } from '@playwright/test';
import { openProduct } from './products';

// Owner, 2026-11-22 (ADR-054): edit an item at the top of its page (even one with no brand or size),
// add more sizes to its design, add pieces; bills keep their own copy (unit tests: bill-copy.test.ts).
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
  await page.getByRole('button', { name: /^One item/ }).click();
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  await page.getByRole('button', { name: /^Kurta/ }).click();
  await page.getByLabel('Product name').fill(name);
  await page.getByLabel('Sale price (MRP) ₹').fill('600');
  await page.getByTestId('details-form').getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.keyboard.press('Escape');

  await openProduct(page, name);

  // The item page's editor (ADR-059): the no-size item shows N/A; ✎ gives it size M and a colour; a new MRP.
  const editor = page.getByTestId('item-editor');
  await expect(editor.getByTestId('size-row')).toHaveCount(1);
  await expect(editor.getByTestId('size-row')).toContainText('N/A');
  await editor.getByRole('button', { name: 'Change size or colour: N/A' }).click();
  await editor.getByLabel('Size', { exact: true }).fill('M');
  await editor.getByLabel('Colour', { exact: true }).fill('Blue');
  await editor.getByLabel('MRP ₹').fill('650');
  await editor.getByLabel('Selling ₹').fill('650');
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByTestId('done-overlay')).toContainText('Saved');
  await page.keyboard.press('Escape');
  await expect(editor.getByTestId('size-row').first()).toContainText('M · Blue');
  await expect(editor.getByLabel('MRP ₹')).toHaveValue('650');

  // + Add size: L (2 pieces) and XL (1).
  await editor.getByRole('button', { name: '+ Add size' }).click();
  await editor.getByLabel('New size', { exact: true }).fill('L');
  await editor.getByRole('button', { name: 'One more: L' }).click();
  await editor.getByRole('button', { name: '+ Add size' }).click();
  await editor.getByLabel('New size', { exact: true }).nth(1).fill('XL');
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByTestId('done-overlay')).toContainText('2 new sizes added');
  await page.keyboard.press('Escape');
  await expect(editor.getByTestId('size-row')).toHaveCount(3);
  await expect(editor.getByLabel('Pieces of L · Blue')).toHaveValue('2');

  // Pieces of this size (M): 1 → 4, counted.
  await editor.getByLabel('Pieces of M · Blue').fill('4');
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByTestId('done-overlay')).toContainText('Pieces corrected for 1 size');
  await page.keyboard.press('Escape');
  // The design now holds M 4 + L 2 + XL 1 = 7 pieces.
  await expect(page.getByTestId('item-pieces')).toHaveText('7 pcs');
});
