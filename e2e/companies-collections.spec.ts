import { test, expect, type Page } from '@playwright/test';

// Owner's feedback 2026-11-22 (ADR-051): "Companies" everywhere; any company can be deleted after a
// confirmation (its items stay, with no company); the company is optional on items; Home → Collections.
const PIN = '1234';
const run = Date.now().toString(36);

async function loginOwner(page: Page) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByText('Owner', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test('a company with an item is deleted from its page; the item stays with no company; items can be saved with no company', async ({ page }, info) => {
  await loginOwner(page);
  const tag = `${run}${info.project.name[0]}`;
  const company = `Gone Co ${tag}`;
  await page.goto('/admin/suppliers');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Companies');
  await page.getByText('+ Add company').click();
  await page.getByLabel('Company name').fill(company);
  await page.getByRole('button', { name: 'Add company' }).click();

  // New item: with this company, then one with no company at all (optional).
  for (const [name, withCompany] of [[`Kept Kurta ${tag}`, true], [`Free Kurta ${tag}`, false]] as const) {
    await page.goto('/admin/stock/new');
    await page.getByRole('button', { name: /^One item/ }).click();
    await page.getByRole('button', { name: 'Men', exact: true }).click();
    await page.getByRole('button', { name: /^Kurta/ }).click();
    if (withCompany) {
      await page.getByRole('combobox', { name: /^Company/ }).click();
      await page.getByRole('listbox').getByRole('option', { name: company, exact: true }).click();
    }
    await page.getByLabel('Product name').fill(name);
    await page.getByLabel('Sale price (MRP) ₹').fill('999');
    await page.getByTestId('size-cards').getByRole('button').first().click();
    await page.getByTestId('details-form').getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Saved|saved/).first()).toBeVisible();
    await page.keyboard.press('Escape');
  }

  // A bill from this company (its stock entry ticked), like "Fungi" on the live shop.
  await page.goto('/admin/bills/new');
  const form = page.getByTestId('bill-form');
  await form.getByRole('combobox', { name: /^Company/ }).click();
  await page.getByRole('listbox').getByRole('option', { name: company, exact: true }).click();
  await form.getByRole('checkbox', { name: `Kept Kurta ${tag}` }).click();
  await form.getByRole('button', { name: 'Next: check bill' }).click();
  await form.getByRole('button', { name: 'Save bill' }).click();
  await expect(page).toHaveURL(/\/admin\/bills\/[0-9a-f-]{36}$/);
  await page.keyboard.press('Escape');
  const billUrl = page.url();
  const total = await page.getByTestId('bill-detail-total').innerText();

  // The company's page → Delete this company → confirmation (what stays) → back on Companies.
  await page.goto('/admin/suppliers');
  await page.getByTestId('company-search').fill(company);
  await page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(company) }).click();
  await page.getByTestId('delete-company').click();
  const sheet = page.getByTestId('action-sheet');
  await expect(sheet).toHaveAccessibleName('Delete this company?');
  await expect(sheet).toContainText('Its items stay, with no company. Its bills and payments stay as they are, with its name.');
  await sheet.getByTestId('confirm-delete').click();
  await expect(page).toHaveURL(/\/admin\/suppliers\?deleted=/);
  await expect(page.getByTestId('deleted-note')).toContainText('1 company deleted.');
  await expect(page.getByTestId('deleted-note')).toContainText('1 items now have no company. Its bills stay as they are.');
  await page.getByTestId('company-search').fill(company);
  await expect(page.getByTestId('supplier-list')).toHaveCount(0);

  // The bill is unchanged: same total, the company's name marked (deleted).
  await page.goto(billUrl);
  await expect(page.getByTestId('bill-detail-total')).toHaveText(total);
  await expect(page.getByTestId('bill-companies')).toContainText(`${company} (deleted)`);

  // Both items are still there.
  for (const name of [`Kept Kurta ${tag}`, `Free Kurta ${tag}`]) {
    await page.goto(`/admin/products?q=${encodeURIComponent(name)}&show=items`);
    await expect(page.getByTestId('product-list').getByRole('listitem')).toHaveCount(1);
  }
});

test('Home → Collections: items in each, rename in place, delete only an empty one after a confirmation', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'one shared list of collections; the desktop run covers it');
  await loginOwner(page);
  // An empty collection to work with.
  await page.goto('/admin/categories');
  await page.getByText('+ Add collection').click();
  const add = page.locator('details', { hasText: '+ Add collection' });
  await add.getByLabel('Collection name').fill(`Spare ${run}`);
  await add.getByRole('button', { name: 'Add collection' }).click();
  await expect(add.getByRole('status')).toContainText(`Spare ${run} added.`);

  await page.goto('/admin/dashboard');
  const panel = page.getByTestId('home-collections');
  await expect(panel.getByRole('heading', { name: 'Collections' })).toBeVisible();
  const men = panel.getByTestId('collection-row').filter({ has: page.getByRole('textbox', { name: 'Name of Men' }) });
  await expect(men.getByTestId('collection-count')).toContainText(/\d+ items · \d+ pcs/);
  // A collection with items has no Delete.
  await expect(panel.getByRole('button', { name: 'Delete Men' })).toHaveCount(0);

  // Rename the spare one, then delete it (asks first).
  const spare = panel.getByRole('textbox', { name: `Name of Spare ${run}` });
  await spare.fill(`Kids ${run}`);
  await panel.getByRole('button', { name: 'Save' }).click();
  await expect(panel.getByRole('status')).toHaveText('Name saved.');
  await panel.getByRole('button', { name: `Delete Kids ${run}` }).click();
  await expect(page.getByTestId('action-sheet')).toHaveAccessibleName(`Delete Kids ${run}?`);
  await page.getByTestId('confirm-delete-collection').click();
  await expect(panel.getByRole('status')).toHaveText(`Kids ${run} deleted.`);
  await expect(panel.getByRole('textbox', { name: `Name of Kids ${run}` })).toHaveCount(0);
});
