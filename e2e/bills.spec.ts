import { test, expect, type Page } from '@playwright/test';

/**
 * Bills section (owner's feedback 2026-11-21): a bill names one or more
 * companies (listed one under the other) and the collections it covers; the
 * amount is worked out from them; the Bills
 * page lists them; Home has one Bills line.
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

async function addCollection(page: Page, company: string, name: string) {
  await page.goto('/admin/stock/new');
  await page.getByRole('button', { name: /^Many items/ }).click();
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  await page.getByRole('button', { name: /^Kurta/ }).click();
  const box = page.getByRole('combobox', { name: /^Company/ });
  await box.click();
  await page.getByRole('listbox').getByRole('option', { name: company, exact: true }).click();
  await page.getByLabel('Product name').fill(name);
  await page.getByLabel('Sale price (MRP) ₹').fill('999');
  await page.getByLabel('Purchase price ₹').fill('300');
  await page.getByRole('button', { name: 'All sizes' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.keyboard.press('Escape');
}

test('a bill with two companies and two collections; take one off and add it back; delete a bill', async ({ page }) => {
  await loginOwner(page);
  const a = `Bill Co A ${run}`;
  const b = `Bill Co B ${run}`;
  for (const company of [a, b]) {
    await page.goto('/admin/suppliers');
    await page.getByText('+ Add supplier').click();
    await page.getByLabel('Company name').fill(company);
    await page.getByRole('button', { name: 'Add supplier' }).click();
    await expect(page.getByRole('status')).toContainText(`${company} added.`);
  }
  await addCollection(page, a, `Jeans One ${run}`);
  await addCollection(page, b, `Jeans Two ${run}`);

  // Home → Bills → + New bill. Companies one after another, listed one under the other; no amount to type.
  await page.goto('/admin/dashboard');
  await expect(page.getByTestId('home-bills')).toBeVisible();
  await page.getByTestId('home-bills').click();
  await page.getByRole('link', { name: '+ New bill' }).click();
  const form = page.getByTestId('bill-form');
  await expect(form.getByText('Choose a company to see its collections.')).toBeVisible();
  await expect(form.getByLabel(/amount/i)).toHaveCount(0);
  for (const company of [a, b]) {
    await form.getByRole('combobox', { name: /^(Company|Add another company)/ }).click();
    await page.getByRole('listbox').getByRole('option', { name: company, exact: true }).click();
  }
  await expect(form.getByTestId('bill-company')).toHaveText([new RegExp(`^1${a}`), new RegExp(`^2${b}`)]);
  // Each company's waiting collections sit under its name.
  const groups = form.getByTestId('company-collections-group');
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(0)).toContainText(`Jeans One ${run}`);
  await expect(groups.nth(1)).toContainText(`Jeans Two ${run}`);
  for (const name of [`Jeans One ${run}`, `Jeans Two ${run}`]) await form.getByRole('checkbox', { name }).click();
  // 4 sizes × 1 pc × ₹300 each = ₹1,200 a company; ₹2,400 the bill.
  await expect(form.getByTestId('bill-company').nth(0)).toContainText('1 collections ticked · ₹1,200.00');
  await expect(form.getByTestId('bill-total')).toHaveText('₹2,400.00');

  // Step 2: the bill laid out like the paper — party, bill no., date, S.N · goods · qty · rate · amount, total.
  await form.getByRole('button', { name: 'Next: check bill' }).click();
  await expect(form).toHaveAttribute('data-step', 'check');
  await expect(form.getByTestId('bill-party')).toContainText(`${a}, ${b}`);
  const sheet = form.getByTestId('bill-sheet');
  await expect(sheet.locator('thead').getByRole('columnheader')).toHaveText(['S.N', 'Description', 'Qty', 'Rate', 'Amount (₹)']);
  await expect(sheet.getByTestId('bill-sheet-part')).toHaveCount(2);
  await expect(sheet.getByTestId('bill-sheet-line').first()).toHaveText(new RegExp(`^1\\.Jeans One ${run}.*4300\\.001,200\\.00$`));
  await expect(sheet.getByTestId('bill-sheet-units')).toHaveText('8');
  await expect(sheet.getByTestId('bill-sheet-total')).toHaveText('2,400.00');
  // The phone's back button goes back to ticking (nothing lost), then Next again.
  await page.goBack();
  await expect(form).toHaveAttribute('data-step', 'pick');
  await expect(form.getByRole('checkbox', { name: `Jeans Two ${run}` })).toHaveAttribute('aria-checked', 'true');
  await form.getByRole('button', { name: 'Next: check bill' }).click();
  await form.getByLabel('Bill no. (optional)').fill(`JB-${run}`);
  await form.getByLabel('Bill date').fill('2026-11-01'); // backdated
  await form.getByRole('button', { name: 'Save bill' }).click();
  await expect(page).toHaveURL(/\/admin\/bills\/[0-9a-f-]{36}$/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`bill JB-${run}`);
  await expect(page.getByTestId('bill-sheet').getByTestId('bill-sheet-line')).toHaveCount(2);
  await expect(page.getByTestId('bill-detail-total')).toHaveText('₹2,400.00');
  await expect(page.getByTestId('bill-companies')).toContainText(a);
  await expect(page.getByTestId('bill-companies')).toContainText('₹1,200.00');
  await expect(page.getByTestId('bill-collection-list').locator('li')).toHaveCount(2);

  // Take one off, then add it back.
  await page.getByRole('button', { name: `Take Jeans Two ${run} off this bill` }).click();
  await expect(page.getByTestId('bill-collection-list').locator('li')).toHaveCount(1);
  await expect(page.getByTestId('bill-detail-total')).toHaveText('₹1,200.00'); // the amount follows the collections
  await page.getByRole('button', { name: '+ Add collections' }).click();
  await page.getByTestId('add-collections').getByRole('checkbox', { name: `Jeans Two ${run}` }).click();
  await page.getByRole('button', { name: 'Add 1 to this bill' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('bill-collection-list').locator('li')).toHaveCount(2);
  await expect(page.getByTestId('bill-detail-total')).toHaveText('₹2,400.00');
  const billUrl = page.url();

  // The Bills list shows it with both companies and what is due.
  await page.goto('/admin/bills');
  const row = page.getByTestId('bill-list').getByRole('link').filter({ hasText: `JB-${run}` });
  await expect(row).toContainText(`${a}, ${b}`);
  await expect(row).toContainText('Due ₹2,400.00');

  // A second bill (a new collection of company A) can be deleted after a confirmation; its collection waits again.
  await addCollection(page, a, `Jeans Three ${run}`);
  await page.goto('/admin/bills/new');
  await form.getByRole('combobox', { name: /^Company/ }).click();
  await page.getByRole('listbox').getByRole('option', { name: a, exact: true }).click();
  await form.getByRole('checkbox', { name: `Jeans Three ${run}` }).click();
  await form.getByRole('button', { name: 'Next: check bill' }).click();
  await form.getByRole('button', { name: 'Save bill' }).click();
  await expect(page).toHaveURL(/\/admin\/bills\/[0-9a-f-]{36}$/);
  await expect(page).not.toHaveURL(billUrl);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Delete bill' }).click();
  await page.getByTestId('confirm-delete-bill').click();
  await expect(page).toHaveURL(/\/admin\/bills$/);
  await expect(page.getByTestId('bill-list')).toContainText(`JB-${run}`);
});
