import { test, expect, type Page } from '@playwright/test';

/**
 * Company accounts (owner's feedback 2026-11-20): the company page shows the
 * figures on top (bills, purchases, dues, pieces, collections), a period, and
 * tabs Bills · Payments · Products · By type · Details; a payment closes a bill.
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

test('company page: figures, bills by number, a payment closes the bill, dues, location, period', async ({ page }) => {
  await loginOwner(page);
  const name = `Surat Silks ${run}`;

  // A company with a location.
  await page.goto('/admin/suppliers');
  await page.getByText('+ Add supplier').click();
  await page.getByLabel('Company name').fill(name);
  await page.getByLabel(/^Location/).fill('Surat');
  await page.getByRole('button', { name: 'Add supplier' }).click();
  await expect(page.getByRole('status')).toContainText('added');
  await page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(name) }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByRole('paragraph').filter({ hasText: /^Surat/ })).toBeVisible(); // location under the name
  const companyUrl = page.url();

  // Nothing bought yet: 0 bills, no dues; the Payments tab records money anyway (an advance).
  await expect(page.getByTestId('company-bills-count')).toHaveText('0');
  await expect(page.getByTestId('company-dues')).toHaveText('₹0.00');
  await expect(page.getByRole('tab', { name: 'Bills', exact: true })).toHaveAttribute('aria-selected', 'true');

  // A bill through the old form (sizes × colours): 2 sizes × 1 colour × 3 pieces at ₹400 purchase = ₹2,400, bill no. INV-<run>.
  await page.getByRole('link', { name: `+ New item from ${name}` }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/new\?supplier=/);
  await page.goto(page.url().replace('/admin/stock/new', '/admin/stock/form'));
  await page.getByLabel('Product name').fill(`Chikan Kurta ${run}`);
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Sale price (MRP) ₹').fill('1299');
  await page.getByLabel('Purchase price ₹', { exact: true }).fill('400');
  await page.getByRole('tab', { name: 'Colours', exact: true }).click();
  await page.getByRole('button', { name: 'Size M' }).click();
  await page.getByRole('button', { name: 'Size L' }).click();
  await page.getByLabel('Colour', { exact: true }).fill('Blue');
  await page.getByRole('button', { name: 'Add colour' }).click();
  await page.getByRole('tab', { name: 'Details', exact: true }).click();
  await page.getByLabel('Pieces each').fill('3');
  await page.getByLabel('Supplier bill no. (optional)').fill(`INV-${run}`);
  await page.getByRole('button', { name: 'Save 2 items' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);

  // The figures.
  await page.goto(companyUrl);
  await expect(page.getByTestId('company-bills-count')).toHaveText('1');
  await expect(page.getByTestId('company-purchases')).toHaveText('₹2,400.00');
  await expect(page.getByTestId('company-dues')).toHaveText('₹2,400.00');
  await expect(page.getByTestId('company-pieces')).toHaveText('6');
  await expect(page.getByTestId('company-collections')).toHaveText('1');
  const bill = page.getByTestId('company-bills').locator('li').first();
  await expect(bill).toContainText(`bill INV-${run}`);
  await expect(bill).toContainText('2 items · 6 pcs · purchase ₹2,400.00');
  await expect(bill).toContainText('Due ₹2,400.00');

  // Part payment against the bill from the Payments tab; then Mark paid closes it.
  await page.getByRole('tab', { name: 'Payments', exact: true }).click();
  const form = page.getByTestId('payment-form');
  await form.getByLabel('Amount paid ₹').fill('1000');
  await form.getByLabel('For bill no.').selectOption({ label: `INV-${run} · ₹2400` });
  await form.getByLabel('Note (optional)').fill('cash');
  await form.getByRole('button', { name: 'Save payment' }).click();
  await expect(page.getByRole('status')).toContainText('Payment saved.');
  await expect(page.getByTestId('company-payments')).toContainText('₹1,000.00');
  await expect(page.getByTestId('company-dues')).toHaveText('₹1,400.00');
  await page.getByRole('tab', { name: 'Bills', exact: true }).click();
  await expect(bill).toContainText('Due ₹1,400.00');
  await bill.getByRole('button', { name: 'Mark paid' }).click();
  await expect(bill).toContainText('Paid');
  await expect(bill).not.toContainText('Due ₹');
  await expect(page.getByTestId('company-dues')).toHaveText('₹0.00');
  await expect(page.getByTestId('company-bills-count')).toHaveText('1');
  await expect(page.getByTestId('company-figures')).toContainText('0 open · 1 paid');

  // By type and Products tabs.
  await page.getByRole('tab', { name: 'By type', exact: true }).click();
  await expect(page.getByTestId('company-types')).toContainText('Kurta');
  await page.getByRole('tab', { name: 'Products', exact: true }).click();
  await expect(page.getByTestId('company-designs')).toContainText(`Chikan Kurta ${run}`);

  // A period with no bills in it.
  await page.goto(`${companyUrl}?period=custom&from=2020-01-01&to=2020-01-31`);
  await expect(page.getByTestId('company-bills-count')).toHaveText('0');
  await expect(page.getByRole('tabpanel', { name: 'Bills' }).getByText('No bills in this period.')).toBeVisible();
  await expect(page.getByTestId('company-dues')).toHaveText('₹0.00'); // dues are all-time
  await page.getByRole('link', { name: 'All time' }).click();
  await expect(page.getByTestId('company-bills-count')).toHaveText('1');

  // The companies list shows bills and dues.
  await page.goto('/admin/suppliers');
  await expect(page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(name) })).toContainText('1 bills · dues ₹0.00');
});
