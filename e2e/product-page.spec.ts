import { test, expect, type Locator, type Page } from '@playwright/test';

/** The company box is a compact dropdown (2026-11-21), not a <select>: open it and tap the name. */
async function choose(box: Locator, label: string) {
  await box.click();
  await box.page().getByRole('listbox').getByRole('option', { name: label, exact: true }).click();
}

/**
 * The product page's clean-up (owner's feedback 2026-11-20): figures on top for
 * a period (in stock, sold, came in, profit, last sale, last arrival), one row
 * with company + prices + the two actions, tabs Details · Colours · Sales ·
 * Purchases · Other details; the edit form's word boxes type Hindi or English.
 */
const PIN = '1234';
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

async function loginOwner(page: Page) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByText('Owner', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test('product page: figures, period, Sales and Purchases tabs, Hindi / English boxes in Other details', async ({ page }) => {
  await loginOwner(page);
  // A design through the old form: 2 sizes × 3 pieces at ₹400 purchase, bill P-<run>.
  await page.goto('/admin/stock/form');
  await page.getByLabel('Product name').fill(`Figure Kurta ${run}`);
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await choose(page.getByRole('combobox', { name: /^Company/ }), 'Shree Ganesh Textiles');
  await page.getByLabel('Sale price (MRP) ₹').fill('1299');
  await page.getByLabel('Purchase price ₹', { exact: true }).fill('400');
  await page.getByRole('tab', { name: 'Sizes', exact: true }).click();
  await page.getByRole('button', { name: 'Size M' }).click();
  await page.getByRole('button', { name: 'Size L' }).click();
  await page.getByRole('tab', { name: 'Details', exact: true }).click();
  await page.getByLabel('Pieces each').fill('3');
  await page.getByLabel('Supplier bill no. (optional)').fill(`P-${run}`);
  await page.getByRole('button', { name: 'Save 2 items' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  await page.getByTestId('receipt-lines').getByRole('link').first().click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}/);

  // Figures for the whole design.
  const figures = page.getByTestId('product-figures');
  await expect(page.getByTestId('product-stock')).toHaveText('6');
  await expect(figures).toContainText('2 items · this one 3');
  await expect(page.getByTestId('product-sold')).toHaveText('0');
  await expect(page.getByTestId('product-bought')).toHaveText('6');
  await expect(figures).toContainText('purchase ₹2,400.00');
  await expect(page.getByTestId('product-profit')).toHaveText('₹0.00');
  await expect(figures).toContainText(`bill P-${run}`);
  // One row: company, prices, the two actions.
  const row = page.getByTestId('product-must-haves');
  await expect(row.getByRole('link', { name: 'Shree Ganesh Textiles' })).toBeVisible();
  await expect(row).toContainText('MRP ₹1,299.00');
  await expect(row).toContainText('Purchase ₹400.00');
  await expect(row.getByRole('button', { name: 'Print label' })).toBeVisible();
  await expect(row.getByRole('link', { name: 'Restock' })).toBeVisible();

  // Tabs.
  await expect(page.getByRole('tab', { name: 'Details', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Sales', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Sales' }).getByText('No sales in this period.')).toBeVisible();
  await page.getByRole('tab', { name: 'Purchases', exact: true }).click();
  const arrivals = page.getByTestId('product-arrivals');
  await expect(arrivals.locator('li')).toHaveCount(1);
  await expect(arrivals).toContainText(`bill P-${run}`);
  await expect(arrivals).toContainText('First stock · Shree Ganesh Textiles');
  await expect(arrivals).toContainText('6 pcs');
  await expect(page.getByTestId('stock-history')).toBeVisible();
  await page.getByRole('tab', { name: 'Other details', exact: true }).click();
  const edit = page.getByRole('tabpanel', { name: 'Other details' });
  await expect(edit.getByLabel('Product name')).toHaveValue(`Figure Kurta ${run}`);
  await expect(edit.getByRole('button', { name: 'Type in Hindi' }).first()).toBeVisible();

  // A period with nothing in it: the figures follow, stock does not.
  const url = page.url();
  await page.goto(`${url}?period=custom&from=2020-01-01&to=2020-01-31`);
  await expect(page.getByTestId('product-bought')).toHaveText('0');
  await expect(page.getByTestId('product-stock')).toHaveText('6');
  await page.getByRole('link', { name: 'All time' }).click();
  await expect(page.getByTestId('product-bought')).toHaveText('6');
});
