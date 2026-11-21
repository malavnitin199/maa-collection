import { test, expect, type Page } from '@playwright/test';

/** Plan v19 (03a + the swap of 04b): New item, step by step (ADR-034) at /admin/stock/new; the earlier form is at /admin/stock/form. */
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

test('many items: who → what → details & sizes (two panels) → check → save and print; back keeps everything', async ({ page }) => {
  await login(page, 'Owner', /\/admin\/dashboard$/);
  await page.goto('/admin/stock');
  await page.getByRole('link', { name: /^New item/ }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/new$/);
  await heading(page, 'What are you adding?');
  await page.getByRole('button', { name: /^Many items/ }).click();

  await heading(page, 'Who is it for?');
  await expect(page.getByText('Step 1 of 4')).toBeVisible();
  const who = page.getByRole('group', { name: 'Who is it for?' }).getByRole('button');
  await expect(who.nth(0)).toHaveText('Men'); // then Women, Boys, Girls, any the owner added, and Add last
  await expect(who.nth(3)).toHaveText('Girls');
  await expect(who.last()).toHaveText('+Add');
  await page.getByRole('button', { name: 'Men', exact: true }).click();

  await heading(page, 'What is it?');
  await expect(page.getByRole('button', { name: /^Kurta/ })).toContainText('M–XXL');
  await page.getByRole('button', { name: /^Kurta/ }).click();

  // Owner's feedback 2026-11-21: details and sizes are one step, two panels, both open.
  await heading(page, 'Details & sizes');
  await expect(page.getByTestId('wizard-path')).toHaveText(/Men.*Kurta/);
  const detailsPanel = page.getByRole('button', { name: /^Item details/ });
  const sizesPanel = page.getByRole('button', { name: /^Which sizes\?/ });
  await expect(detailsPanel).toHaveAttribute('aria-expanded', 'true');
  await expect(sizesPanel).toHaveAttribute('aria-expanded', 'true');
  const next = page.getByRole('button', { name: 'Next' });
  await expect(next).toBeDisabled();
  await expect(page.getByTestId('size-summary')).toHaveText('Choose the company and type the MRP');
  await page.getByRole('combobox', { name: /^Company/ }).selectOption({ label: 'Shree Ganesh Textiles' });
  await page.getByLabel('Product name').fill(`Chikan Kurta ${run}`);
  await page.getByLabel('Sale price (MRP) ₹').fill('1299');
  await page.getByLabel('Purchase price ₹').fill('700');
  await expect(page.getByTestId('size-summary')).toHaveText('Tap the sizes that came');
  await expect(next).toBeDisabled();
  await expect(page.getByTestId('size-cards').getByRole('button', { name: /^Size / })).toHaveText(['M', 'L', 'XL', 'XXL']);
  await page.getByRole('button', { name: 'Size M', exact: true }).click();
  await page.getByRole('button', { name: 'Size L', exact: true }).click();
  await page.getByRole('button', { name: 'One more of size L' }).click();
  await expect(page.getByLabel('Pieces of size L')).toHaveValue('2');
  await expect(page.getByTestId('size-summary')).toHaveText('2 sizes · 3 pcs');

  // A panel closes and opens again; its header still says what is in it.
  await detailsPanel.click();
  await expect(detailsPanel).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('Product name')).toBeHidden();
  await expect(detailsPanel).toContainText(`Shree Ganesh Textiles · Chikan Kurta ${run} · MRP ₹1,299.00`);
  await sizesPanel.click();
  await expect(sizesPanel).toContainText('M × 1 · L × 2');
  await detailsPanel.click();
  await expect(page.getByLabel('Product name')).toHaveValue(`Chikan Kurta ${run}`);
  await next.click();
  await heading(page, 'Check and save');

  // Back: everything typed and picked is still there.
  await page.getByRole('button', { name: 'Back' }).click();
  await heading(page, 'Details & sizes');
  await expect(page.getByLabel('Purchase price ₹')).toHaveValue('700');
  await sizesPanel.click();
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
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=[0-9a-f-]{36}&created=2&mode=many$/);
  await expect(page.getByText('Saved 2 new items with barcodes.')).toBeVisible();
  const lines = page.getByTestId('receipt-lines');
  await expect(lines).toContainText(`Chikan Kurta ${run} · M`); // no colour: nothing shown (D-V19-3)
  await expect(lines.getByRole('listitem').filter({ hasText: `Chikan Kurta ${run} · L` })).toContainText('2 pcs');
  await expect(page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode 200/ })).toHaveCount(3);

  // Add next item: the same bill — company, section and the many-items choice kept; straight to "What is it?".
  await page.getByRole('link', { name: '+ Add next item' }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/new\?supplier=[0-9a-f-]{36}&section=[0-9a-f-]{36}&mode=many&n=[0-9a-f-]{36}$/);
  await heading(page, 'What is it?');
  await expect(page.getByTestId('wizard-path')).toHaveText('Men');
  await page.getByRole('button', { name: /^Shirt/ }).click();
  await expect(page.getByRole('combobox', { name: /^Company/ }).locator('option:checked')).toHaveText('Shree Ganesh Textiles');
  await expect(page.getByLabel('Product name')).toHaveValue('');
});

test('one item: a new category and a new size on the spot; one size only', async ({ page }) => {
  await login(page, 'Owner', /\/admin\/dashboard$/);
  await page.goto('/admin/stock/new');
  await page.getByRole('button', { name: /^One item/ }).click();
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  await heading(page, 'What is it?');
  await page.getByRole('group', { name: 'What is it?' }).getByRole('button', { name: 'Add' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'New category in Men' })).toBeVisible();
  await sheet.getByLabel('Category name').fill(`Shorts ${run}`);
  // Sizes are tapped (owner, 2026-11-21): a quick range, then one more, then one less.
  await sheet.getByRole('button', { name: 'S–M', exact: true }).click();
  await expect(sheet.getByTestId('size-chips-picked')).toHaveText('2 picked: S, M');
  await sheet.getByRole('button', { name: 'Size S', exact: true }).click();
  await sheet.getByRole('button', { name: 'Size M', exact: true }).click();
  await sheet.getByRole('button', { name: 'Size 32', exact: true }).click();
  await sheet.getByRole('button', { name: 'Size 30', exact: true }).click();
  await expect(sheet.getByTestId('size-chips-picked')).toHaveText('2 picked: 30, 32');
  await sheet.getByRole('button', { name: 'Add category' }).click();

  // Stays on "What is it?": the new category is chosen and marked New; a tap goes on.
  await heading(page, 'What is it?');
  const added = page.getByRole('button', { name: new RegExp(`^New.*Shorts ${run}`) });
  await expect(added).toHaveAttribute('aria-pressed', 'true');
  await expect(added).toHaveAttribute('data-new', 'true');
  await expect(added).toContainText('30–32');
  await page.keyboard.press('Escape'); // the done card
  await added.click();

  await heading(page, 'Details & sizes');
  await expect(page.getByTestId('wizard-path')).toHaveText(new RegExp(`Men.*Shorts ${run}`));
  await page.getByRole('combobox', { name: /^Company/ }).selectOption({ label: 'Shree Ganesh Textiles' });
  // No product name: it gets "Shorts … + number" on save.
  await expect(page.getByLabel('Product name (optional)')).toHaveAttribute('placeholder', `Shorts ${run} + number`);
  await page.getByLabel('Sale price (MRP) ₹').fill('899');
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
  await expect(page.getByTestId('review-card')).toContainText(`Shorts ${run} + number`);
  await expect(page.getByTestId('review-sizes').getByRole('listitem')).toHaveText(['34 × 3']);
  await page.getByRole('button', { name: 'Save & print tags' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=[0-9a-f-]{36}&created=1&mode=one$/);
  await expect(page.getByTestId('receipt-lines')).toContainText(new RegExp(`Shorts ${run} 001 · 34`));
  await expect(page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode 200/ })).toHaveCount(3);

  // The new size stayed on the category.
  await page.goto('/admin/categories');
  await expect(page.getByTestId('category-list').getByRole('listitem').filter({ hasText: `Shorts ${run}` }).getByTestId('category-sizes')).toHaveText('Sizes: 30 · 32 · 34');
});

test('save & add next keeps the bill (section, company, bill no.) and shows the SKUs; save clears everything; two saves = two receipts', async ({ page }) => {
  await login(page, 'Owner', /\/admin\/dashboard$/);
  await page.goto('/admin/stock/new');
  await page.getByRole('button', { name: /^Many items/ }).click();
  await page.getByRole('button', { name: 'Women', exact: true }).click();
  await page.getByRole('button', { name: /^Kurti/ }).click();
  await page.getByRole('combobox', { name: /^Company/ }).selectOption({ label: 'Laxmi Fashion House' });
  await page.getByLabel('Product name').fill(`Anarkali ${run}`);
  await page.getByLabel('Sale price (MRP) ₹').fill('1899');
  await page.getByText('More: counter price, bill no., stock date, brand').click();
  await page.getByLabel('Bill no.').fill(`LF-${run}`);
  await page.getByRole('button', { name: 'All sizes' }).click();
  await expect(page.getByTestId('size-summary')).toHaveText('4 sizes · 4 pcs');
  await page.getByRole('button', { name: 'Next' }).click();
  await heading(page, 'Check and save');
  await page.getByRole('button', { name: 'Save & add next' }).click();

  // Saved, with the SKU range; the next item of the same bill starts at "What is it?".
  const toast = page.getByTestId('done-overlay'); // the done card (owner's feedback 2026-11-20): title, the summary line, the details
  await expect(toast).toContainText('4 items saved');
  await expect(toast).toContainText(new RegExp(`Saved Anarkali ${run}: MAA-KR-\\d{3} – MAA-KR-\\d{3} · 4 pcs`));
  await expect(toast.getByTestId('done-lines')).toContainText('Pieces4 pcs');
  await page.keyboard.press('Escape'); // any key or tap closes it
  await expect(toast).toBeHidden();
  await heading(page, 'What is it?');
  await expect(page.getByTestId('wizard-path')).toHaveText('Women');
  await expect(page).toHaveURL(/\/admin\/stock\/new$/);
  await page.getByRole('button', { name: /^Saree/ }).click();
  const details = page.getByTestId('details-form');
  await expect(details.getByRole('combobox', { name: /^Company/ }).locator('option:checked')).toHaveText('Laxmi Fashion House');
  await expect(details.getByLabel('Bill no.')).toHaveValue(`LF-${run}`);
  await expect(details.getByLabel('Product name')).toHaveValue('');
  await expect(details.getByLabel('Sale price (MRP) ₹')).toHaveValue('');
  await details.getByLabel('Product name').fill(`Banarasi ${run}`);
  await details.getByLabel('Sale price (MRP) ₹').fill('4500');
  await expect(page.getByTestId('size-summary')).toHaveText('1 size · 1 pc'); // Saree: Free
  await page.getByRole('button', { name: 'One more of size Free' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // Save = done with this bill: toast, back to the start, nothing kept.
  await expect(page.getByTestId('done-overlay')).toContainText(new RegExp(`Saved Banarasi ${run}: MAA-SA-\\d{3} · 2 pcs`));
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('done-overlay')).toBeHidden();
  await heading(page, 'What are you adding?');
  await page.getByRole('button', { name: /^Many items/ }).click();
  await heading(page, 'Who is it for?'); // no section kept
  await page.getByRole('button', { name: 'Women', exact: true }).click();
  await page.getByRole('button', { name: /^Saree/ }).click();
  await expect(page.getByTestId('details-form').getByRole('combobox', { name: /^Company/ }).locator('option:checked')).toHaveText('Choose a company…');
  await expect(page.getByTestId('details-form').getByLabel('Bill no.')).toHaveValue('');

  // Both items exist, under their own receipts (each save has its own operation id).
  await page.goto(`/admin/products?q=${run}&show=items`);
  const list = page.getByTestId('product-list').or(page.getByTestId('design-list'));
  await expect(list).toContainText(`Anarkali ${run}`);
  await expect(list).toContainText(`Banarasi ${run}`);
  await expect(list.getByRole('listitem').filter({ hasText: `Anarkali ${run}` })).toHaveCount(4);
});

test('a salesman without the catalog right cannot open it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'same rule on both');
  await login(page, 'Vishal', /\/pos$/);
  await page.goto('/admin/stock/new');
  await expect(page).toHaveURL(/\/pos$/);
});
