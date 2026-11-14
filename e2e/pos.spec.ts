import { test, expect, type Page } from '@playwright/test';

// Local/test database seeds every account with PIN 1234 (never in production).
const PIN = '1234';
const run = Date.now().toString(36);

async function login(page: Page, name: string, pin = PIN) {
  await page.goto('/login');
  await page.getByText(name, { exact: true }).click();
  await page.getByLabel('PIN').fill(pin);
  await page.getByRole('button', { name: 'Log in' }).click();
  // Wait for the login to finish before navigating, or the next page load races it.
  if (pin === PIN) await expect(page).not.toHaveURL(/\/login$/);
}

/** Admin adds a product; returns its generated barcode. */
async function addProduct(page: Page, { name, size, mrp, price, stock }: { name: string; size: string; mrp: string; price: string; stock: string }) {
  await page.goto('/admin/products/new');
  await page.getByLabel('Product name').fill(name);
  await page.getByLabel('Brand').fill('Test Brand');
  await page.getByRole('combobox', { name: /^Category/ }).selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Size').fill(size);
  await page.getByLabel('Colour').fill('Blue');
  await page.getByLabel('MRP (₹)').fill(mrp);
  await page.getByLabel('Selling price (₹)').fill(price);
  await page.getByLabel(/Purchase price/).fill('500');
  await page.getByLabel('Opening stock (pieces)').fill(stock);
  await page.getByRole('button', { name: 'Add product and generate label' }).click();
  const status = page.getByRole('status');
  await expect(status).toContainText('Product added');
  const barcode = (await status.innerText()).match(/barcode (\d{13})/)?.[1];
  expect(barcode).toMatch(/^200\d{10}$/);
  await expect(page.getByRole('img', { name: `Barcode ${barcode} for MAA-KU-`, exact: false })).toBeVisible();
  return barcode as string;
}

/** Hardware scanners type fast and press Enter. */
async function scan(page: Page, code: string) {
  await page.keyboard.type(code, { delay: 5 });
  await page.keyboard.press('Enter');
}

test('logged-out visitors go to login; salesmen cannot open admin pages; wrong PIN is refused', async ({ page }) => {
  await page.goto('/pos');
  await expect(page).toHaveURL(/\/login$/);

  await login(page, 'Pradeep', '0000');
  await expect(page.getByText('Wrong PIN. Try again.')).toBeVisible();

  await login(page, 'Pradeep');
  await expect(page).toHaveURL(/\/pos$/);
  await expect(page.getByTestId('current-user')).toContainText('Pradeep · Salesman');
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/pos$/);
  await expect(page.getByRole('link', { name: 'Products' })).toHaveCount(0);
});

test('admin adds a product with a generated barcode, receives stock; salesman sells it on behalf of a colleague', async ({ page }) => {
  await login(page, 'Owner');
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  const barcode = await addProduct(page, { name: `Test Kurta ${run}`, size: 'M', mrp: '1299', price: '1199', stock: '2' });

  await page.getByLabel('Pieces received').fill('3');
  await page.getByRole('button', { name: 'Add stock' }).click();
  await expect(page.getByText('Stock is now 5')).toBeVisible();

  // Nitin sells 2, credited to Vishal.
  await login(page, 'Nitin');
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await scan(page, barcode);
  await expect(page.getByTestId('item-details')).toContainText(`Test Kurta ${run}`);
  await expect(page.getByTestId('details-stock')).toHaveText('5');
  await expect(page.getByTestId('item-details')).not.toContainText('₹500.00'); // no purchase price at the counter
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await expect(page.getByLabel(/Sale price/)).toHaveValue('1199');
  await page.getByLabel('Quantity').fill('2');
  await page.getByLabel(/Sale price/).fill('1100');
  await page.getByLabel('Credit sale to').selectOption({ label: 'Vishal' });
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByRole('status')).toContainText('credited to Vishal (recorded by Nitin). Stock left: 3.');

  await page.goto('/pos/my-sales');
  await expect(page.getByTestId('my-activity')).toContainText(`2 × Test Kurta ${run}`);
  await expect(page.getByTestId('my-activity')).toContainText('credited to Vishal · recorded by Nitin');

  // Above-MRP price and unknown codes are refused.
  await page.goto('/pos');
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await scan(page, barcode);
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await page.getByLabel(/Sale price/).fill('1300');
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByRole('status')).toContainText('cannot be above MRP');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await scan(page, '0000000000000');
  await expect(page.getByRole('status')).toContainText('No item found');
});

test('exchange: return part of a sale for another size; stock and money stay correct', async ({ page }) => {
  await login(page, 'Owner');
  const medium = await addProduct(page, { name: `Swap Kurta ${run}`, size: 'M', mrp: '1500', price: '1500', stock: '3' });
  const large = await addProduct(page, { name: `Swap Kurta ${run}`, size: 'L', mrp: '1600', price: '1600', stock: '2' });

  await login(page, 'Vishal');
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await scan(page, medium);
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await page.getByLabel('Quantity').fill('2');
  await page.getByLabel(/Sale price/).fill('1400');
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByRole('status')).toContainText('Stock left: 1.');

  // Balram processes the exchange of 1 medium for 1 large.
  await login(page, 'Balram');
  await page.goto('/pos/exchange');
  await expect(page.getByLabel('1. Scan the item the customer brought back')).toBeFocused();
  await scan(page, medium);
  const saleRow = page.getByTestId('returnable-sales').getByRole('listitem').first();
  await expect(saleRow).toContainText('sold by Vishal');
  await expect(saleRow).toContainText('2 can be returned');
  await saleRow.getByRole('button', { name: 'Choose' }).click();
  await expect(page.getByLabel('3. Scan the new item the customer is taking')).toBeFocused();
  await scan(page, large);
  await expect(page.getByTestId('exchange-summary')).toContainText('Customer pays ₹200.00');
  await page.getByRole('button', { name: 'Confirm exchange' }).click();
  await expect(page.getByRole('status')).toContainText('Exchange done. Customer pays ₹200.00.');

  // Stock: medium 3 − 2 + 1 = 2, large 2 − 1 = 1.
  await page.goto('/pos');
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await scan(page, medium);
  await expect(page.getByTestId('details-stock')).toHaveText('2');
  await scan(page, large);
  await expect(page.getByTestId('item-details')).toContainText('L');
  await expect(page.getByTestId('details-stock')).toHaveText('1');

  // Admin sees it in the activity log, credited to the original seller.
  await login(page, 'Owner');
  await page.goto('/admin/activity');
  const log = page.getByTestId('activity-log');
  await expect(log).toContainText(`Returned 1 × Swap Kurta ${run} (M) → 1 × Swap Kurta ${run} (L)`);
  await expect(log).toContainText('credited to Vishal · recorded by Balram');
});

test('admin dashboard, staff and labels pages load with seeded data', async ({ page }) => {
  await login(page, 'Owner');
  await expect(page.getByTestId('sales-by-person')).toContainText('Vishal');
  await expect(page.getByTestId('sales-by-person')).toContainText('Balram');
  await page.goto('/admin/staff');
  for (const name of ['Owner', 'Vishal', 'Nitin', 'Pradeep', 'Balram']) {
    await expect(page.getByTestId('staff-list')).toContainText(name);
  }
  await page.goto('/admin/labels');
  await expect(page.getByRole('heading', { name: 'Test labels' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Barcode 8901111000014 for MAA-TS-001' })).toBeVisible();
  await expect(page.getByRole('img', { name: /QR code/ })).toHaveCount(0);
});
