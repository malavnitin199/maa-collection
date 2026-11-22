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
    await page.goto('/admin/companies');
    await page.getByText('+ Add company').click();
    await page.getByLabel('Company name').fill(company);
    await page.getByRole('button', { name: 'Add company' }).click();
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
  // No company yet: the shop's items can be added instead (ADR-060); a company shows its stock entries.
  await expect(form.getByTestId('bill-items')).toBeVisible();
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
  await expect(form.getByTestId('bill-company').nth(0)).toContainText('1 stock entries ticked · ₹1,200.00');
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
  await page.getByRole('button', { name: '+ Add stock entries' }).click();
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

test('a company added from New bill: it is chosen, the "added" card shows, and New item for it is one tap away', async ({ page }) => {
  await loginOwner(page);
  const fresh = `Bill New Co ${run}`;
  await page.goto('/admin/bills/new');
  const form = page.getByTestId('bill-form');
  await form.getByRole('combobox', { name: /^Company/ }).click();
  await page.getByRole('listbox').getByRole('option', { name: '+ New company…' }).click();
  await page.getByLabel('New company name').fill(fresh);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Company added')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(form.getByTestId('bill-company')).toHaveText([new RegExp(`^1${fresh}`)]);
  // Nothing of a new company waits for a bill: say so, and offer New item from it (company already chosen there).
  await expect(form.getByTestId('company-collections-empty')).toContainText('No stock entries of this company are waiting for a bill.');
  await expect(form.getByRole('button', { name: 'Next: check bill' })).toBeDisabled();
  await form.getByRole('link', { name: `+ New item from ${fresh}` }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/new\?supplier=/);
  // It is not offered twice in the bill's company box.
  await page.goto('/admin/bills/new');
  await form.getByRole('combobox', { name: /^Company/ }).click();
  await expect(page.getByRole('listbox').getByRole('option', { name: fresh, exact: true })).toHaveCount(1);
});

test('a bill with no company, from the shop\'s items one by one; it keeps its copy when the item changes (ADR-060)', async ({ page }) => {
  await loginOwner(page);
  const name = `Bill Item ${run}`;
  // An item with no company: sizes M and L, purchase ₹400 (the old form).
  await page.goto('/admin/stock/form');
  await page.getByLabel('Product name').fill(name);
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Sale price (MRP) ₹').fill('999');
  await page.getByLabel('Purchase price ₹', { exact: true }).fill('400');
  await page.getByRole('tab', { name: 'Sizes', exact: true }).click();
  await page.getByRole('button', { name: 'Size M' }).click();
  await page.getByRole('button', { name: 'Size L' }).click();
  await page.getByRole('tab', { name: 'Details', exact: true }).click();
  await page.getByLabel('Pieces each').fill('3');
  await page.getByRole('button', { name: 'Save 2 items' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);

  // New bill, no company: find the item, add M twice and L once.
  await page.goto('/admin/bills/new');
  const form = page.getByTestId('bill-form');
  const search = form.getByLabel('Search an item: name, code or barcode');
  await search.fill(name);
  await form.getByRole('button', { name: `Add ${name} · M` }).click();
  await expect(search).toHaveValue('');
  await form.getByRole('button', { name: `One more: ${name} · M` }).click();
  await search.fill(name);
  await form.getByRole('button', { name: `Add ${name} · L` }).click();
  const lines = form.getByTestId('bill-item-line');
  await expect(lines).toHaveCount(2);
  await expect(lines.first()).toContainText('2 × ₹400.00 = ₹800.00');
  await expect(form.getByTestId('bill-total')).toHaveText('₹1,200.00');
  await expect(form.getByTestId('bill-picked')).toHaveText('2 items · 3 pcs');
  // With items on it, there is no company box; a company would have its stock entries instead.
  await expect(form.getByRole('combobox', { name: /^Company/ })).toHaveCount(0);

  // Check like the paper, then save.
  await form.getByRole('button', { name: 'Next: check bill' }).click();
  await expect(form.getByTestId('bill-party')).toContainText('No company');
  await expect(form.getByTestId('bill-sheet-line')).toHaveCount(2);
  await expect(form.getByTestId('bill-sheet-total')).toHaveText('1,200.00');
  await form.getByLabel('Bill no. (optional)').fill(`IT-${run}`);
  await form.getByRole('button', { name: 'Save bill' }).click();
  await expect(page).toHaveURL(/\/admin\/bills\/[0-9a-f-]{36}$/);
  const billUrl = page.url();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('bill-detail-total')).toHaveText('₹1,200.00');
  await expect(page.getByTestId('bill-no-company')).toHaveText('No company');
  await expect(page.getByTestId('bill-companies')).toHaveCount(0);
  await expect(page.getByTestId('bill-sheet-line')).toHaveCount(2);
  await expect(page.getByTestId('bill-sheet-line').first()).toContainText(name);

  // The item is renamed and repriced afterwards: the bill keeps its own copy.
  await page.goto('/admin/products');
  await page.getByTestId('product-card').filter({ has: page.getByRole('link', { name, exact: true }) }).getByRole('link', { name, exact: true }).click();
  const editor = page.getByTestId('item-editor');
  await editor.getByLabel('Name').fill(`${name} Renamed`);
  await editor.getByLabel('Purchase ₹').fill('450');
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${name} Renamed`);
  await page.goto(billUrl);
  await expect(page.getByTestId('bill-detail-total')).toHaveText('₹1,200.00');
  await expect(page.getByTestId('bill-sheet-line').first()).toContainText(name);
  await expect(page.getByTestId('bill-sheet-line').first()).not.toContainText('Renamed');

  // The Bills list: no company, its items, its total; nothing due.
  await page.goto('/admin/bills');
  const row = page.getByTestId('bill-list').getByRole('link').filter({ hasText: `bill IT-${run}` });
  await expect(row).toContainText('No company');
  await expect(row).toContainText('2 items · 3 pcs');
  await expect(row).toContainText('₹1,200.00');
  await expect(row).not.toContainText('Due');
});
