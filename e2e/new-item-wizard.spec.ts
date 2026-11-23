import { test, expect, type Locator, type Page } from '@playwright/test';
import { openMore, productCard } from './products';

/** The company box is a compact dropdown (2026-11-21), not a <select>: open it and tap the name. */
async function choose(box: Locator, label: string) {
  await box.click();
  await box.page().getByRole('listbox').getByRole('option', { name: label, exact: true }).click();
}

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

/** The "Saved …" card: wait for it, then any key closes it. */
async function closeDone(page: Page) {
  await expect(page.getByTestId('done-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('done-overlay')).toBeHidden();
}

test('Home → Add new stock → which collection → what → details & sizes (one card) → check → save and print; back keeps everything', async ({ page }) => {
  await login(page, 'Owner', /\/admin\/dashboard$/);
  // Owner, 2026-11-22 (ADR-064): the Home tile opens New item itself, on "Which collection?" — no One / Many choice.
  await page.getByTestId('quick-actions').getByRole('link', { name: 'Add new stock' }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/new$/);
  await heading(page, 'Which collection?');
  await expect(page.getByRole('button', { name: /^(One item|Many items)/ })).toHaveCount(0);
  await expect(page.getByText('Step 1 of 4')).toBeVisible();
  const who = page.getByRole('group', { name: 'Which collection?' }).getByRole('button');
  await expect(who.nth(0)).toHaveText('Men'); // then Women, Boys, Girls, any the owner added, and Add last
  // Girls follows Boys, but the collections test may be moving its own collection up past it at this
  // very moment (parallel workers share the database): just check Girls is offered.
  await expect(who.nth(2)).toHaveText('Boys');
  await expect(who.filter({ hasText: /^Girls$/ })).toHaveCount(1);
  await expect(who.last()).toHaveText('+Add');
  await page.getByRole('button', { name: 'Men', exact: true }).click();

  await heading(page, 'What is it?');
  await expect(page.getByRole('button', { name: /^Kurta/ })).toContainText('M–XXL');
  await page.getByRole('button', { name: /^Kurta/ }).click();

  // Owner's feedback 2026-11-21: details and sizes on one step. 2026-11-22 (ADR-065): the four must-haves are big
  // boxes — company, product name, purchase price, sale price (₹ inside) — and the sizes wait under "Sizes & more".
  await heading(page, 'Details & sizes');
  await expect(page.getByTestId('wizard-path')).toHaveText(/Men.*Kurta/);
  const card = page.getByTestId('details-form');
  const tiles = page.getByTestId('details-tiles');
  await expect(tiles.getByRole('combobox', { name: /^Company/ })).toBeVisible();
  for (const label of ['Product name', 'Purchase price', 'Sale price']) await expect(tiles.getByLabel(label, { exact: true })).toBeVisible();
  await expect(card.getByTestId('size-cards')).toBeHidden();
  const next = page.getByRole('button', { name: 'Next' });
  await expect(next).toBeDisabled();
  await expect(page.getByTestId('size-summary')).toHaveText('Type the purchase or sale price');
  await choose(page.getByRole('combobox', { name: /^Company/ }), 'Shree Ganesh Textiles');
  await page.getByLabel('Product name').fill(`Chikan Kurta ${run}`);
  await page.getByLabel('Sale price', { exact: true }).fill('1299');
  await page.getByLabel('Purchase price', { exact: true }).fill('700');
  // No size yet: the pieces box stands in (owner, 2026-11-22) — Next works with 1 piece, no size.
  await expect(page.getByTestId('size-summary')).toHaveText('No size · 1 pc');
  await expect(page.getByTestId('more-details').locator('summary')).toContainText('No size · 1 pc');
  await expect(next).toBeEnabled();
  await openMore(page);
  await expect(page.getByTestId('size-cards').getByRole('button', { name: /^Size / })).toHaveText(['M', 'L', 'XL', 'XXL']);
  await page.getByRole('button', { name: 'Size M', exact: true }).click();
  await page.getByRole('button', { name: 'Size L', exact: true }).click();
  await page.getByRole('button', { name: 'One more of size L' }).click();
  await expect(page.getByLabel('Pieces of size L')).toHaveValue('2');
  await expect(page.getByTestId('size-summary')).toHaveText('2 sizes · 3 pcs');

  // Size buttons are small chips (owner, 2026-11-21).
  const chip = await card.getByRole('button', { name: 'Size XL', exact: true }).boundingBox();
  expect(chip!.height).toBeLessThanOrEqual(44);
  await expect(card.getByTestId('size-pieces').getByRole('listitem')).toHaveCount(2);
  await next.click();
  await heading(page, 'Check and save');

  // Back: everything typed and picked is still there.
  await page.getByRole('button', { name: 'Back' }).click();
  await heading(page, 'Details & sizes');
  await expect(page.getByLabel('Purchase price', { exact: true })).toHaveValue('700');
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

  // Add next item: the same bill — company and section kept; straight to "What is it?".
  await page.getByRole('link', { name: '+ Add next item' }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/new\?supplier=[0-9a-f-]{36}&section=[0-9a-f-]{36}&n=[0-9a-f-]{36}$/);
  await heading(page, 'What is it?');
  await expect(page.getByTestId('wizard-path')).toHaveText('Men');
  await page.getByRole('button', { name: /^Shirt/ }).click();
  await expect(page.getByRole('combobox', { name: /^Company/ })).toHaveText('Shree Ganesh Textiles');
  await expect(page.getByLabel('Product name')).toHaveValue('');
});

test('a new category and a new size on the spot; every item may have many sizes (ADR-064)', async ({ page }) => {
  await login(page, 'Owner', /\/admin\/dashboard$/);
  await page.goto('/admin/stock/new');
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
  await choose(page.getByRole('combobox', { name: /^Company/ }), 'Shree Ganesh Textiles');
  // No product name: it gets "Shorts … + number" on save.
  await expect(page.getByLabel('Product name', { exact: true })).toHaveAttribute('placeholder', `Shorts ${run} + number`);
  await page.getByLabel('Sale price', { exact: true }).fill('899');
  await openMore(page);
  await expect(page.getByTestId('size-summary')).toHaveText('No size · 1 pc');
  await expect(page.getByRole('button', { name: 'All sizes' })).toBeVisible();
  // Sizes are tapped on and off; more than one may be chosen.
  await page.getByRole('button', { name: 'Size 30', exact: true }).click();
  await page.getByRole('button', { name: 'Size 32', exact: true }).click();
  await page.getByRole('button', { name: 'Size 30', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Size 30', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Size 32', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // A size the category lacks: kept on the category for next time, and chosen now, with the others.
  await page.getByLabel('New size').fill('34');
  await page.getByRole('button', { name: '+ Add size' }).click();
  await expect(page.getByRole('button', { name: 'Size 34', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Size 32', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'One more of size 34' }).click();
  await page.getByRole('button', { name: 'One more of size 34' }).click();
  await expect(page.getByTestId('size-summary')).toHaveText('2 sizes · 4 pcs');
  await page.getByRole('button', { name: 'Next' }).click();

  await heading(page, 'Check and save');
  await expect(page.getByTestId('review-card')).toContainText(`Shorts ${run} + number`);
  await expect(page.getByTestId('review-sizes').getByRole('listitem')).toHaveText(['32 × 1', '34 × 3']);
  await page.getByRole('button', { name: 'Save & print tags' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=[0-9a-f-]{36}&created=2$/);
  await expect(page.getByTestId('receipt-lines')).toContainText(new RegExp(`Shorts ${run} 001 · 34`));
  await expect(page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode 200/ })).toHaveCount(4);

  // The new size stayed on the category.
  await page.goto('/admin/categories');
  await expect(page.getByTestId('category-list').getByRole('listitem').filter({ hasText: `Shorts ${run}` }).getByTestId('category-sizes')).toHaveText('Sizes: 30 · 32 · 34');
});

test('save & add next keeps the bill (section, company, bill no.) and shows the SKUs; save clears everything; two saves = two receipts', async ({ page }) => {
  await login(page, 'Owner', /\/admin\/dashboard$/);
  await page.goto('/admin/stock/new');
  await page.getByRole('button', { name: 'Women', exact: true }).click();
  await page.getByRole('button', { name: /^Kurti/ }).click();
  await choose(page.getByRole('combobox', { name: /^Company/ }), 'Laxmi Fashion House');
  await page.getByLabel('Product name').fill(`Anarkali ${run}`);
  await page.getByLabel('Sale price', { exact: true }).fill('1899');
  await openMore(page);
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
  await expect(details.getByRole('combobox', { name: /^Company/ })).toHaveText('Laxmi Fashion House');
  await expect(details.getByLabel('Bill no.')).toHaveValue(`LF-${run}`);
  await expect(details.getByLabel('Product name')).toHaveValue('');
  await expect(details.getByLabel('Sale price', { exact: true })).toHaveValue('');
  await details.getByLabel('Product name').fill(`Banarasi ${run}`);
  await details.getByLabel('Sale price', { exact: true }).fill('4500');
  await expect(page.getByTestId('size-summary')).toHaveText('1 size · 1 pc'); // Saree: Free
  await page.getByRole('button', { name: 'One more of size Free' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // Save = done with this bill: toast, back to the start, nothing kept.
  await expect(page.getByTestId('done-overlay')).toContainText(new RegExp(`Saved Banarasi ${run}: MAA-SA-\\d{3} · 2 pcs`));
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('done-overlay')).toBeHidden();
  await heading(page, 'Which collection?'); // no section kept
  await page.getByRole('button', { name: 'Women', exact: true }).click();
  await page.getByRole('button', { name: /^Saree/ }).click();
  await expect(page.getByTestId('details-form').getByRole('combobox', { name: /^Company/ })).toHaveText('Optional');
  await expect(page.getByTestId('details-form').getByLabel('Bill no.')).toHaveValue('');

  // Both items exist, under their own receipts (each save has its own operation id).
  await page.goto('/admin/products');
  await expect(productCard(page, `Banarasi ${run}`)).not.toHaveCount(0);
  await expect(productCard(page, `Anarkali ${run}`)).toHaveCount(1);
  await expect(productCard(page, `Anarkali ${run}`)).toHaveAttribute('data-items', '4');
});

test('a salesman without the catalog right cannot open it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'same rule on both');
  await login(page, 'Vishal', /\/pos$/);
  await page.goto('/admin/stock/new');
  await expect(page).toHaveURL(/\/pos$/);
});

test('compact top, short company list, Next inside the card, and the phone back button goes one step back', async ({ page }) => {
  await login(page, 'Owner', /\/admin\/dashboard$/);
  await page.goto('/admin/stock');
  await page.getByRole('link', { name: /^New item/ }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/new$/);
  await page.getByRole('button', { name: 'Women', exact: true }).click();
  await page.getByRole('button', { name: /^Kurti/ }).click();
  await heading(page, 'Details & sizes');
  // The top takes little room: the card starts in the upper part of the screen.
  const viewport = page.viewportSize()!;
  const card = page.getByTestId('details-form');
  expect((await card.boundingBox())!.y).toBeLessThan(viewport.height * 0.45);

  // The company list opens under the box, at most about half the screen tall.
  const company = page.getByRole('combobox', { name: /^Company/ });
  await company.click();
  const list = page.getByRole('listbox');
  await expect(list).toBeVisible();
  expect((await list.boundingBox())!.height).toBeLessThanOrEqual(viewport.height * 0.5);
  await list.getByRole('option', { name: 'Laxmi Fashion House', exact: true }).click();
  await expect(list).toBeHidden();
  await expect(company).toHaveText('Laxmi Fashion House');

  // Next is part of the card (no bar floating over the fields).
  await expect(card.getByRole('button', { name: 'Next' })).toBeVisible();

  // The phone's back button: one step at a time, then off the page.
  await page.goBack();
  await heading(page, 'What is it?');
  await page.goBack();
  await heading(page, 'Which collection?'); // the first step (ADR-064): the next back leaves the page
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/stock$/);
});

test('which collection: Men and Women always stay; the owner adds, edits and deletes the others right on their tiles (ADR-064)', async ({ page }, info) => {
  await login(page, 'Owner', /\/admin\/dashboard$/);
  const tag = `${run}${info.project.name[0]}`;
  await page.goto('/admin/stock/new');
  const group = page.getByRole('group', { name: 'Which collection?' });
  const sheet = page.getByRole('dialog');
  // Men and Women carry a lock: no ✎, no 🗑. The others have both.
  await expect(page.locator('[data-testid="collection-tile"][data-fixed]')).toHaveCount(2);
  for (const fixed of ['Men', 'Women']) {
    await expect(group.getByRole('button', { name: `Edit ${fixed}`, exact: true })).toHaveCount(0);
    await expect(group.getByRole('button', { name: `Delete ${fixed}`, exact: true })).toHaveCount(0);
  }
  await expect(group.getByRole('button', { name: 'Edit Boys', exact: true })).toBeVisible();
  await expect(group.getByRole('button', { name: 'Delete Boys', exact: true })).toBeVisible();

  // + Add: it stays on this step, chosen and marked New, with its own ✎ / 🗑.
  await group.getByRole('button', { name: 'Add', exact: true }).click();
  await sheet.getByRole('textbox', { name: /^Name/ }).fill(`Kids ${tag}`);
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await closeDone(page);
  await expect(group.getByRole('button', { name: new RegExp(`^New.*Kids ${tag}$`) })).toHaveAttribute('aria-pressed', 'true');

  // ✎: a new name and picture, kept on the server.
  await group.getByRole('button', { name: `Edit Kids ${tag}`, exact: true }).click();
  await expect(sheet.getByRole('heading', { name: 'Edit collection' })).toBeVisible();
  await expect(sheet.getByRole('textbox', { name: /^Name/ })).toHaveValue(`Kids ${tag}`);
  await sheet.getByRole('textbox', { name: /^Name/ }).fill(`Juniors ${tag}`);
  await sheet.getByRole('radio', { name: 'Baby' }).click();
  await sheet.getByRole('button', { name: 'Save collection' }).click();
  await closeDone(page);
  await expect(group.getByRole('button', { name: `Edit Juniors ${tag}`, exact: true })).toBeVisible();
  await page.reload();
  await expect(group.getByRole('button', { name: `Juniors ${tag}`, exact: true })).toBeVisible();

  // With an item in it, 🗑 says so and keeps it (every item needs its collection).
  await group.getByRole('button', { name: `Juniors ${tag}`, exact: true }).click();
  await page.getByRole('group', { name: 'What is it?' }).getByRole('button', { name: 'Add', exact: true }).click();
  await sheet.getByLabel('Category name').fill(`Bibs ${tag}`);
  await sheet.getByRole('button', { name: 'Add category' }).click();
  await closeDone(page);
  await page.getByRole('button', { name: new RegExp(`^New.*Bibs ${tag}`) }).click();
  await page.getByLabel('Sale price', { exact: true }).fill('199');
  await page.getByTestId('details-form').getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await closeDone(page);
  await heading(page, 'Which collection?');
  await group.getByRole('button', { name: `Delete Juniors ${tag}`, exact: true }).click();
  const ask = page.getByTestId('action-sheet');
  await expect(ask).toContainText(`Juniors ${tag} still has 1 items. Delete them first.`);
  await expect(ask.getByTestId('confirm-delete-collection')).toHaveCount(0);
  await ask.getByRole('button', { name: 'Cancel' }).click();

  // An empty one: 🗑 asks first, then it is gone (after a reload too).
  await group.getByRole('button', { name: 'Add', exact: true }).click();
  await sheet.getByRole('textbox', { name: /^Name/ }).fill(`Spare ${tag}`);
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await closeDone(page);
  await group.getByRole('button', { name: `Delete Spare ${tag}`, exact: true }).click();
  await expect(ask).toHaveAccessibleName(`Delete Spare ${tag}?`);
  await ask.getByTestId('confirm-delete-collection').click();
  await expect(page.getByTestId('done-overlay')).toContainText(`Spare ${tag} deleted.`);
  await closeDone(page);
  await expect(group.getByRole('button', { name: `Spare ${tag}`, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(group.getByRole('button', { name: `Juniors ${tag}`, exact: true })).toBeVisible();
  await expect(group.getByRole('button', { name: `Spare ${tag}`, exact: true })).toHaveCount(0);
});

test('no size picked: just the pieces; saved as one item with no size (owner, 2026-11-22)', async ({ page }, info) => {
  await login(page, 'Owner', /\/admin\/dashboard$/);
  const name = `Plain Dupatta ${run}${info.project.name[0]}`;
  await page.goto('/admin/stock/new');
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  await page.getByRole('button', { name: /^Kurta/ }).click();
  await page.getByLabel('Product name').fill(name);
  await page.getByLabel('Sale price', { exact: true }).fill('499');
  await openMore(page);
  // No size tapped: a pieces box shows instead; Next works.
  const plain = page.getByTestId('no-size-pieces');
  await expect(plain).toContainText('No size? Just the pieces:');
  await plain.getByRole('button', { name: 'One more' }).click();
  await plain.getByRole('button', { name: 'One more' }).click();
  await expect(plain.getByLabel('Pieces with no size')).toHaveValue('3');
  await expect(page.getByTestId('size-summary')).toHaveText('No size · 3 pcs');
  await page.getByTestId('details-form').getByRole('button', { name: 'Next' }).click();
  await expect(page.getByTestId('review-sizes')).toHaveText('No size × 3');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.goto('/admin/products');
  const card = productCard(page, name);
  await expect(card).toHaveAttribute('data-items', '1');
  await expect(card.getByTestId('card-pieces')).toHaveText('3 pcs');
  // Tapping a size hides the pieces box again.
  await page.goto('/admin/stock/new');
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  await page.getByRole('button', { name: /^Kurta/ }).click();
  await openMore(page);
  await page.getByTestId('size-cards').getByRole('button').first().click();
  await expect(page.getByTestId('no-size-pieces')).toHaveCount(0);
});

test('purchase price first; an empty sale price is purchase + 50%; the % calculator beside the sale price fills it (owner, 2026-11-22)', async ({ page }, info) => {
  await login(page, 'Owner', /\/admin\/dashboard$/);
  const name = `Markup Kurta ${run}${info.project.name[0]}`;
  await page.goto('/admin/stock/new');
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  await page.getByRole('button', { name: /^Kurta/ }).click();
  await page.getByLabel('Product name').fill(name);
  // Purchase price comes before the sale price.
  const purchase = page.getByLabel('Purchase price', { exact: true });
  const sale = page.getByLabel('Sale price', { exact: true });
  expect((await purchase.boundingBox())!.x).toBeLessThan((await sale.boundingBox())!.x);
  await purchase.fill('700');
  // Left empty, the sale price is purchase + 50% (in grey in the box).
  await expect(sale).toHaveAttribute('placeholder', '1050');
  // The % calculator beside the sale price: pick or type a %, then "Use it" fills the box and closes.
  await page.getByRole('button', { name: 'Work out the sale price' }).click();
  const calc = page.getByTestId('markup-calc');
  await expect(calc.getByTestId('calc-result')).toHaveText('₹700.00 + 50% = ₹1,050.00');
  await calc.getByRole('button', { name: '30%', exact: true }).click();
  await expect(calc.getByTestId('calc-result')).toHaveText('₹700.00 + 30% = ₹910.00');
  await calc.getByLabel('% more than the purchase price').fill('40');
  await expect(calc.getByTestId('calc-result')).toHaveText('₹700.00 + 40% = ₹980.00');
  await calc.getByRole('button', { name: 'Use it' }).click();
  await expect(sale).toHaveValue('980');
  await expect(calc).toHaveCount(0);
  await openMore(page);
  await page.getByTestId('size-cards').getByRole('button').first().click();
  await page.getByTestId('details-form').getByRole('button', { name: 'Next' }).click();
  await expect(page.getByTestId('review-card')).toContainText('MRP ₹980.00');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.goto('/admin/products');
  await expect(productCard(page, name).getByTestId('card-cost')).toHaveText('₹700/pc'); // purchase per piece (ADR-057/070)
  await expect(productCard(page, name).getByTestId('card-mrp')).toHaveText('MRP ₹980');
  await productCard(page, name).getByRole('link', { name, exact: true }).click();
  await expect(page.getByTestId('item-prices')).toContainText('MRP ₹980.00');
  // The % is remembered on this phone for the next item.
  await page.goto('/admin/stock/new');
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  await page.getByRole('button', { name: /^Kurta/ }).click();
  await page.getByLabel('Purchase price', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Work out the sale price' }).click();
  await expect(page.getByTestId('markup-calc').getByLabel('% more than the purchase price')).toHaveValue('40');
});
