import { test, expect } from '@playwright/test';

test('role picker navigates to POS and admin dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: /Continue as Salesman/ }).click();
  await expect(page).toHaveURL(/\/pos$/);
  await expect(page.getByRole('heading', { name: 'Counter sale' })).toBeVisible();

  await page.goto('/login');
  await page.getByRole('link', { name: /Continue as Admin/ }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('scanning deducts stock, records bargained price, and shows on admin dashboard', async ({
  page,
}) => {
  await page.goto('/pos');

  // Scan the Classic Crew Tee (initial demo stock: 3).
  await page.getByLabel('Scan barcode / QR or enter SKU').fill('8901111000011');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /Classic Crew Tee/ })).toBeVisible();
  await expect(page.getByText('3 in stock · MRP')).toBeVisible();

  // Sell 2 units at a bargained ₹450 instead of MRP ₹499.
  await page.getByLabel('Quantity').fill('2');
  await page.getByLabel(/Sale price/).fill('450');
  await page.getByRole('button', { name: 'Record sale' }).click();

  await expect(page.getByRole('status')).toContainText('Stock left: 1');
  await expect(page.getByTestId('stock-MAA-TS-001')).toHaveText('1 in stock');
  await expect(page.getByTestId('recent-sales')).toContainText('2 × Classic Crew Tee');

  // Admin dashboard reflects the same demo store.
  await page.goto('/admin/dashboard');
  await expect(page.getByTestId('total-revenue')).toContainText('900.00');
  await expect(page.getByTestId('units-sold')).toHaveText('2');
  await expect(page.getByTestId('sales-by-person')).toContainText('Ravi');
});

test('sale price above MRP is rejected', async ({ page }) => {
  await page.goto('/pos');
  await page.getByLabel('Scan barcode / QR or enter SKU').fill('MAA-TS-002');
  await page.keyboard.press('Enter');
  await page.getByLabel(/Sale price/).fill('600');
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByRole('status')).toContainText('cannot be above MRP');
});

test('unknown code and out-of-stock item show clear errors', async ({ page }) => {
  await page.goto('/pos');

  await page.getByLabel('Scan barcode / QR or enter SKU').fill('0000000000000');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('No item found');

  // Banarasi Saree starts with zero demo stock.
  await page.getByLabel('Scan barcode / QR or enter SKU').fill('8904444000017');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('out of stock');
});
