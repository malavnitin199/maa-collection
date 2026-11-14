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
  await tabs.getByRole('link', { name: 'Suppliers' }).click();
  await expect(page).toHaveURL(/\/admin\/suppliers$/);
  await tabs.getByRole('link', { name: 'More' }).click();
  await page.getByRole('link', { name: /Categories/ }).click();
  await expect(page).toHaveURL(/\/admin\/categories$/);
  await tabs.getByRole('link', { name: 'Products' }).click();
  await expect(page.getByTestId('product-list')).toContainText('Classic Crew Tee');
  await expect(tabs.getByRole('link', { name: 'Products' })).toHaveAttribute('aria-current', 'page');
});
