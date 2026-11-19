import { test, expect, type Page } from '@playwright/test';

/** Plan v19 task 03a: New item, step by step (ADR-034) at /admin/stock/add. */
const PIN = '1234';
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

async function login(page: Page, who: string, lands: RegExp) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByText(who, { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(lands);
}

const heading = (page: Page, text: string) => expect(page.getByRole('heading', { level: 2, name: text })).toBeVisible();

test('many items: who → what → details → sizes with pieces → check → save and print; back keeps everything', async ({ page }) => {
  await login(page, 'Owner', /\/admin\/dashboard$/);
  await page.goto('/admin/stock');
  await page.getByRole('link', { name: /Add stock step by step/ }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/add$/);
  await heading(page, 'What are you adding?');
  await page.getByRole('button', { name: /^Many items/ }).click();

  await heading(page, 'Who is it for?');
  await expect(page.getByText('Step 1 of 5')).toBeVisible();
  const who = page.getByRole('group', { name: 'Who is it for?' }).getByRole('button');
  await expect(who.nth(0)).toHaveText('Men'); // then Women, Boys, Girls, any the owner added, and Add last
  await expect(who.nth(3)).toHaveText('Girls');
  await expect(who.last()).toHaveText('+Add');
  await page.getByRole('button', { name: 'Men', exact: true }).click();

  await heading(page, 'What is it?');
  await expect(page.getByRole('button', { name: /^Kurta/ })).toContainText('M–XXL');
  await page.getByRole('button', { name: /^Kurta/ }).click();

  await heading(page, 'Item details');
  await expect(page.getByTestId('wizard-path')).toHaveText(/Men.*Kurta/);
  const next = page.getByRole('button', { name: 'Next' });
  await expect(next).toBeDisabled();
  await page.getByRole('combobox', { name: /^Company/ }).selectOption({ label: 'Shree Ganesh Textiles' });
  await page.getByLabel('Product name').fill(`Chikan Kurta ${run}`);
  await page.getByLabel('Sale price (MRP) ₹').fill('1299');
  await page.getByLabel('Purchase price ₹').fill('700');
  await expect(next).toBeEnabled();
  await next.click();

  await heading(page, 'Which sizes?');
  await expect(page.getByTestId('size-summary')).toHaveText('Tap the sizes that came');
  await expect(page.getByTestId('size-cards').getByRole('button', { name: /^Size / })).toHaveText(['M', 'L', 'XL', 'XXL']);
  await page.getByRole('button', { name: 'Size M', exact: true }).click();
  await page.getByRole('button', { name: 'Size L', exact: true }).click();
  await page.getByRole('button', { name: 'One more of size L' }).click();
  await expect(page.getByLabel('Pieces of size L')).toHaveValue('2');
  await expect(page.getByTestId('size-summary')).toHaveText('2 sizes · 3 pcs');

  // Back to the details: everything typed is still there; the sizes too when we return.
  await page.getByRole('button', { name: 'Back' }).click();
  await heading(page, 'Item details');
  await expect(page.getByLabel('Product name')).toHaveValue(`Chikan Kurta ${run}`);
  await expect(page.getByLabel('Purchase price ₹')).toHaveValue('700');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByLabel('Pieces of size L')).toHaveValue('2');
  await page.getByRole('button', { name: 'Next' }).click();

  await heading(page, 'Check and save');
  const review = page.getByTestId('review-card');
  await expect(review).toContainText(`Chikan Kurta ${run}`);
  await expect(review).toContainText('Men › Kurta · Shree Ganesh Textiles');
  await expect(page.getByTestId('review-sizes').getByRole('listitem')).toHaveText(['M × 1', 'L × 2']);
  await expect(page.getByTestId('review-total')).toHaveText('3 pcs · 2 items');
  await expect(review).toContainText('MRP ₹1,299.00');
  await expect(page.getByTestId('review-cost')).toHaveText('Purchase ₹700.00 per piece · total ₹2,100.00');
  // The path chips go back to a step: the sizes chip shows what was picked.
  await expect(page.getByTestId('wizard-path')).toContainText('M × 1 · L × 2');

  await page.getByRole('button', { name: 'Save & print tags' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=[0-9a-f-]{36}&created=2$/);
  await expect(page.getByText('Saved 2 new items with barcodes.')).toBeVisible();
  const lines = page.getByTestId('receipt-lines');
  await expect(lines).toContainText(`Chikan Kurta ${run} · M`); // no colour: nothing shown (D-V19-3)
  await expect(lines.getByRole('listitem').filter({ hasText: `Chikan Kurta ${run} · L` })).toContainText('2 pcs');
  await expect(page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode 200/ })).toHaveCount(3);
});

test('one item: a new category and a new size on the spot; one size only', async ({ page }) => {
  await login(page, 'Owner', /\/admin\/dashboard$/);
  await page.goto('/admin/stock/add');
  await page.getByRole('button', { name: /^One item/ }).click();
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  await heading(page, 'What is it?');
  await page.getByRole('group', { name: 'What is it?' }).getByRole('button', { name: 'Add' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'New category in Men' })).toBeVisible();
  await sheet.getByLabel('Category name').fill(`Shorts ${run}`);
  await sheet.getByLabel('Sizes (in shop order)').fill('30, 32');
  await sheet.getByRole('button', { name: 'Add category' }).click();

  await heading(page, 'Item details');
  await expect(page.getByTestId('wizard-path')).toHaveText(new RegExp(`Men.*Shorts ${run}`));
  await page.getByRole('combobox', { name: /^Company/ }).selectOption({ label: 'Shree Ganesh Textiles' });
  await page.getByLabel('Product name').fill(`Cargo Shorts ${run}`);
  await page.getByLabel('Sale price (MRP) ₹').fill('899');
  await page.getByRole('button', { name: 'Next' }).click();

  await heading(page, 'Which size?');
  await expect(page.getByTestId('size-summary')).toHaveText('Tap the size');
  await expect(page.getByRole('button', { name: 'All sizes' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Size 30', exact: true }).click();
  await page.getByRole('button', { name: 'Size 32', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Size 30', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Size 32', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // A size the category lacks: kept on the category for next time, and chosen now.
  await page.getByLabel('New size').fill('34');
  await page.getByRole('button', { name: '+ Add size' }).click();
  await expect(page.getByRole('button', { name: 'Size 34', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Size 32', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'One more of size 34' }).click();
  await page.getByRole('button', { name: 'One more of size 34' }).click();
  await expect(page.getByTestId('size-summary')).toHaveText('1 size · 3 pcs');
  await page.getByRole('button', { name: 'Next' }).click();

  await heading(page, 'Check and save');
  await expect(page.getByTestId('review-sizes').getByRole('listitem')).toHaveText(['34 × 3']);
  await page.getByRole('button', { name: 'Save & print tags' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=[0-9a-f-]{36}&created=1$/);
  await expect(page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode 200/ })).toHaveCount(3);

  // The new size stayed on the category.
  await page.goto('/admin/categories');
  await expect(page.getByTestId('category-list').getByRole('listitem').filter({ hasText: `Shorts ${run}` }).getByTestId('category-sizes')).toHaveText('Sizes: 30 · 32 · 34');
});

test('a salesman without the catalog right cannot open it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'same rule on both');
  await login(page, 'Vishal', /\/pos$/);
  await page.goto('/admin/stock/add');
  await expect(page).toHaveURL(/\/pos$/);
});
