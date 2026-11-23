import { test, expect, type Page } from '@playwright/test';
import { addToBill, billEditor, chooseBillCompany, openMore, openProduct, productCard } from './products';

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
  // The page lives at /admin/companies; an old /admin/suppliers link lands there.
  await page.goto('/admin/suppliers');
  await expect(page).toHaveURL(/\/admin\/companies$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Companies');
  await page.getByText('+ Add company').click();
  await page.getByLabel('Company name').fill(company);
  await page.getByRole('button', { name: 'Add company' }).click();

  // New item: with this company, then one with no company at all (optional).
  for (const [name, withCompany] of [[`Kept Kurta ${tag}`, true], [`Free Kurta ${tag}`, false]] as const) {
    await page.goto('/admin/stock/new');
    await page.getByRole('button', { name: 'Men', exact: true }).click();
    await page.getByRole('button', { name: /^Kurta/ }).click();
    if (withCompany) {
      await page.getByRole('combobox', { name: /^Company/ }).click();
      await page.getByRole('listbox').getByRole('option', { name: company, exact: true }).click();
    }
    await page.getByLabel('Product name').fill(name);
    await page.getByLabel('Sale price', { exact: true }).fill('999');
    await openMore(page);
    await page.getByTestId('size-cards').getByRole('button').first().click();
    await page.getByTestId('details-form').getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Saved|saved/).first()).toBeVisible();
    await page.keyboard.press('Escape');
  }

  // A bill from this company (its item on it), like "Fungi" on the live shop.
  await page.goto('/admin/bills/new');
  const form = billEditor(page);
  await chooseBillCompany(page, company);
  await addToBill(page, `Kept Kurta ${tag}`);
  await form.getByRole('button', { name: 'Next: check bill' }).click();
  await form.getByRole('button', { name: 'Save bill' }).click();
  await expect(page).toHaveURL(/\/admin\/bills\/[0-9a-f-]{36}$/);
  await page.keyboard.press('Escape');
  const billUrl = page.url();
  const total = await page.getByTestId('bill-detail-total').innerText();

  // The company's page → Delete this company → confirmation (what stays) → back on Companies.
  await page.goto('/admin/companies');
  await page.getByTestId('company-search').fill(company);
  await page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(company) }).click();
  await page.getByTestId('delete-company').click();
  const sheet = page.getByTestId('action-sheet');
  await expect(sheet).toHaveAccessibleName('Delete this company?');
  await expect(sheet).toContainText('Its items stay, with no company. Its bills and payments stay as they are, with its name.');
  await sheet.getByTestId('confirm-delete').click();
  await expect(page).toHaveURL(/\/admin\/companies\?deleted=/);
  await expect(page.getByTestId('deleted-note')).toContainText('1 company deleted.');
  await expect(page.getByTestId('deleted-note')).toContainText('1 items now have no company. Its bills stay as they are.');
  await page.getByTestId('company-search').fill(company);
  await expect(page.getByTestId('supplier-list')).toHaveCount(0);

  // The bill is unchanged: same total, the company's name marked (deleted).
  await page.goto(billUrl);
  await expect(page.getByTestId('bill-detail-total')).toHaveText(total);
  await expect(page.getByTestId('bill-companies')).toContainText(`${company} (deleted)`);

  // Both items are still there; the kept one has no company now (N/A).
  await page.goto('/admin/products');
  for (const name of [`Kept Kurta ${tag}`, `Free Kurta ${tag}`]) await expect(productCard(page, name)).toHaveCount(1);
  await openProduct(page, `Kept Kurta ${tag}`); // the company is on the product page (ADR-070)
  await expect(page.getByTestId('item-company').filter({ visible: true })).toHaveText('N/A');
});

test('Home → Collections opens Categories: figures, products per collection, Jeans and Shirt locked, the others edited and deleted (ADR-066)', async ({ page }, info) => {
  await loginOwner(page);
  const tag = `${run}${info.project.name[0]}`;
  // Home: one line like Companies and Bills.
  const line = page.getByTestId('home-collections');
  await expect(line).toContainText('Collections');
  await expect(page.getByTestId('home-collections-line')).toHaveText(/^\d+ collections? · \d+ categor(y|ies) · \d+ products?$/);
  await line.click();
  await expect(page).toHaveURL(/\/admin\/categories$/);
  await expect(page.getByTestId('section-tiles').getByRole('link').first()).toContainText(/^Men\d+ products?$/);
  const figures = page.getByTestId('collection-figures');
  await expect(figures).toHaveAccessibleName('Figures of Men');
  for (const box of ['fig-categories', 'fig-products', 'fig-pieces']) await expect(figures.getByTestId(box)).toHaveText(/^\d+$/);
  await expect(figures.getByTestId('fig-value')).toHaveText(/^₹[\d,]+$/);

  const list = page.getByTestId('category-list');
  const row = (name: string) => list.getByTestId('category-row').filter({ hasText: new RegExp(`^${name}`) });
  // Jeans and Shirt carry a lock: no ✎, no 🗑.
  for (const fixed of ['Jeans', 'Shirt']) {
    await expect(row(fixed)).toHaveAttribute('data-fixed', 'true');
    await expect(list.getByRole('button', { name: `Edit ${fixed}`, exact: true })).toHaveCount(0);
    await expect(list.getByRole('button', { name: `Delete ${fixed}`, exact: true })).toHaveCount(0);
  }
  // T-Shirt has the demo tee: its figures, and 🗑 says it still has items.
  await expect(row('T-Shirt').getByTestId('category-figures')).toHaveText(/^\d+ products? · [1-9]\d* items? · \d+ pcs?/);
  await list.getByRole('button', { name: 'Delete T-Shirt', exact: true }).click();
  const sheet = page.getByTestId('action-sheet');
  await expect(sheet).toContainText(/T-Shirt still has \d+ items\. Delete them first\./);
  await expect(page.getByTestId('confirm-delete-category')).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Cancel' }).click();

  // A new, empty one: ✎ renames it; 🗑 asks first, then it is gone.
  await page.getByText('+ Add category').click();
  const add = page.locator('details', { hasText: '+ Add category' });
  await add.getByLabel('Category name').fill(`Spare Type ${tag}`);
  await add.getByRole('button', { name: 'Add category' }).click();
  await expect(add.getByRole('status')).toContainText(`Spare Type ${tag} added`);
  await page.keyboard.press('Escape');
  await list.getByRole('button', { name: `Edit Spare Type ${tag}`, exact: true }).click();
  const spare = row(`Spare Type ${tag}`);
  await spare.getByLabel('Category name').fill(`Bibs ${tag}`);
  await spare.getByRole('button', { name: 'Save category' }).click();
  await expect(list.getByRole('button', { name: `Delete Bibs ${tag}`, exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await list.getByRole('button', { name: `Delete Bibs ${tag}`, exact: true }).click();
  await expect(sheet).toHaveAccessibleName(`Delete Bibs ${tag}?`);
  await page.getByTestId('confirm-delete-category').click();
  await expect(page.getByTestId('done-overlay')).toContainText(`Bibs ${tag} deleted.`);
  await page.keyboard.press('Escape');
  await expect(row(`Bibs ${tag}`)).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('category-list').getByText(`Bibs ${tag}`)).toHaveCount(0);
});
