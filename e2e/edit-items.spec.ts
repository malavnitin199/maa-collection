import { test, expect, type Page } from '@playwright/test';

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

  await page.goto(`/admin/products?q=${encodeURIComponent(name)}&show=items`);
  await page.getByTestId('product-list').getByRole('link').first().click();

  // Edit sits at the top of Details: give it size M and a new MRP.
  const edit = page.getByTestId('edit-item');
  await edit.getByText('Edit this item').click();
  await edit.getByLabel('Size', { exact: true }).fill('M');
  await edit.getByLabel('MRP (₹)').fill('650');
  await edit.getByLabel('Selling price (₹)').fill('650');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit.getByRole('status')).toContainText('Saved');
  await expect(page.getByTestId('hang-tag').getByTestId('tag-size')).toHaveText('M');

  // + Add sizes: L (2 pieces) and XL (1).
  const add = page.getByTestId('add-sizes-card');
  await add.getByText('+ Add sizes').click();
  await add.getByRole('button', { name: 'Size L', exact: true }).click();
  await add.getByRole('button', { name: 'Size XL', exact: true }).click();
  await add.getByRole('button', { name: 'One more of size L' }).click();
  await add.getByRole('button', { name: 'Add 2 sizes' }).click();
  await expect(page.getByText('2 new sizes added')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Colours', exact: true }).click();
  await expect(page.getByTestId('design-variants').getByRole('link')).toHaveCount(3);
  await expect(page.getByTestId('design-variants').getByRole('link', { name: 'L: 2 in stock' })).toBeVisible();

  // Add pieces to this size (M): 1 → 4.
  await page.getByRole('tab', { name: 'Details', exact: true }).click();
  await page.getByLabel('Pieces received').fill('3');
  await page.getByRole('button', { name: 'Add stock' }).click();
  // The design now holds M 4 + L 2 + XL 1 = 7 pieces.
  await expect(page.getByTestId('product-stock')).toContainText('7');
});
