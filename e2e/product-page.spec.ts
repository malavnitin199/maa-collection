import { test, expect, type Locator, type Page } from '@playwright/test';

/** The company box is a compact dropdown (2026-11-21), not a <select>: open it and tap the name. */
async function choose(box: Locator, label: string) {
  await box.click();
  await box.page().getByRole('listbox').getByRole('option', { name: label, exact: true }).click();
}

/**
 * The item page (owner's feedback 2026-11-22, ADR-059): every detail of the product on one
 * short screen — photo, name, coloured labels — and one editor for the whole design: name,
 * company, category, prices, each size's pieces (− / +), new sizes; one Save. No figures,
 * tabs, history or photo manager any more; Print tag, Hide, More (For / Age) and Delete stay.
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

test('item page: every detail on one screen; one Save changes name, prices, pieces and adds a size', async ({ page }) => {
  await loginOwner(page);
  const name = `Figure Kurta ${run}`;
  // A design through the old form: 2 sizes × 3 pieces at ₹400 purchase.
  await page.goto('/admin/stock/form');
  await page.getByLabel('Product name').fill(name);
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await choose(page.getByRole('combobox', { name: /^Company/ }), 'Shree Ganesh Textiles');
  await page.getByLabel('Sale price (MRP) ₹').fill('1299');
  await page.getByLabel('Purchase price ₹', { exact: true }).fill('400');
  await page.getByRole('tab', { name: 'Sizes', exact: true }).click();
  await page.getByRole('button', { name: 'Size M' }).click();
  await page.getByRole('button', { name: 'Size L' }).click();
  await page.getByRole('tab', { name: 'Details', exact: true }).click();
  await page.getByLabel('Pieces each').fill('3');
  await page.getByRole('button', { name: 'Save 2 items' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  await page.getByTestId('receipt-lines').getByRole('link').first().click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}/);

  // Everything on one screen: the coloured labels, then the editor with today's values.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  const chips = page.getByTestId('item-chips');
  await expect(chips.getByRole('link', { name: 'Shree Ganesh Textiles' })).toBeVisible();
  await expect(chips).toContainText('Kurta');
  await expect(chips).toContainText('Items: 2');
  await expect(page.getByTestId('item-pieces')).toHaveText('6 pcs');
  await expect(page.getByTestId('item-photo-na')).toHaveText('N/A');
  const editor = page.getByTestId('item-editor');
  await expect(editor.getByLabel('Name')).toHaveValue(name);
  await expect(editor.getByRole('button', { name: 'Type in Hindi' })).toBeVisible(); // Hindi or English (ADR-036)
  await expect(editor.getByLabel('MRP ₹')).toHaveValue('1299');
  await expect(editor.getByLabel('Selling ₹')).toHaveValue('1299');
  await expect(editor.getByLabel('Purchase ₹')).toHaveValue('400');
  const sizes = editor.getByTestId('size-row');
  await expect(sizes).toHaveCount(2);
  await expect(sizes.nth(0)).toContainText('M');
  await expect(editor.getByLabel('Pieces of M')).toHaveValue('3');
  // Gone: figures, tabs, history; still here: Print tag, Hide, More, Delete.
  await expect(page.getByTestId('product-figures')).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Print label' })).toBeVisible();
  await expect(page.getByTestId('item-hide')).toHaveText('Hide');
  await expect(page.getByTestId('item-more')).toContainText('More');
  await expect(page.getByTestId('delete-item')).toBeVisible();

  // One Save: a new name and prices for every size, M one more piece, L counted 1, a new size XL with 2.
  await editor.getByLabel('Name').fill(`${name} Long`);
  await editor.getByLabel('MRP ₹').fill('1399');
  await editor.getByLabel('Selling ₹').fill('1350');
  await editor.getByRole('button', { name: 'One more: M' }).click();
  await expect(editor.getByLabel('Pieces of M')).toHaveValue('4');
  await editor.getByLabel('Pieces of L').fill('1');
  await editor.getByRole('button', { name: '+ Add size' }).click();
  await editor.getByLabel('New size', { exact: true }).fill('XL');
  await editor.getByRole('button', { name: 'One more: XL' }).click();
  await editor.getByRole('button', { name: 'Save changes' }).click();
  const done = page.getByTestId('done-overlay');
  await expect(done).toContainText('Saved');
  await expect(done).toContainText('Pieces corrected for 2 sizes');
  await expect(done).toContainText('1 new size added');
  await page.keyboard.press('Escape');

  // The page shows the saved figures.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${name} Long`);
  await expect(chips).toContainText('Items: 3');
  await expect(page.getByTestId('item-pieces')).toHaveText('7 pcs'); // 4 + 1 + 2
  await expect(sizes).toHaveCount(3);
  await expect(editor.getByLabel('Pieces of XL')).toHaveValue('2');
  await expect(editor.getByLabel('MRP ₹')).toHaveValue('1399');
  await expect(editor.getByLabel('Selling ₹')).toHaveValue('1350');

  // Selling above MRP is refused with a message; nothing changes.
  await editor.getByLabel('Selling ₹').fill('1500');
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(editor.getByRole('alert')).toContainText('Selling price would be above MRP');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(editor.getByLabel('Selling ₹')).toHaveValue('1350');
});
