import { test, expect, type Page } from '@playwright/test';

/**
 * Company accounts (owner's feedback 2026-11-20; real bills 2026-11-21): the
 * company page shows the figures on top (bills, billed, dues, pieces,
 * collections), a period, and tabs Bills · Collections · Payments · Products ·
 * By type · Details; a collection is not a bill; a bill made in the Bills
 * section carries the dues; a payment closes it.
 * Companies page (2026-11-21): search, Location dropdown, Summary folded; Home
 * has one small Companies line.
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

test('company page: a collection is not a bill; a bill from the Bills section carries the dues; payments close it; location, period', async ({ page }) => {
  await loginOwner(page);
  const name = `Surat Silks ${run}`;

  // A company with a location.
  await page.goto('/admin/companies');
  await page.getByText('+ Add company').click();
  await page.getByLabel('Company name').fill(name);
  await page.getByLabel(/^Location/).fill('Surat');
  await page.getByLabel(/^Working since/).fill('2019-04-01'); // backdated: before the app existed
  await page.getByRole('button', { name: 'Add company' }).click();
  await expect(page.getByRole('status')).toContainText('added');
  await page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(name) }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByRole('paragraph').filter({ hasText: /^Surat/ })).toBeVisible(); // location under the name
  const companyUrl = page.url();

  // Nothing bought yet: 0 bills, no dues; the Payments tab records money anyway (an advance).
  await expect(page.getByTestId('company-bills-count')).toHaveText('0');
  await expect(page.getByTestId('company-dues')).toHaveText('₹0.00');
  await expect(page.getByRole('tab', { name: 'Bills', exact: true })).toHaveAttribute('aria-selected', 'true');

  // A bill through the old form (sizes): 2 sizes × 3 pieces at ₹400 purchase = ₹2,400, bill no. INV-<run>.
  await page.getByRole('link', { name: `+ New item from ${name}` }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/new\?supplier=/);
  await page.goto(page.url().replace('/admin/stock/new', '/admin/stock/form'));
  await page.getByLabel('Product name').fill(`Chikan Kurta ${run}`);
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Sale price (MRP) ₹').fill('1299');
  await page.getByLabel('Purchase price ₹', { exact: true }).fill('400');
  await page.getByRole('tab', { name: 'Sizes', exact: true }).click();
  await page.getByRole('button', { name: 'Size M' }).click();
  await page.getByRole('button', { name: 'Size L' }).click();
  await page.getByRole('tab', { name: 'Details', exact: true }).click();
  await page.getByLabel('Pieces each').fill('3');
  await page.getByLabel('Company bill no. (optional)').fill(`INV-${run}`);
  await page.getByRole('button', { name: 'Save 2 items' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);

  // The figures: a collection is not a bill (owner, 2026-11-21) — nothing billed or due yet.
  await page.goto(companyUrl);
  await expect(page.getByTestId('company-bills-count')).toHaveText('0');
  await expect(page.getByTestId('company-purchases')).toHaveText('₹0.00');
  await expect(page.getByTestId('company-dues')).toHaveText('₹0.00');
  await expect(page.getByTestId('company-pieces')).toHaveText('6');
  await expect(page.getByTestId('company-collections')).toHaveText('1');
  await expect(page.getByTestId('company-figures')).toContainText('value ₹2,400.00');
  // Details: the owner's working-since day and the day it was added here are two different things.
  await page.getByRole('tab', { name: 'Details', exact: true }).click();
  const details = page.getByRole('tabpanel', { name: 'Details' });
  await expect(details).toContainText('Working since');
  await expect(details).toContainText('1 Apr 2019');
  await expect(details).toContainText('Added on');
  await expect(details).not.toContainText('Added on 1 Apr 2019');
  await page.getByRole('tab', { name: 'Stock entries', exact: true }).click();
  const delivery = page.getByTestId('company-collections-list').locator('li').first();
  await expect(delivery).toContainText(`ref INV-${run}`);
  await expect(delivery).toContainText('2 items · 6 pcs · purchase ₹2,400.00');
  await expect(delivery).toContainText('No bill yet');

  // The bill, from Home → Bills → + New bill: this company, this collection ticked — the amount is worked out (₹2,400).
  await page.goto('/admin/dashboard');
  await page.getByTestId('home-bills').click();
  await expect(page).toHaveURL(/\/admin\/bills$/);
  await page.getByRole('link', { name: '+ New bill' }).click();
  const billForm = page.getByTestId('bill-form');
  await billForm.getByRole('combobox', { name: /^Company/ }).click();
  await page.getByRole('listbox').getByRole('option', { name, exact: true }).click();
  await expect(billForm.getByTestId('bill-company')).toContainText(name);
  await billForm.getByRole('checkbox', { name: `Chikan Kurta ${run}` }).click();
  await expect(billForm.getByRole('checkbox', { name: `Chikan Kurta ${run}` })).toHaveAttribute('aria-checked', 'true');
  await expect(billForm.getByTestId('bill-total')).toHaveText('₹2,400.00');
  await expect(billForm.getByTestId('bill-company')).toContainText('1 stock entries ticked · ₹2,400.00');
  await billForm.getByRole('button', { name: 'Next: check bill' }).click();
  await billForm.getByLabel('Bill no. (optional)').fill(`INV-${run}`);
  await billForm.getByRole('button', { name: 'Save bill' }).click();
  await expect(page).toHaveURL(/\/admin\/bills\/[0-9a-f-]{36}$/);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('bill-detail-total')).toHaveText('₹2,400.00');
  await expect(page.getByTestId('bill-collection-list')).toContainText(`Chikan Kurta ${run}`);

  // Back on the company: 1 bill, billed and due ₹2,400; the collection is on a bill.
  await page.goto(companyUrl);
  await expect(page.getByTestId('company-bills-count')).toHaveText('1');
  await expect(page.getByTestId('company-purchases')).toHaveText('₹2,400.00');
  await expect(page.getByTestId('company-dues')).toHaveText('₹2,400.00');
  const bill = page.getByTestId('company-bills').locator('li').first();
  await expect(bill).toContainText(`bill INV-${run}`);
  await expect(bill).toContainText('Due ₹2,400.00');
  await page.getByRole('tab', { name: 'Stock entries', exact: true }).click();
  await expect(delivery).toContainText('on a bill');

  // Part payment against the bill from the Payments tab; then Mark paid closes it.
  await page.getByRole('tab', { name: 'Payments', exact: true }).click();
  const form = page.getByTestId('payment-form');
  await form.getByLabel('Amount paid ₹').fill('1000');
  await form.getByLabel('For bill no.').selectOption({ index: 1 });
  await form.getByLabel('Note (optional)').fill('cash');
  await form.getByRole('button', { name: 'Save payment' }).click();
  await expect(page.getByRole('status')).toContainText('Payment saved.');
  await expect(page.getByTestId('company-payments')).toContainText('₹1,000.00');
  await expect(page.getByTestId('company-payments')).toContainText(`bill INV-${run}`);
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
  await page.goto('/admin/companies');
  await expect(page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(name) })).toContainText('1 bills · dues ₹0.00');

  // The Companies page: search (by place too), the Location dropdown, the folded Summary.
  await page.getByTestId('company-search').fill('surat');
  await expect(page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(name) })).toBeVisible();
  await page.getByTestId('company-search').fill(`no such company ${run}`);
  await expect(page.getByText('No company matches.')).toBeVisible();
  await page.getByTestId('company-search').fill('');
  await page.getByTestId('company-location').selectOption('Surat');
  await expect(page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(name) })).toBeVisible();
  await expect(page.getByTestId('company-summary')).toHaveCount(0);
  await page.getByRole('button', { name: /^Summary/ }).click();
  await expect(page.getByTestId('company-summary').getByText('Total spend')).toBeVisible();

  // Home: one small Companies line that opens the Companies page.
  await page.goto('/admin/dashboard');
  await expect(page.getByTestId('home-companies-line')).toContainText(/\d+ companies/);
  await page.getByTestId('home-companies').click();
  await expect(page).toHaveURL(/\/admin\/companies$/);
});
