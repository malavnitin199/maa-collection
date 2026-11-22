import { test, expect, type Page } from '@playwright/test';
import { openProduct, productCard } from './products';

// Delete items (owner, 2026-11-22, ADR-050): Products → Select → Delete, and Delete on the product page,
// both after a confirmation; the owner only.
const PIN = '1234';
const run = Date.now().toString(36);

async function login(page: Page, name: string) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByText(name, { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

/** New item with two sizes (M, L), 1 piece each. */
async function addItem(page: Page, name: string) {
  await page.goto('/admin/stock/new');
  await page.getByRole('button', { name: /^Many items/ }).click();
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  await page.getByRole('button', { name: /^Kurta/ }).click();
  await page.getByRole('combobox', { name: /^Company/ }).click();
  await page.getByRole('listbox').getByRole('option', { name: 'Royal Garments', exact: true }).click();
  await page.getByLabel('Product name').fill(name);
  await page.getByLabel('Sale price (MRP) ₹').fill('999');
  for (const size of ['M', 'L']) await page.getByTestId('size-cards').getByRole('button', { name: `Size ${size}`, exact: true }).click();
  await page.getByTestId('details-form').getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.keyboard.press('Escape');
}

test('owner deletes items: several from Products → Select, a whole design from its product page; each asks first', async ({ page }, info) => {
  await login(page, 'Owner');
  const one = `Del One ${run}${info.project.name[0]}`;
  const two = `Del Two ${run}${info.project.name[0]}`;
  await addItem(page, one);
  await addItem(page, two);

  // Products → Select → tick the design's card (both its sizes) → Delete: a confirmation first; Cancel keeps them.
  // (Never Select all here: every product of the shared test shop is on the page.)
  await page.goto('/admin/products');
  const card = productCard(page, one);
  await expect(card.getByTestId('card-items')).toHaveText('Items: 2');
  await page.getByTestId('select-products').click();
  await page.getByRole('checkbox', { name: `Select ${one}`, exact: true }).click();
  await expect(page.getByTestId('selected-count')).toHaveText('2 selected');
  const bar = page.getByTestId('selection-bar');
  const sheet = page.getByTestId('action-sheet');
  await bar.getByRole('button', { name: 'Delete' }).click();
  await expect(sheet).toHaveAccessibleName('Delete 2 items?');
  await expect(sheet).toContainText('This cannot be undone.');
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toBeHidden();
  await bar.getByRole('button', { name: 'Delete' }).click();
  await sheet.getByTestId('confirm-delete-items').click();
  await expect(page.getByTestId('selection-toast')).toContainText('2 items deleted.');
  await expect(card).toHaveCount(0);

  // Product page → Delete this item → "all 2 sizes of this design".
  await openProduct(page, two);
  await page.getByTestId('delete-item').click();
  await expect(page.getByTestId('action-sheet')).toHaveAccessibleName('Delete this item?');
  await page.getByTestId('confirm-delete-design').click();
  await expect(page).toHaveURL(/\/admin\/products\?deleted=/);
  await expect(page.getByTestId('deleted-note')).toHaveText('2 items deleted.');
  await expect(productCard(page, two)).toHaveCount(0);
});

test('a salesman never sees Delete on a product page', async ({ page }) => {
  await login(page, 'Owner');
  // Seeded item: open its page as the owner (Delete shown), then as a salesman (no Delete).
  await openProduct(page, 'Anarkali Kurta'); // MAA-KU-001, its first size
  await expect(page.getByTestId('delete-item')).toBeVisible();
  const url = page.url();
  await login(page, 'Vishal');
  await page.goto(url);
  await expect(page.getByTestId('delete-item')).toHaveCount(0);
});
