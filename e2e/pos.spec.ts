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
  await scanBox(page).fill('8901111000014');
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
  await expect(page.getByTestId('recent-sales')).toContainText('2 × Classic Crew Tee');

  // Scanning the same item again shows the reduced stock.
  await scanBox(page).fill('MAA-TS-001');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('details-stock')).toHaveText('1');

  // Admin dashboard reflects the same demo store.
  await page.goto('/admin/dashboard');
  await expect(page.getByTestId('total-revenue')).toContainText('900.00');
  await expect(page.getByTestId('units-sold')).toHaveText('2');
  await expect(page.getByTestId('sales-by-person')).toContainText('Ravi');
});

test('labels page shows a QR code and a barcode for every demo item', async ({ page }) => {
  await page.goto('/admin/labels');
  await expect(page.getByRole('heading', { name: 'Test labels' })).toBeVisible();
  const qr = page.getByRole('img', { name: 'QR code for MAA-TS-001' });
  await expect(qr).toBeVisible();
  await expect(page.getByRole('img', { name: 'Barcode 8901111000014 for MAA-TS-001' })).toBeVisible();
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

test('POS starts with only the scan controls, no inventory list', async ({ page }) => {
  await page.goto('/pos');
  await expect(scanBox(page)).toBeEnabled();
  await expect(page.getByText('Classic Crew Tee')).toHaveCount(0);
  await expect(page.getByTestId('item-details')).toHaveCount(0);
});

test('hardware scanner works without tapping the scan box first', async ({ page }) => {
  await page.goto('/pos');
  await expect(scanBox(page)).toBeFocused();
  // Scanners type the code fast and press Enter.
  await page.keyboard.type('8901111000014', { delay: 5 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('item-details')).toContainText('MAA-TS-001');
});

test('hardware scan while a button has focus is not lost and does not press the button', async ({ page }) => {
  await page.goto('/pos');
  // Open then close the camera: focus is left on the camera button.
  await page.getByRole('button', { name: 'Scan with camera' }).click();
  await page.getByRole('button', { name: 'Stop camera' }).click();
  await expect(page.getByRole('button', { name: 'Scan with camera' })).toBeFocused();

  await page.keyboard.type('MAA-JE-001', { delay: 5 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('item-details')).toContainText('Slim Fit Jeans');
  await expect(page.getByRole('heading', { name: 'Camera scan' })).toHaveCount(0);
});
