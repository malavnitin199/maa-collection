import { test, expect, type Page } from '@playwright/test';

/**
 * Typing in Hindi or English (owner's feedback 2026-11-20): every name / note box
 * has अ / A (switch the script for this phone), ⇄ (change what is typed), and a
 * microphone (voice) where the browser supports it.
 */
const PIN = '1234';

async function loginOwner(page: Page) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByText('Owner', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test('New item: type a name in Hindi from English letters, change it back, the choice follows to other boxes', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/admin/stock/new');
  await page.getByRole('button', { name: /^Many items/ }).click();
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  await page.getByRole('button', { name: /^Kurta/ }).click();

  const name = page.getByLabel('Product name');
  await page.getByRole('button', { name: 'Type in Hindi' }).first().click();
  await name.pressSequentially('chikan kurta ');
  await expect(name).toHaveValue('चिकन कुर्ता ');
  await expect(name).toHaveAttribute('lang', 'hi');
  // A word still being typed changes when the box loses focus.
  await name.pressSequentially('blue');
  await page.getByLabel('Sale price (MRP) ₹').click();
  await expect(name).toHaveValue('चिकन कुर्ता ब्लू');

  // ⇄ changes what is typed to English letters and switches the script back.
  await page.getByRole('button', { name: 'Change to English' }).first().click();
  await expect(name).toHaveValue('Chikan Kurta Blue');
  await expect(name).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Type in Hindi' }).first()).toBeVisible();

  // The choice is for the whole phone: the brand box (under More) follows it.
  await page.getByRole('button', { name: 'Type in Hindi' }).first().click();
  await page.goto('/admin/suppliers');
  await page.getByText('+ Add supplier').click();
  const company = page.getByLabel('Company name');
  await expect(company).toHaveAttribute('lang', 'hi');
  await company.pressSequentially('surat silks ');
  await expect(company).toHaveValue('सूरत सिल्क्स ');
  // Back to English for the other tests on this browser.
  await page.getByRole('button', { name: 'Type in English' }).first().click();
  await expect(company).toHaveAttribute('lang', 'en');
});
