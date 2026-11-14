import { test, expect, type Page } from '@playwright/test';

const PIN = '1234';
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

async function loginOwner(page: Page) {
  await page.goto('/login');
  await page.getByText('Owner', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test('owner adds a supplier and a category; both show up with details', async ({ page }) => {
  await loginOwner(page);

  await page.goto('/admin/suppliers');
  await page.getByText('+ Add supplier').click();
  await page.getByLabel('Company name').fill(`XYZ Textiles ${run}`);
  await page.getByLabel('Contact person (optional)').fill('Ramesh');
  await page.getByLabel('Phone (optional)').fill('98765 43210');
  await page.getByRole('button', { name: 'Add supplier' }).click();
  await expect(page.getByRole('status')).toContainText(`XYZ Textiles ${run} added.`);
  const supplierCard = page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(`XYZ Textiles ${run}`) });
  await expect(supplierCard).toContainText('Ramesh · 98765 43210');
  await supplierCard.click();
  await expect(page.getByRole('heading', { level: 1, name: `XYZ Textiles ${run}` })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Call 98765 43210' })).toHaveAttribute('href', 'tel:9876543210');

  // Duplicate supplier is refused.
  await page.goto('/admin/suppliers');
  await page.getByText('+ Add supplier').click();
  await page.getByLabel('Company name').fill(`XYZ Textiles ${run}`);
  await page.getByRole('button', { name: 'Add supplier' }).click();
  await expect(page.getByText('A supplier with that name already exists.')).toBeVisible();

  await page.goto('/admin/categories');
  const addCategory = page.locator('details', { hasText: '+ Add category' });
  await addCategory.getByText('+ Add category').click();
  await addCategory.getByLabel('Category name').fill(`Lehenga ${run}`);
  await addCategory.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByRole('status')).toContainText(`Lehenga ${run} added with code`);
  // Wait for the post-save refresh to settle (old and new list can overlap for a moment).
  const list = page.getByTestId('category-list').filter({ hasText: `Lehenga ${run}` });
  await expect(list).toHaveCount(1);
  await expect(list).toContainText('Kurta');
});

test('phone layout: bottom tab bar navigates the admin area', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone-only layout');
  await loginOwner(page);
  const tabs = page.getByRole('navigation', { name: 'Main' });
  await expect(tabs).toBeVisible();
  await tabs.getByRole('link', { name: '+ Stock' }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/new$/);
  await tabs.getByRole('link', { name: 'More' }).click();
  await page.getByRole('link', { name: /^Suppliers/ }).click();
  await expect(page).toHaveURL(/\/admin\/suppliers$/);
  await tabs.getByRole('link', { name: 'More' }).click();
  await page.getByRole('link', { name: /Categories/ }).click();
  await expect(page).toHaveURL(/\/admin\/categories$/);
  await tabs.getByRole('link', { name: 'Products' }).click();
  await expect(page.getByTestId('product-list')).toContainText('Classic Crew Tee');
  await expect(tabs.getByRole('link', { name: 'Products' })).toHaveAttribute('aria-current', 'page');
});

test('owner enters a new design from a supplier in sizes × colours, prints labels; salesman can scan it', async ({ page }) => {
  await loginOwner(page);
  // Supplier for this run.
  await page.goto('/admin/suppliers');
  await page.getByText('+ Add supplier').click();
  await page.getByLabel('Company name').fill(`Design Co ${run}`);
  await page.getByRole('button', { name: 'Add supplier' }).click();
  await expect(page.getByRole('status')).toContainText('added');
  await page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(`Design Co ${run}`) }).click();
  await page.getByRole('link', { name: `+ New items from Design Co ${run}` }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/new\?supplier=/);

  // Supplier preselected, brand defaults to the supplier name.
  await expect(page.getByLabel('Brand')).toHaveValue(`Design Co ${run}`);
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Design / product name').fill(`Chikan Kurta ${run}`);
  await page.getByRole('button', { name: 'Size M' }).click();
  await page.getByRole('button', { name: 'Size L' }).click();
  await page.getByLabel('Colour').fill('Blue, Pink');
  await page.getByRole('button', { name: 'Add colour' }).click();
  await page.getByLabel('MRP (₹)').fill('1499');
  await page.getByLabel('Selling price (₹)').fill('1399');
  await page.getByLabel('Cost price (₹)').fill('800');
  await page.getByLabel('Pieces each').fill('2');
  await page.getByLabel('Supplier bill no. (optional)').fill('INV-42');
  await expect(page.getByTestId('design-preview')).toContainText('4 new items (2 colours × 2 sizes)');
  await expect(page.getByTestId('design-preview')).toContainText('8 pieces in total');
  await page.getByRole('button', { name: 'Save 4 items and print labels' }).click();

  // Labels: one per piece by default (8), or one per item (4).
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  await expect(page.getByText('Saved 4 new items with barcodes.')).toBeVisible();
  await expect(page.getByTestId('receipt-lines')).toContainText(`Chikan Kurta ${run} · Pink · L`);
  const labels = page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode 200/ });
  await expect(labels).toHaveCount(8);
  await page.getByRole('link', { name: 'One per item instead (4)' }).click();
  await expect(labels).toHaveCount(4);
  const barcode = (await labels.first().getAttribute('aria-label'))?.match(/Barcode (\d{13})/)?.[1];
  expect(barcode).toMatch(/^200\d{10}$/);

  // Same entry again is refused (sizes/colours already exist).
  await page.goto('/admin/stock/new');
  await page.getByRole('combobox', { name: /^Supplier/ }).selectOption({ label: `Design Co ${run}` });
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Design / product name').fill(`Chikan Kurta ${run}`);
  await page.getByRole('button', { name: 'Size M' }).click();
  await page.getByLabel('Colour').fill('Blue');
  await page.getByLabel('MRP (₹)').fill('1499');
  await page.getByRole('button', { name: /^Save 1 item/ }).click();
  await expect(page.getByText(/Already in the catalogue: Blue M/)).toBeVisible();

  // A salesman scans the new barcode at the counter.
  await page.goto('/login');
  await page.getByText('Vishal', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await page.keyboard.type(barcode!, { delay: 5 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('item-details')).toContainText(`Chikan Kurta ${run}`);
  await expect(page.getByTestId('details-stock')).toHaveText('2');
  await expect(page.getByTestId('item-details')).toContainText('₹1,399.00');
});
