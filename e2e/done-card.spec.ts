import { test, expect, type Page } from '@playwright/test';

/**
 * The "Done ✓" card after a finished task (owner's feedback 2026-11-20): a
 * company, a category, a payment — with the details; the red card when
 * something was not saved.
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

test('done card: a company with its details, a duplicate shows the red card; a category; a payment with the amount', async ({ page }) => {
  await loginOwner(page);
  const card = page.getByTestId('done-overlay');

  // A company.
  await page.goto('/admin/suppliers');
  await page.getByText('+ Add supplier').click();
  await page.getByLabel('Company name').fill(`Done Mills ${run}`);
  await page.getByLabel(/^Phone/).fill('98765 00000');
  await page.getByLabel(/^Location/).fill('Surat');
  await page.getByRole('button', { name: 'Add supplier' }).click();
  await expect(card).toContainText('Company added');
  await expect(card.getByTestId('done-lines')).toContainText(`NameDone Mills ${run}`);
  await expect(card.getByTestId('done-lines')).toContainText('Phone98765 00000');
  await expect(card.getByTestId('done-lines')).toContainText('LocationSurat');
  await expect(card).toHaveAttribute('data-kind', 'ok');
  await page.keyboard.press('Escape'); // any key or tap closes it (a tap vanishes under the pointer, so tests use a key)
  await expect(card).toBeHidden();

  // The same name again: the red card, clearly different.
  await page.goto('/admin/suppliers');
  await page.getByText('+ Add supplier').click();
  await page.getByLabel('Company name').fill(`Done Mills ${run}`);
  await page.getByRole('button', { name: 'Add supplier' }).click();
  await expect(card).toHaveAttribute('data-kind', 'error');
  await expect(card).toContainText('Not saved');
  await expect(card).toContainText('A supplier with that name already exists.');
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();

  // A category.
  await page.goto('/admin/categories');
  const addCategory = page.locator('details', { hasText: '+ Add category' });
  await addCategory.getByText('+ Add category').click();
  await addCategory.getByLabel('Category name').fill(`Done Type ${run}`);
  await addCategory.getByRole('button', { name: 'Add category' }).click();
  await expect(card).toContainText('Category added');
  await expect(card.getByTestId('done-lines')).toContainText(`NameDone Type ${run}`);
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();

  // A payment on the company's page.
  await page.goto('/admin/suppliers');
  await page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(`Done Mills ${run}`) }).click();
  await page.getByRole('tab', { name: 'Payments', exact: true }).click();
  const form = page.getByTestId('payment-form');
  await form.getByLabel('Amount paid ₹').fill('500');
  await form.getByLabel('Note (optional)').fill('advance');
  await form.getByRole('button', { name: 'Save payment' }).click();
  await expect(card).toContainText('Payment saved');
  await expect(card).toContainText('₹500');
  await expect(card.getByTestId('done-lines')).toContainText('BillRunning account');
  await expect(card.getByTestId('done-lines')).toContainText('Noteadvance');
});
