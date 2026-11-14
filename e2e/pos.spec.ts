import { test, expect } from '@playwright/test';

const scanBox = (page: import('@playwright/test').Page) =>
  page.getByLabel('Scan barcode / QR or enter SKU');

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

test('scan shows item details first, then sells at a bargained price', async ({ page }) => {
  await page.goto('/pos');

  // Scan the Classic Crew Tee by barcode (initial demo stock: 3).
  await scanBox(page).fill('8901111000011');
  await page.keyboard.press('Enter');

  // Step 1: details only, no price asked yet.
  const details = page.getByTestId('item-details');
  await expect(details).toContainText('MAA-TS-001');
  await expect(details).toContainText('Classic Crew Tee');
  await expect(page.getByTestId('details-stock')).toHaveText('3');
  await expect(page.getByLabel(/Sale price/)).toHaveCount(0);

  // Step 2: sell 2 units at a bargained ₹450 instead of MRP ₹499.
  await page.getByRole('button', { name: 'Sell this item' }).click();
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

test('QR labels page lists every demo item with its code image', async ({ page }) => {
  await page.goto('/admin/labels');
  await expect(page.getByRole('heading', { name: 'QR labels' })).toBeVisible();
  const qr = page.getByRole('img', { name: 'QR code for MAA-TS-001' });
  await expect(qr).toBeVisible();
  await expect(page.getByText('MAA-DR-001')).toBeVisible();
});

test('sale price above MRP is rejected', async ({ page }) => {
  await page.goto('/pos');
  await scanBox(page).fill('MAA-TS-002');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await page.getByLabel(/Sale price/).fill('600');
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByRole('status')).toContainText('cannot be above MRP');
});

test('unknown code and out-of-stock item show clear errors', async ({ page }) => {
  await page.goto('/pos');

  await scanBox(page).fill('0000000000000');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('No item found');

  // Banarasi Saree starts with zero demo stock: details show, selling is refused.
  await scanBox(page).fill('MAA-SA-001');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('details-stock')).toHaveText('0');
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await expect(page.getByRole('status')).toContainText('out of stock');
});
