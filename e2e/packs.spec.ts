import { test, expect, type Page } from '@playwright/test';
import { addToBill, billEditor, chooseBillCompany } from './products';

// Box packs (owner, 2026-11-21, ADR-047): sandos in boxes of 12 — New item, one tag per box,
// sold by the piece or by the box at the counter, and boxes at the box rate on the bill check.
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

async function scan(page: Page, code: string) {
  const box = page.getByLabel('Scan barcode or enter SKU');
  await box.fill(code);
  await expect(box).toHaveValue(code);
  await box.press('Enter');
}

test('a box of 12: New item by the box, one tag per box, sell 2 pieces and a whole box, boxes on the bill check', async ({ page }, info) => {
  test.setTimeout(90_000);
  await loginOwner(page);
  const tag = `${run}${info.project.name.slice(0, 1)}`;
  const company = `Sando House ${tag}`;
  const name = `Sando ${tag}`;

  // New item: a new company from the company box, then "Comes as: Box", 12 a box, box prices.
  await page.goto('/admin/stock/new');
  await page.getByRole('button', { name: /^Many items/ }).click();
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  await page.getByRole('button', { name: /^Kurta/ }).click();
  await page.getByRole('combobox', { name: /^Company/ }).click();
  await page.getByRole('listbox').getByRole('option', { name: '+ New company…' }).click();
  await page.getByLabel('New company name').fill(company);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Company added')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('Product name').fill(name);
  await page.getByRole('radiogroup', { name: 'Comes as' }).getByRole('radio', { name: 'Box' }).click();
  await page.getByRole('button', { name: '12 in a box' }).click();
  await page.getByLabel('MRP of one piece ₹').fill('50');
  await page.getByLabel('Whole box MRP ₹').fill('540');
  await page.getByRole('radiogroup', { name: 'Purchase price given' }).getByRole('radio', { name: 'Whole box' }).click();
  await page.getByLabel('Purchase price of a box ₹').fill('500');
  await expect(page.getByTestId('pack-cost-each')).toHaveText('= ₹41.67 a piece');
  const firstSize = page.getByTestId('size-cards').getByRole('button').first();
  const size = (await firstSize.innerText()).trim();
  await firstSize.click();
  await page.getByRole('button', { name: `One box more of size ${size}` }).click();
  await page.getByRole('button', { name: `One box more of size ${size}` }).click();
  await expect(page.getByLabel(`Boxes of size ${size}`)).toHaveValue('3');
  await expect(page.getByTestId('size-summary')).toContainText('3 boxes · 36 pcs');
  await page.getByTestId('details-form').getByRole('button', { name: 'Next' }).click();
  await expect(page.getByTestId('review-total')).toContainText('Box of 12 · 3 boxes · 36 pcs');
  await expect(page.getByTestId('review-cost')).toContainText('Purchase ₹500.00 a box (₹41.67 a piece) · total ₹1,500.00');

  // One tag per box (3, not 36), each saying BOX OF 12.
  await page.getByRole('button', { name: 'Save & print tags' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print/);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('hang-tag')).toHaveCount(3);
  await expect(page.getByTestId('tag-pack').first()).toHaveText('BOX OF 12');
  await expect(page.getByTestId('hang-tag').first()).toContainText('per piece · Box ₹540');
  const label = await page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode 200/ }).first().getAttribute('aria-label');
  const barcode = label!.match(/Barcode (\d{13})/)![1];

  // Counter: 2 loose pieces at ₹45.
  await page.goto('/pos');
  await scan(page, barcode);
  await expect(page.getByTestId('item-pack')).toHaveText('Box of 12 · ₹540.00');
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await expect(page.getByTestId('sell-stock')).toContainText('Box of 12 · 36 pcs in stock');
  await page.getByLabel('Quantity').fill('2');
  await page.getByLabel(/^Sale price/).fill('45');
  await expect(page.getByTestId('sell-total')).toHaveText('Total: ₹90.00');
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByText('Sale done')).toBeVisible();
  await page.keyboard.press('Escape');

  // A whole box at the box price (₹500, below the ₹540 box MRP): 12 pieces leave, the total stays ₹500.
  await scan(page, barcode);
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await expect(page.getByTestId('sell-stock')).toContainText('34 pcs in stock');
  await page.getByRole('radiogroup', { name: 'Sell' }).getByRole('radio', { name: 'Whole boxes' }).click();
  await expect(page.getByLabel('Price of one box (₹)')).toHaveValue('540');
  await page.getByLabel('Price of one box (₹)').fill('600');
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'The box price cannot be more than the box MRP.' })).toBeVisible();
  await page.getByLabel('Price of one box (₹)').fill('500');
  await expect(page.getByTestId('sell-total')).toHaveText('Total: ₹500.00');
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByText('Sale done')).toBeVisible();
  await page.keyboard.press('Escape');
  await scan(page, barcode);
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await expect(page.getByTestId('sell-stock')).toContainText('22 pcs in stock');
  await page.getByRole('button', { name: 'Cancel' }).click();

  // On a several-item bill: the line switches to "box"; one box = 12 pieces at the box price.
  await scan(page, barcode);
  await page.getByTestId('add-more').click();
  const bill = page.getByTestId('bill');
  await bill.getByRole('radiogroup', { name: `Sell ${name} by` }).getByRole('radio', { name: 'box' }).click();
  await expect(bill.getByTestId('bill-box-pieces')).toHaveText('1 box = 12 pcs');
  await bill.getByTestId('bill-price').fill('520');
  await expect(bill.getByTestId('bill-total')).toHaveText('₹520.00');
  await bill.getByRole('button', { name: 'Save bill · ₹520.00' }).click();
  await expect(page.getByText(/Bill saved|sent to the owner/i).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await scan(page, barcode);
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await expect(page.getByTestId('sell-stock')).toContainText('10 pcs in stock');

  // A bill: the box item is billed by the box at the box rate, as the paper writes them (ADR-061).
  await page.goto('/admin/bills/new');
  const form = billEditor(page);
  await chooseBillCompany(page, company);
  await addToBill(page, name, size);
  await form.getByLabel(`Quantity of ${name} · ${size}`).fill('3');
  await expect(form.getByLabel(`Purchase price of ${name} · ${size} ₹`)).toHaveValue('500');
  await expect(form.getByTestId('bill-total')).toHaveText('₹1,500.00');
  await form.getByRole('button', { name: 'Next: check bill' }).click();
  const line = form.getByTestId('bill-sheet-line');
  await expect(line).toHaveCount(1);
  await expect(line).toContainText(`${name} (box of 12)`);
  await expect(line.getByRole('cell')).toHaveText(['1.', new RegExp(`^${name} \\(box of 12\\)`), '3', '500.00', '1,500.00']);
});
