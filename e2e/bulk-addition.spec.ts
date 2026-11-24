import { test, expect, type Page } from '@playwright/test';
import { productCard } from './products';

/**
 * Bulk addition (owner, 2026-11-24, ADR-072): Home → Bulk addition → the collection → the
 * category → one table for many products of that category (product name · purchase price ·
 * quantity) → one Save. No size, company or photo there: those come later on the product's page.
 */
const PIN = '1234';
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

async function login(page: Page, who: string, lands: RegExp, pin = PIN) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByText(who, { exact: true }).click();
  await page.getByLabel('PIN').fill(pin);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(lands);
}

const heading = (page: Page, text: string) => expect(page.getByRole('heading', { level: 2, name: text })).toBeVisible();
/** The table on screen (Next keeps a visited page's hidden copy). */
const table = (page: Page) => page.getByTestId('bulk-step').filter({ visible: true });
const rows = (page: Page) => table(page).getByTestId('bulk-row');

async function openTable(page: Page) {
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  await heading(page, 'What is it?');
  await page.getByRole('button', { name: /^Kurta/ }).click();
  await heading(page, 'Products');
  await expect(page.getByTestId('wizard-path')).toHaveText(/Men.*Kurta/);
}

test('Home → Bulk addition → collection → category → many products in one table → one Save', async ({ page }) => {
  await login(page, 'Owner', /\/admin\/dashboard$/);
  // Home's fourth action is Bulk addition (where Approvals was); Approvals has no tile any more.
  const actions = page.getByTestId('quick-actions');
  await expect(actions.getByRole('link')).toHaveCount(4);
  await expect(actions.getByRole('link', { name: 'Approvals' })).toHaveCount(0);
  await actions.getByRole('link', { name: 'Bulk addition' }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/bulk$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Bulk addition');
  await expect(page.getByText('Step 1 of 3')).toBeVisible();
  await heading(page, 'Which collection?');
  await openTable(page);
  await expect(page.getByText('Step 3 of 3')).toBeVisible();

  // Five empty rows wait; nothing to save yet. Only three things are asked: name, purchase price, quantity.
  await expect(rows(page)).toHaveCount(5);
  const save = table(page).getByRole('button', { name: 'Save', exact: true });
  await expect(save).toBeDisabled();
  await expect(table(page).getByRole('columnheader')).toHaveText(['S.N', /^Product name/, 'Purchase ₹', 'Qty', '']);
  await expect(table(page).getByRole('combobox')).toHaveCount(0); // no company, no sizes here
  await expect(table(page).getByTestId('bulk-total')).toHaveText('0 products · 0 pcs₹0.00');

  const a = `Bulk A ${run}`;
  const b = `Bulk B ${run}`;
  await page.getByLabel('Product name, row 1').fill(a);
  await page.getByLabel('Purchase price, row 1').fill('700');
  await page.getByLabel('Quantity, row 1').fill('3');
  await page.getByLabel('Product name, row 2').fill(b);
  // A row with no purchase price is pointed out, and nothing is saved.
  await save.click();
  await expect(table(page).getByRole('alert')).toHaveText('Row 2: type the purchase price.');
  await expect(page.getByLabel('Purchase price, row 2')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Purchase price, row 2')).toBeFocused();
  await page.getByLabel('Purchase price, row 2').fill('950'); // quantity left empty = 1
  // No name: it becomes "<category> + number".
  await page.getByLabel('Purchase price, row 3').fill('1200');
  await page.getByLabel('Quantity, row 3').fill('2');
  await expect(table(page).getByTestId('bulk-total')).toHaveText('3 products · 6 pcs₹5,450.00');
  await expect(table(page).getByTestId('bulk-sale-note')).toHaveText('Sale price: purchase + 50%');

  // A new empty row is always waiting under the last one typed; ✕ takes a row away.
  await page.getByLabel('Product name, row 5').fill('Mistake');
  await expect(rows(page)).toHaveCount(6);
  await page.getByRole('button', { name: 'Clear row 5' }).click();
  await expect(rows(page)).toHaveCount(5);
  await expect(table(page).getByTestId('bulk-total')).toHaveText('3 products · 6 pcs₹5,450.00');

  await save.click();
  const done = page.getByTestId('done-overlay');
  await expect(done).toContainText('3 products saved');
  await expect(done.getByTestId('done-lines')).toContainText('TypeMen › Kurta');
  await expect(done.getByTestId('done-lines')).toContainText('Pieces6 pcs');
  await expect(done.getByTestId('done-lines')).toContainText('Purchase total₹5,450.00');
  await page.keyboard.press('Escape');
  await expect(done).toBeHidden();
  // The table is empty again, still on Kurta: the next lot can be typed straight away.
  await heading(page, 'Products');
  await expect(page.getByTestId('wizard-path')).toHaveText(/Men.*Kurta/);
  await expect(page.getByLabel('Product name, row 1')).toHaveValue('');
  await expect(table(page).getByTestId('bulk-total')).toHaveText('0 products · 0 pcs₹0.00');

  // Stocks has them: pieces, purchase price, and the sale price worked out (purchase + 50%).
  await page.goto('/admin/products');
  await expect(productCard(page, a).getByTestId('card-figures')).toHaveText(/3 pcs.*₹700\/pc.*MRP ₹1,050/);
  await expect(productCard(page, b).getByTestId('card-figures')).toHaveText(/1 pcs?.*₹950\/pc.*MRP ₹1,425/);
  // The product's page: no size, no company; its photo and the rest are added here later.
  await productCard(page, a).getByRole('link', { name: a, exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId('item-head')).toContainText(a);
  await expect(page.getByTestId('item-head').getByRole('button', { name: 'Add photo' })).toBeVisible();
});

test('Save & print tags prints every product’s tags; + Add more goes back to the same category’s table; the same name twice is refused', async ({ page }) => {
  await login(page, 'Owner', /\/admin\/dashboard$/);
  await page.goto('/admin/stock');
  await page.getByRole('link', { name: /^Bulk addition/ }).click(); // also under Add stock → Other ways
  await expect(page).toHaveURL(/\/admin\/stock\/bulk$/);
  await openTable(page);
  const c = `Bulk C ${run}`;
  const d = `Bulk D ${run}`;
  await page.getByLabel('Product name, row 1').fill(c);
  await page.getByLabel('Purchase price, row 1').fill('400');
  await page.getByLabel('Quantity, row 1').fill('2');
  await page.getByLabel('Product name, row 2').fill(c.toLowerCase());
  await page.getByLabel('Purchase price, row 2').fill('450');
  await table(page).getByRole('button', { name: 'Save & print tags' }).click();
  await expect(table(page).getByRole('alert')).toContainText('The same product is entered twice');
  await page.keyboard.press('Escape'); // the red Not saved card
  await expect(page.getByTestId('done-overlay')).toBeHidden();
  await page.getByLabel('Product name, row 2').fill(d);
  await table(page).getByRole('button', { name: 'Save & print tags' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=[0-9a-f-]{36}&created=2&bulk=1$/);
  const lines = page.getByTestId('receipt-lines');
  await expect(lines.getByRole('link', { name: new RegExp(`^${c}`) })).toHaveCount(1);
  await expect(lines.getByRole('link', { name: new RegExp(`^${d}`) })).toHaveCount(1);
  // One tag per piece: 2 + 1.
  await expect(page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode 200/ })).toHaveCount(3);

  await page.getByRole('link', { name: '+ Add more Kurta' }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/bulk\?section=[0-9a-f-]{36}&type=[0-9a-f-]{36}&n=[0-9a-f-]{36}$/);
  await heading(page, 'Products');
  await expect(page.getByTestId('wizard-path')).toHaveText(/Men.*Kurta/);
  await expect(rows(page)).toHaveCount(5);
  await expect(page.getByLabel('Product name, row 1')).toHaveValue('');
  // ← goes one step back (to the categories), as in New item.
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await heading(page, 'What is it?');
});

test('without the purchase-price right the price box is the sale price; a salesman without the catalog right cannot open it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'same rule on both');
  await login(page, 'Vishal', /\/pos$/);
  await page.goto('/admin/stock/bulk');
  await expect(page).toHaveURL(/\/pos$/);

  // A new helper with the Catalog right only.
  const name = `Bulk Helper ${run}`;
  await login(page, 'Owner', /\/admin\/dashboard$/);
  await page.goto('/admin/staff');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('PIN (4–6 digits)').fill('4321');
  await page.getByRole('button', { name: 'Add staff' }).click();
  await expect(page.getByRole('status')).toContainText(`${name} added`);
  const row = page.getByTestId('staff-list').getByRole('listitem').filter({ hasText: name });
  await row.getByText(/^Permissions:/).click();
  const form = page.getByRole('form', { name: `Permissions for ${name}` });
  await form.getByLabel(`Catalog for ${name}`).check();
  await form.getByLabel(`Purchase price for ${name}`).uncheck();
  await form.getByRole('button', { name: 'Save permissions' }).click();
  await expect(form.getByRole('status')).toContainText('Saved: catalog');

  await login(page, name, /\/pos$/, '4321');
  await page.goto('/admin/stock/bulk');
  await openTable(page);
  await expect(table(page).getByRole('columnheader')).toHaveText(['S.N', /^Product name/, 'Sale ₹', 'Qty', '']);
  await expect(table(page)).not.toContainText(/purchase/i);
  await expect(table(page).getByTestId('bulk-sale-note')).toHaveCount(0);
  const e = `Bulk E ${run}`;
  await page.getByLabel('Product name, row 1').fill(e);
  await page.getByLabel('Sale price, row 1').fill('899');
  await page.getByLabel('Quantity, row 1').fill('4');
  await expect(table(page).getByTestId('bulk-total')).toHaveText('1 product · 4 pcs');
  await table(page).getByRole('button', { name: 'Save', exact: true }).click();
  const done = page.getByTestId('done-overlay');
  await expect(done).toContainText('Product saved');
  await expect(done).not.toContainText(/purchase/i);
  await page.keyboard.press('Escape');

  // The owner sees it at the typed sale price, with no purchase price.
  await login(page, 'Owner', /\/admin\/dashboard$/);
  await page.goto('/admin/products');
  await expect(productCard(page, e).getByTestId('card-figures')).toHaveText(/4 pcs.*MRP ₹899/);
  await expect(productCard(page, e).getByTestId('card-figures')).not.toContainText('/pc');
});
