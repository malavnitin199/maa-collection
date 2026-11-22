import { test, expect, type Locator, type Page } from '@playwright/test';

/** The company box is a compact dropdown (2026-11-21), not a <select>: open it and tap the name. */
async function choose(box: Locator, label: string) {
  await box.click();
  await box.page().getByRole('listbox').getByRole('option', { name: label, exact: true }).click();
}

/**
 * The item page (owner's feedback 2026-11-22, ADR-061): a short, readable detail page — name,
 * coloured labels, in stock · sold · stock value, the prices, Make bill at the top — and each
 * size with its pieces: + Add (new pieces came in), tap a size to correct it, + Add size,
 * ✎ Edit details (name, company, category, prices). Print label, Hide, More and Delete stay.
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

test('item page: name, labels, in stock · sold · value, prices; + Add pieces, correct a size, add a size, edit details', async ({ page }) => {
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

  // Readable at a glance: name, labels, three figures, the prices, Make bill on top.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  const chips = page.getByTestId('item-chips');
  await expect(chips.getByRole('link', { name: 'Shree Ganesh Textiles' })).toBeVisible();
  await expect(chips).toContainText('Kurta');
  await expect(page.getByTestId('item-pieces')).toHaveText('6');
  await expect(page.getByTestId('item-sold')).toHaveText('0');
  await expect(page.getByTestId('item-value')).toHaveText('₹2,400.00');
  await expect(page.getByTestId('item-prices')).toContainText('MRP ₹1,299.00');
  await expect(page.getByTestId('item-prices')).toContainText('Purchase ₹400.00');
  await expect(page.getByTestId('make-bill')).toBeVisible();
  const sizes = page.getByTestId('size-row');
  await expect(sizes).toHaveCount(2);
  await expect(sizes.first()).toContainText('M');
  await expect(sizes.first()).toContainText('3 pcs');
  await expect(sizes.first()).toContainText('sold 0');
  await expect(page.getByRole('tab')).toHaveCount(0);

  // + Add on M: 2 more came in.
  await page.getByRole('button', { name: 'Add pieces: M' }).click();
  await page.getByRole('button', { name: 'One more: M' }).click();
  await page.getByRole('button', { name: 'Add 2 pieces' }).click();
  await expect(page.getByTestId('done-overlay')).toContainText('2 pieces added');
  await page.keyboard.press('Escape');
  await expect(sizes.first()).toContainText('5 pcs');
  await expect(page.getByTestId('item-pieces')).toHaveText('8');

  // Tap L: correct its pieces to 1.
  await page.getByRole('button', { name: 'Change L', exact: true }).click();
  await page.getByLabel('Pieces of L', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByTestId('done-overlay')).toContainText('Saved');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('item-pieces')).toHaveText('6');

  // + Add size: XL with 2 pieces.
  await page.getByRole('button', { name: '+ Add size' }).click();
  await page.getByLabel('New size', { exact: true }).fill('XL');
  await page.getByRole('button', { name: 'One more: XL' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByTestId('done-overlay')).toContainText('1 new size added');
  await page.keyboard.press('Escape');
  await expect(sizes).toHaveCount(3);
  await expect(page.getByTestId('item-pieces')).toHaveText('8');

  // ✎ Edit details: a new name and prices for every size; Hindi or English in the name box.
  await page.getByTestId('edit-details').click();
  const details = page.getByTestId('details-sheet');
  await expect(details.getByLabel('Name')).toHaveValue(name);
  await expect(details.getByRole('button', { name: 'Type in Hindi' })).toBeVisible();
  await details.getByLabel('Name').fill(`${name} Long`);
  await details.getByLabel('MRP ₹').fill('1399');
  await details.getByLabel('Selling ₹').fill('1350');
  await details.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByTestId('done-overlay')).toContainText('Saved');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${name} Long`);
  await expect(page.getByTestId('item-prices')).toContainText('MRP ₹1,399.00');
  await expect(page.getByTestId('item-prices')).toContainText('Selling ₹1,350.00');

  // Selling above MRP is refused with a message; nothing changes.
  await page.getByTestId('edit-details').click();
  await details.getByLabel('Selling ₹').fill('1500');
  await details.getByRole('button', { name: 'Save changes' }).click();
  await expect(details.getByRole('alert')).toContainText('Selling price would be above MRP');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByTestId('item-prices')).toContainText('Selling ₹1,350.00');
});
