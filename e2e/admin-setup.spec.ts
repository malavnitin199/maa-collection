import { test, expect, type Locator, type Page } from '@playwright/test';
import { openProduct, productCard } from './products';

/** The company box is a compact dropdown (2026-11-21), not a <select>: open it and tap the name. */
async function choose(box: Locator, label: string) {
  await box.click();
  await box.page().getByRole('listbox').getByRole('option', { name: label, exact: true }).click();
}

const PIN = '1234';
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

async function loginOwner(page: Page) {
  await page.context().clearCookies(); // switch user: start logged out
  await page.goto('/login');
  await page.getByText('Owner', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

/**
 * The earlier New item form (plan v17): top tabs Details (open first) · Sizes · Other details. The item page has no tabs (ADR-059).
 * New item's must-haves: company, sale price (MRP) and purchase price.
 */
const tab = (page: Page, name: 'Details' | 'Sizes' | 'Other details') => page.getByRole('tab', { name, exact: true }).click();
// The old form's sizes tab (no colours since 2026-11-22: colour lives on the product page only).
const showVariants = (page: Page) => tab(page, 'Sizes');
const companyBox = (page: Page) => page.getByRole('combobox', { name: /^Company/ });
const salePrice = (page: Page) => page.getByLabel('Sale price (MRP) ₹');
const purchasePrice = (page: Page) => page.getByLabel('Purchase price ₹', { exact: true });

test('owner adds a supplier and a category; both show up with details', async ({ page }) => {
  await loginOwner(page);

  await page.goto('/admin/companies');
  await page.getByText('+ Add company').click();
  await page.getByLabel('Company name').fill(`XYZ Textiles ${run}`);
  await page.getByLabel('Contact person (optional)').fill('Ramesh');
  await page.getByLabel('Phone (optional)').fill('98765 43210');
  await page.getByRole('button', { name: 'Add company' }).click();
  await expect(page.getByRole('status')).toContainText(`XYZ Textiles ${run} added.`);
  const supplierCard = page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(`XYZ Textiles ${run}`) });
  await expect(supplierCard).toContainText('Ramesh · 98765 43210');
  await supplierCard.click();
  await expect(page.getByRole('heading', { level: 1, name: `XYZ Textiles ${run}` })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Call 98765 43210' })).toHaveAttribute('href', 'tel:9876543210');

  // Duplicate supplier is refused.
  await page.goto('/admin/companies');
  await page.getByText('+ Add company').click();
  await page.getByLabel('Company name').fill(`XYZ Textiles ${run}`);
  await page.getByRole('button', { name: 'Add company' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'A company with that name already exists.' })).toBeVisible(); // the inline message (the red done card says it too)

  await page.goto('/admin/categories');
  const addCategory = page.locator('details', { hasText: '+ Add category' });
  await addCategory.getByText('+ Add category').click();
  await addCategory.getByLabel('Category name').fill(`Lehenga ${run}`);
  await addCategory.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByRole('status')).toContainText(`Lehenga ${run} added with code`);
  // Wait for the post-save refresh to settle (old and new list can overlap for a moment).
  const list = page.getByTestId('category-list').filter({ hasText: `Lehenga ${run}` });
  await expect(list).toHaveCount(1);
  await expect(list).toContainText('Kurta');
});

test('phone layout: bottom tab bar navigates the admin area', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone-only layout');
  await loginOwner(page);
  const tabs = page.getByRole('navigation', { name: 'Main' });
  await expect(tabs).toBeVisible();
  await tabs.getByRole('link', { name: '+ Stock' }).click();
  await expect(page).toHaveURL(/\/admin\/stock$/);
  await expect(page.getByRole('link', { name: /New item/ })).toBeVisible();
  await tabs.getByRole('link', { name: 'More' }).click();
  await page.getByRole('link', { name: /^Companies/ }).click();
  await expect(page).toHaveURL(/\/admin\/companies$/);
  await tabs.getByRole('link', { name: 'More' }).click();
  await page.getByRole('link', { name: /Categories/ }).click();
  await expect(page).toHaveURL(/\/admin\/categories$/);
  await tabs.getByRole('link', { name: 'Products' }).click();
  await expect(page.getByTestId('design-list')).toContainText('Classic Crew Tee'); // every product, one card per design (ADR-058)
  await expect(tabs.getByRole('link', { name: 'Products' })).toHaveAttribute('aria-current', 'page');
});

test('owner enters a new design from a supplier in sizes, prints labels; salesman can scan it', async ({ page }) => {
  await loginOwner(page);
  // Supplier for this run.
  await page.goto('/admin/companies');
  await page.getByText('+ Add company').click();
  await page.getByLabel('Company name').fill(`Design Co ${run}`);
  await page.getByRole('button', { name: 'Add company' }).click();
  await expect(page.getByRole('status')).toContainText('added');
  await page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(`Design Co ${run}`) }).click();
  await page.getByRole('link', { name: `+ New item from Design Co ${run}` }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/new\?supplier=/); // the New item steps (plan v19)
  // This test covers the earlier form (sizes × colours, photos), kept at /admin/stock/form.
  await page.goto(page.url().replace('/admin/stock/new', '/admin/stock/form'));

  // Company preselected; brand (Other details) defaults to the company name. Details is the tab open first.
  await expect(page.getByRole('tab', { name: 'Details', exact: true })).toHaveAttribute('aria-selected', 'true');
  await tab(page, 'Other details');
  await expect(page.getByLabel('Brand')).toHaveValue(`Design Co ${run}`);
  // Header: name, category and "for whom" tags; then the must-haves.
  await page.getByLabel('Product name').fill(`Chikan Kurta ${run}`);
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByRole('group', { name: 'For' }).getByRole('button', { name: 'Girls' }).click();
  await page.getByRole('group', { name: 'Age' }).getByRole('button', { name: 'Adult' }).click();
  await expect(page.getByRole('group', { name: 'For' }).getByRole('button', { name: 'Girls' })).toHaveAttribute('aria-pressed', 'true');
  await salePrice(page).fill('1499');
  await purchasePrice(page).fill('800');
  await showVariants(page);
  await page.getByRole('button', { name: 'Size M' }).click();
  await page.getByRole('button', { name: 'Size L' }).click();
  // No colour box any more (owner, 2026-11-22).
  await expect(page.getByLabel('Colour', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('item-size-pills')).toHaveText('ML');
  await expect(page.getByTestId('combo-grid').getByRole('row')).toHaveCount(2); // sizes + pieces
  await tab(page, 'Details');
  await page.getByLabel('Pieces each').fill('2');
  await page.getByLabel('Counter price, if lower (₹)').fill('1399');
  await page.getByLabel('Company bill no. (optional)').fill('INV-42');
  await expect(page.getByTestId('design-preview')).toHaveText('2 items · 4 pcs · purchase ₹3,200.00');
  await page.getByRole('button', { name: 'Save 2 items' }).click();

  // Labels: one per piece by default (4), or one per item (2). No colour on the lines or tags.
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  await expect(page.getByText('Saved 2 new items with barcodes.')).toBeVisible();
  await expect(page.getByTestId('receipt-lines')).toContainText(`Chikan Kurta ${run} · L`);
  // Plan v19: "Add next item" opens the New item steps with the company, section (Kurta → Men) and bill no. kept.
  await expect(page.getByRole('link', { name: '+ Add next item' })).toHaveAttribute('href', /^\/admin\/stock\/new\?supplier=[0-9a-f-]{36}&section=[0-9a-f-]{36}&bill=INV-42&n=[0-9a-f-]{36}$/);
  const labels = page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode 200/ });
  await expect(labels).toHaveCount(4);
  await expect(page.getByTestId('hang-tag').first()).not.toContainText('Colour');
  await page.getByRole('link', { name: 'One per item instead (2)' }).click();
  await expect(labels).toHaveCount(2);
  const barcode = (await labels.first().getAttribute('aria-label'))?.match(/Barcode (\d{13})/)?.[1];
  expect(barcode).toMatch(/^200\d{10}$/);

  // Item page (ADR-059): the For / Age labels on top; every size with its pieces in the editor.
  await page.getByTestId('receipt-lines').getByRole('link').first().click();
  await expect(page.getByTestId('item-chips')).toContainText('Girls');
  await expect(page.getByTestId('item-chips')).toContainText('Adult');
  await expect(page.getByTestId('size-row')).toHaveCount(2);
  await expect(page.getByTestId('size-row').filter({ hasText: /^L/ })).toContainText('2 pcs');
  // More: change "for whom" for the whole design.
  await page.getByTestId('item-more').locator('summary').click();
  await page.getByRole('group', { name: 'For' }).getByRole('button', { name: 'Both' }).click();
  await page.getByRole('button', { name: 'Save tags' }).click();
  await expect(page.getByText('Tags saved for 2 items.')).toBeVisible();
  // New prices for the whole design (both sizes): ✎ Edit details (ADR-061).
  await page.getByTestId('edit-details').click();
  const details = page.getByTestId('details-sheet');
  await details.getByLabel('MRP ₹').fill('1599');
  await details.getByLabel('Selling ₹').fill('1499');
  await details.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByTestId('done-overlay')).toContainText('Saved');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('item-prices')).toContainText('MRP ₹1,599.00');
  await expect(page.getByTestId('item-prices')).toContainText('Selling ₹1,499.00');

  // Same entry again is refused (the size already exists).
  await page.goto('/admin/stock/form');
  await choose(companyBox(page), `Design Co ${run}`);
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Product name').fill(`Chikan Kurta ${run}`);
  await salePrice(page).fill('1499');
  await purchasePrice(page).fill('800');
  await showVariants(page);
  await page.getByRole('button', { name: 'Size M' }).click();
  await page.getByRole('button', { name: /^Save 1 item/ }).click();
  await expect(page.getByText(/Already in the catalogue: M \(MAA-KU-/)).toBeVisible();

  // A salesman scans the new barcode at the counter.
  await page.context().clearCookies(); // switch user: start logged out
  await page.goto('/login');
  await page.getByText('Vishal', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await page.keyboard.type(barcode!, { delay: 5 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('item-details')).toContainText(`Chikan Kurta ${run}`);
  await expect(page.getByTestId('details-stock')).toHaveText('2');
  await expect(page.getByTestId('item-details')).toContainText('₹1,499.00');
});

test('owner gives sizes their own MRP, selling and purchase price', async ({ page }) => {
  await loginOwner(page);
  const name = `Linen Shirt ${run}`;
  await page.goto('/admin/stock/form');
  await choose(companyBox(page), 'Royal Garments');
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Product name').fill(name);
  await salePrice(page).fill('700');
  await purchasePrice(page).fill('300');
  await page.getByLabel('Counter price, if lower (₹)').fill('500');
  await showVariants(page);
  for (const size of ['XL', 'M', 'L']) await page.getByRole('button', { name: `Size ${size}`, exact: true }).click();

  // Sizes listed in shop order; empty boxes show the default.
  await page.getByText('Price by size (optional)').click();
  const editor = page.getByTestId('size-rates');
  await expect(editor.getByLabel(/^Size \S+ MRP$/)).toHaveCount(3);
  await expect(editor.getByLabel('Size M selling price')).toHaveAttribute('placeholder', '500');
  await editor.getByLabel('Size L selling price').fill('550');
  await editor.getByLabel('Size L purchase price').fill('330');
  await editor.getByLabel('Size XL MRP').fill('750');
  await editor.getByLabel('Size XL selling price').fill('600');
  await editor.getByLabel('Size XL purchase price').fill('360');
  await expect(editor).toContainText('2 sizes with own price');

  const preview = page.getByTestId('size-rates-preview');
  await expect(preview).toContainText('M: ₹500.00 · MRP ₹700.00 · purchase ₹300.00 (default)');
  await expect(preview).toContainText('L: ₹550.00 · MRP ₹700.00 · purchase ₹330.00 (own price)');
  await expect(preview).toContainText('XL: ₹600.00 · MRP ₹750.00 · purchase ₹360.00 (own price)');
  // (300 + 330 + 360) × 1 piece
  await expect(page.getByTestId('design-preview')).toContainText('purchase ₹990.00');

  // Above MRP for one size is flagged in the preview and refused by the server.
  await editor.getByLabel('Size XL selling price').fill('800');
  await expect(page.getByText('Selling price is above MRP for size XL.')).toBeVisible();
  await page.getByRole('button', { name: 'Save 3 items' }).click();
  await expect(page.getByText('Size XL: Selling price cannot be above MRP.')).toBeVisible();
  await editor.getByLabel('Size XL selling price').fill('600');
  await page.getByRole('button', { name: 'Save 3 items' }).click();

  // Labels print each size's own MRP.
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  await expect(page.getByText('Saved 3 new items with barcodes.')).toBeVisible();
  const labels = page.getByTestId('label-sheet').getByRole('listitem');
  await expect(labels.filter({ hasText: 'MRP ₹750.00' })).toHaveCount(1);
  await expect(labels.filter({ hasText: 'MRP ₹700.00' })).toHaveCount(2);

  // Products: XL has its own MRP, so it is a card of its own (same name, company and MRP = one card);
  // each card: its sizes' own purchase prices per piece (ADR-057/070).
  await page.goto('/admin/products');
  const cards = productCard(page, name);
  await expect(cards).toHaveCount(2);
  const mAndL = cards.filter({ has: page.getByTestId('card-cost').getByText('₹300–₹330/pc', { exact: true }) });
  await expect(mAndL).toHaveCount(1);
  await expect(mAndL.getByTestId('card-mrp')).toHaveText('MRP ₹700');
  const xl = cards.filter({ has: page.getByTestId('card-cost').getByText('₹360/pc', { exact: true }) });
  await expect(xl).toHaveCount(1);
  await expect(xl.getByTestId('card-mrp')).toHaveText('MRP ₹750');

  // Item page (ADR-061): the prices line shows each price's range; ✎ Edit details has empty boxes
  // marked "By size" — left empty, each size keeps its own; a typed price goes to every size.
  await mAndL.getByRole('link', { name, exact: true }).click();
  await expect(page.getByTestId('item-prices')).toContainText('MRP ₹700.00–₹750.00');
  await page.getByTestId('edit-details').click();
  const details = page.getByTestId('details-sheet');
  for (const box of ['MRP ₹', 'Selling ₹', 'Purchase ₹']) {
    await expect(details.getByLabel(box)).toHaveValue('');
    await expect(details.getByLabel(box)).toHaveAttribute('placeholder', 'By size');
  }
  await details.getByRole('button', { name: 'Cancel' }).click();
  // Correcting M's pieces leaves every price alone.
  await page.getByRole('button', { name: 'Change M', exact: true }).click();
  await page.getByLabel('Pieces of M', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByTestId('done-overlay')).toContainText('Saved');
  await page.keyboard.press('Escape');
  await page.goto('/admin/products');
  await expect(mAndL).toHaveCount(1); // purchase prices untouched
  await expect(xl).toHaveCount(1);
  // One selling price for every size; MRP stays by size.
  await mAndL.getByRole('link', { name, exact: true }).click();
  await page.getByTestId('edit-details').click();
  await details.getByLabel('Selling ₹').fill('550');
  await details.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByTestId('done-overlay')).toContainText('Saved');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('item-prices')).toContainText('Selling ₹550.00');
  await expect(page.getByTestId('item-prices')).toContainText('MRP ₹700.00–₹750.00');
});

test('hang tags: QR code, size boxed, the design\'s sizes with this one highlighted; the QR link opens the item', async ({ page }) => {
  await loginOwner(page);
  // Anarkali Kurta M Blue (MAA-KU-001); the design also has L.
  await openProduct(page, 'Anarkali Kurta'); // its first size, M = MAA-KU-001
  const productUrl = page.url();
  // The tag as it prints: the item page draws it only for Print tag (ADR-059); the print page shows it.
  await page.goto(`/admin/labels/print?items=${productUrl.split('/').pop()}&each=item`); // one tag, whatever the stock
  const tag = page.getByTestId('hang-tag').first();
  await expect(tag.getByRole('img', { name: 'QR code for MAA-KU-001' })).toBeVisible();
  await expect(tag.getByRole('img', { name: 'Barcode 8902222000016 for MAA-KU-001' })).toBeVisible();
  await expect(tag.getByTestId('tag-size')).toHaveText('M');
  // Every size of the category (Kurta: M–XXL) with a tick box; this piece's box is filled.
  await expect(tag.getByRole('list', { name: 'Sizes — tick one with a pen' }).getByRole('listitem')).toHaveText(['M', 'L', 'XL', 'XXL']);
  await expect(tag.locator('[aria-current="true"]')).toHaveText('M');
  await expect(tag).toContainText('ART.: MAA-KU-001');
  await expect(tag).toContainText('Anarkali Kurta');
  await expect(tag).toContainText('MRP ₹1,299.00');
  const box = await tag.boundingBox();
  expect([Math.round(box!.width), Math.round(box!.height)]).toEqual([151, 227]); // 40 × 60 mm

  // The QR holds /i/<barcode>: the owner lands on the product page…
  await page.goto('/i/8902222000016');
  await expect(page).toHaveURL(productUrl);
  // …a salesman on the counter with the item ready to sell; logged out → login.
  await page.context().clearCookies();
  await page.goto('/i/8902222000016');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByText('Pradeep', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/pos$/);
  await page.goto('/i/8902222000016');
  await expect(page).toHaveURL(/\/pos\?code=8902222000016$/);
  await expect(page.getByTestId('item-details')).toContainText('Anarkali Kurta');
  await expect(page.getByTestId('item-details')).not.toContainText(/purchase/i);
  // A scanner that reads the QR types the whole link: it still finds the item.
  await page.goto('/pos');
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await page.keyboard.type('https://maa-collection-pi.vercel.app/i/8901111000014', { delay: 2 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('item-details')).toContainText('Classic Crew Tee');
});

test('each category has its sizes: owner sets them with a preset; new stock offers them first', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/admin/categories');
  await page.getByText('+ Add category').click();
  const addForm = page.locator('details', { hasText: '+ Add category' });
  await addForm.getByLabel('Category name').fill(`Gents Trousers ${run}`);
  await addForm.getByRole('group', { name: 'Size presets' }).getByRole('button', { name: 'Gents 28–36' }).click();
  await expect(addForm.getByLabel('Sizes (in shop order)')).toHaveValue('28, 30, 32, 34, 36');
  await addForm.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByRole('status')).toContainText(`Gents Trousers ${run} added`);
  await page.reload();
  const row = page.getByTestId('category-list').getByRole('listitem').filter({ hasText: `Gents Trousers ${run}` });
  await expect(row.getByTestId('category-sizes')).toHaveText('Sizes: 28 · 30 · 32 · 34 · 36');
  // The built-in jeans categories by gender (plan v19: Ladies Jeans sits under the Women tile).
  await page.getByTestId('section-tiles').getByRole('link', { name: /^Women/ }).click();
  await expect(page.getByTestId('category-list').getByRole('listitem').filter({ hasText: 'Ladies Jeans' }).getByTestId('category-sizes')).toHaveText('Sizes: 26 · 28 · 30 · 32');

  // New stock: choose the category first → its sizes come first; "Pick all" takes them all.
  await page.goto('/admin/stock/form');
  await showVariants(page);
  await expect(page.getByText('Choose the category above to see its sizes first.')).toBeVisible();
  const option = page.getByLabel('Category').locator('option', { hasText: `Gents Trousers ${run}` });
  await page.getByLabel('Category').selectOption((await option.getAttribute('value'))!);
  const chips = page.getByTestId('category-size-chips');
  await expect(chips.getByRole('button', { name: /^Size / })).toHaveText(['28', '30', '32', '34', '36']);
  await chips.getByRole('button', { name: 'Pick all' }).click();
  await expect(chips.getByRole('button', { name: /^Size /, pressed: true })).toHaveCount(5);
});

test('categories by section (plan v19; ADR-066): tiles with their products and the figures of the one chosen; the owner\'s own section with its picture; a category with a Hindi name under it', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/admin/categories');
  const tiles = page.getByTestId('section-tiles');
  const list = page.getByTestId('category-list');
  const figures = page.getByTestId('collection-figures');
  // Tile texts are "Name<n> products" ("1 product").
  const order = async () => tiles.getByRole('link').allTextContents();
  await expect(tiles.getByRole('link').nth(3)).toContainText('Girls');
  expect((await order()).slice(0, 4).map((text) => text.replace(/\d+ products?$/, ''))).toEqual(['Men', 'Women', 'Boys', 'Girls']);
  // No collection card with ▲ / ▼ any more (owner, 2026-11-22): the figures instead.
  await expect(page.getByTestId('section-head')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Move .* (up|down)$/ })).toHaveCount(0);
  // Men opens first: its categories only.
  await expect(figures).toHaveAccessibleName('Figures of Men');
  await expect(list).toContainText('Kurta');
  await expect(list).not.toContainText('Saree');
  await tiles.getByRole('link', { name: /^Women/ }).click();
  await expect(page).toHaveURL(/\/admin\/categories\?s=[0-9a-f-]{36}$/);
  await expect(list).toContainText('Saree');
  await expect(figures).toHaveAccessibleName('Figures of Women');

  // The owner's own section (e.g. Kids) goes last, with its picture.
  await page.getByText('+ Add collection').click();
  const addSection = page.locator('details', { hasText: '+ Add collection' });
  await addSection.getByLabel('Collection name').fill(`Kids ${run}`);
  await addSection.locator('label').filter({ hasText: 'Baby' }).click();
  await addSection.getByRole('button', { name: 'Add collection' }).click();
  await expect(addSection.getByRole('status')).toContainText(`Kids ${run} added.`);
  await expect(tiles.getByRole('link').filter({ hasNotText: 'Needs sorting' }).last()).toContainText(`Kids ${run}`); // Needs sorting stays last
  await tiles.getByRole('link', { name: `Kids ${run}` }).click();
  await expect(figures).toHaveAccessibleName(`Figures of Kids ${run}`);
  await expect(figures.getByTestId('fig-categories')).toHaveText('0');
  await expect(figures.getByTestId('fig-products')).toHaveText('0');
  await expect(page.getByText('No categories here yet.')).toBeVisible();

  // A category with a Hindi name lands under it.
  await page.getByText('+ Add category').click();
  const addCategory = page.locator('details', { hasText: '+ Add category' });
  await addCategory.getByLabel('Category name').fill(`Frock ${run}`);
  await addCategory.getByLabel('Hindi name (optional)').fill('फ़्रॉक');
  await addCategory.getByRole('button', { name: 'Add category' }).click();
  await expect(addCategory.getByRole('status')).toContainText(`Frock ${run} added with code`);
  await expect(list.getByRole('listitem').filter({ hasText: `Frock ${run}` })).toContainText('फ़्रॉक');
  await expect(figures.getByTestId('fig-categories')).toHaveText('1');

  // The same section name again is refused (the add form is still open from before).
  if (!(await addSection.getByLabel('Collection name').isVisible())) await page.getByText('+ Add collection').click();
  await addSection.getByLabel('Collection name').fill(`Kids ${run}`);
  await addSection.getByRole('button', { name: 'Add collection' }).click();
  await expect(addSection.getByRole('alert')).toContainText('That name is already in the list.');
});

// The next two share the seed's one old-style category ("Dress Material", under no section):
// desktop only, in this order, so the phone run cannot sort it first.
test('plan v19: New item refuses a category that is not sorted under a section yet', async ({ page, isMobile }) => {
  test.skip(isMobile, 'one shared seed row; the desktop run covers it');
  await loginOwner(page);
  await page.goto('/admin/stock/form');
  await choose(companyBox(page), 'Shree Ganesh Textiles');
  await page.getByLabel('Category').selectOption({ label: 'Dress Material (DM)' });
  await page.getByLabel('Product name').fill(`Cotton Suit Piece ${run}`);
  await salePrice(page).fill('900');
  await purchasePrice(page).fill('500');
  await page.getByLabel('Pieces', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Save 1 item' }).click();
  await expect(page.getByText('Put this category under a collection first (Categories).')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/stock\/form$/);
});

test('plan v19: Needs sorting → Move under puts the shop\'s old category under a section; the tile goes once it is empty', async ({ page, isMobile }) => {
  test.skip(isMobile, 'one shared seed row; the desktop run covers it');
  await loginOwner(page);
  await page.goto('/admin/categories');
  const tiles = page.getByTestId('section-tiles');
  const list = page.getByTestId('category-list');
  await tiles.getByRole('link', { name: /^Needs sorting/ }).click();
  await expect(page).toHaveURL(/\?s=unsorted$/);
  await expect(list).toContainText('Dress Material');
  await expect(page.getByTestId('section-head')).toHaveCount(0);
  await list.getByLabel('Move under Dress Material').selectOption({ label: 'Women' });
  await list.getByRole('button', { name: 'Move' }).click();
  // The row leaves the list as it is sorted; the tile goes with it.
  await expect(tiles.getByRole('link', { name: /^Needs sorting/ })).toHaveCount(0);
  await expect(page.getByText('No categories here yet.')).toBeVisible();
  await tiles.getByRole('link', { name: /^Women/ }).click();
  await expect(list.getByRole('listitem').filter({ hasText: 'Dress Material' })).toContainText('DM');
});

test('photos while creating tags: the main photo goes on every size of a new item', async ({ page }) => {
  await loginOwner(page);
  const jpeg = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 500;
      const g = c.getContext('2d')!;
      g.fillStyle = '#1d4ed8';
      g.fillRect(0, 0, 400, 500);
      return c.toDataURL('image/jpeg', 0.9).split(',')[1];
    }),
    'base64',
  );
  const file = { name: 'item.jpg', mimeType: 'image/jpeg', buffer: jpeg };

  // Two sizes, one main photo: every size gets it (no photo per colour since 2026-11-22 — colour lives on the product page).
  await page.goto('/admin/stock/form');
  await choose(companyBox(page), 'Royal Garments');
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Product name').fill(`Photo Kurta ${run}`);
  await salePrice(page).fill('999');
  await purchasePrice(page).fill('500');
  await page.getByTestId('item-photo').getByLabel('Gallery for this item').setInputFiles(file);
  await showVariants(page);
  await page.getByRole('button', { name: 'Size M', exact: true }).click();
  await page.getByRole('button', { name: 'Size L', exact: true }).click();
  await expect(page.getByTestId('colour-photos')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save 2 items' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  await expect(page.getByText('Saved 2 new items with barcodes.')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'photo could not be saved' })).toHaveCount(0);

  // L (not the first item) shows the photo too.
  await page.getByTestId('receipt-lines').getByRole('link', { name: `Photo Kurta ${run} · L` }).click();
  const photo = page.getByTestId('item-head').getByRole('img', { name: `Photo Kurta ${run}` }); // the item page's photo (ADR-059)
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // One plain item: the main photo fills the box at the top. The old quick-add address lands on the earlier form.
  await page.goto('/admin/stock/quick');
  await expect(page).toHaveURL(/\/admin\/stock\/form$/);
  const box = page.getByTestId('item-photo');
  await choose(companyBox(page), 'Shree Ganesh Textiles');
  await page.getByLabel('Category').selectOption({ label: 'Saree (SA)' });
  await page.getByLabel('Product name').fill(`Photo Saree ${run}`);
  await salePrice(page).fill('1500');
  await purchasePrice(page).fill('900');
  await box.getByLabel('Gallery for this item').setInputFiles(file);
  await expect(box.getByRole('img', { name: 'Photo for this item' })).toBeVisible();
  await expect(box.getByRole('button', { name: 'Remove photo for this item' })).toBeVisible();
  await page.getByRole('button', { name: 'Save 1 item' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  await expect(page.getByRole('alert').filter({ hasText: 'photo could not be saved' })).toHaveCount(0);
  await page.getByTestId('receipt-lines').getByRole('link', { name: new RegExp(`^Photo Saree ${run}`) }).click();
  await expect(page.getByTestId('item-head').getByRole('img', { name: `Photo Saree ${run}` })).toBeVisible(); // the item page's photo
});

test('company box: add a company on the spot, the same name is reused, a hidden company comes back from "Previous companies"', async ({ page }) => {
  await loginOwner(page);
  const fresh = `Fresh Co ${run}`;
  // New item: "+ New company…" adds it and chooses it.
  await page.goto('/admin/stock/form');
  await choose(companyBox(page), '+ New company…');
  await page.getByLabel('New company name').fill(fresh);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(companyBox(page)).toHaveText(fresh);
  // The same name again (other letters case) is reused, never doubled.
  await choose(companyBox(page), '+ New company…');
  await page.getByLabel('New company name').fill(fresh.toLowerCase());
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(companyBox(page)).toHaveText(fresh);
  await companyBox(page).click();
  await expect(page.getByRole('listbox').getByRole('option', { name: fresh, exact: true })).toHaveCount(1);
  await page.keyboard.press('Escape');

  // Hide it: Companies → the company → untick Active.
  await page.goto('/admin/companies');
  await page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(fresh) }).click();
  await page.getByRole('tab', { name: 'Details', exact: true }).click(); // company page tabs (company accounts, 2026-11-20)
  await page.getByText('Edit company details').click();
  await page.getByLabel(/^Active/).uncheck();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toBeVisible();

  // Tag old stock: it is under "Previous companies"; choosing it brings it back.
  await page.goto('/admin/stock/old');
  const box = page.getByRole('combobox', { name: /^Company/ });
  const option = page.getByRole('listbox').getByRole('option', { name: fresh, exact: true });
  await box.click();
  await expect(option).toHaveAttribute('data-group', 'Previous companies');
  await option.click();
  await expect(box).toHaveText(fresh);
  await box.click();
  await expect(option).not.toHaveAttribute('data-group', 'Previous companies');
  await page.keyboard.press('Escape');
  // A normal company again everywhere.
  await page.goto('/admin/products/new');
  const single = page.getByRole('combobox', { name: /^Company/ });
  await single.click();
  const again = page.getByRole('listbox').getByRole('option', { name: fresh, exact: true });
  await expect(again).toHaveCount(1);
  await expect(again).not.toHaveAttribute('data-group', 'Previous companies');
  await page.keyboard.press('Escape');
});

test('staff: owner adds a salesman, removes them (gone from the login screen), and brings them back', async ({ page }) => {
  await loginOwner(page);
  const name = `Temp ${run}`;
  await page.goto('/admin/staff');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('PIN (4–6 digits)').fill('4321');
  await page.getByRole('button', { name: 'Add staff' }).click();
  await expect(page.getByRole('status')).toContainText(`${name} added`);
  const row = page.getByTestId('staff-list').getByRole('listitem').filter({ hasText: name });
  await expect(row).toContainText('Salesman');

  // Remove asks once; then the person moves to "Removed staff".
  await row.getByRole('button', { name: 'Remove' }).click();
  await expect(row).toContainText(`Remove ${name}? They can no longer log in. Their past sales stay.`);
  await row.getByRole('button', { name: 'Yes, remove' }).click();
  const removed = page.getByTestId('removed-staff').getByRole('listitem').filter({ hasText: name });
  await expect(removed).toBeVisible();
  await expect(page.getByTestId('staff-list').getByRole('listitem').filter({ hasText: name })).toHaveCount(0);
  await page.context().clearCookies();
  await page.goto('/login');
  await expect(page.getByText('Owner', { exact: true })).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);

  // Bring back: on the login screen again.
  await loginOwner(page);
  await page.goto('/admin/staff');
  await page.getByTestId('removed-staff').getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Bring back' }).click();
  await expect(page.getByTestId('staff-list').getByRole('listitem').filter({ hasText: name })).toBeVisible();
  await page.context().clearCookies();
  await page.goto('/login');
  await expect(page.getByText(name, { exact: true })).toBeVisible();
});

test('header: the full shop name, अ / A and a ⋯ menu with colours, sound, Guide and Log out', async ({ page }) => {
  await loginOwner(page);
  const header = page.getByRole('banner'); // the visible header (Next may keep the last screen's hidden)
  await expect(header.getByText('Maa Collection', { exact: true })).toBeVisible();
  await expect(page.getByTestId('current-user')).toHaveText('Owner · Admin');
  const buttons = page.getByTestId('header-buttons').getByRole('button');
  await expect(buttons).toHaveCount(2);
  await expect(buttons.first()).toHaveAccessibleName('Language: English. Switch to Hindi');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await menu.getByRole('radio', { name: 'Neel' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'neel');
  await menu.getByRole('radio', { name: 'Bahi' }).click();
  await expect(menu.getByRole('button', { name: 'Sound and vibration for scans' })).toBeVisible();
  await menu.getByRole('link', { name: 'Guide' }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(menu).toBeHidden(); // a new screen closes the menu
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('Products → Select (owner, ADR-057): one bar at the bottom — Select all · Cancel · Delete; nothing at the top', async ({ page }) => {
  await loginOwner(page);
  const name = `Sel Tee ${run}`;
  await page.goto('/admin/stock/form');
  await choose(companyBox(page), 'Royal Garments');
  await page.getByLabel('Category').selectOption({ label: 'T-Shirt (TS)' });
  await page.getByLabel('Product name').fill(name);
  await salePrice(page).fill('600');
  await purchasePrice(page).fill('300');
  await showVariants(page);
  for (const size of ['M', 'L', 'XL']) await page.getByRole('button', { name: `Size ${size}`, exact: true }).click();
  await page.getByRole('button', { name: 'Save 3 items' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);

  await page.goto('/admin/products');
  const card = productCard(page, name);
  await expect(card).toHaveAttribute('data-items', '3');
  // A long-press on a card starts selecting with that card — all 3 of its items — ticked (and does not open it).
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 12);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  const bar = page.getByTestId('selection-bar');
  // Everything sits in the bottom bar: Select all, Cancel and Delete — no Hide, Rename, Company,
  // Category, For / Age, Prices or Print tags, and no bar at the top (the header stays).
  await expect(bar.getByTestId('selected-count')).toHaveText('3 selected');
  await expect(page).toHaveURL(/\/admin\/products$/);
  const selectAll = bar.getByRole('checkbox', { name: 'Select all', exact: true });
  await expect(bar.getByRole('button')).toHaveText(['Cancel', 'Delete']);
  await expect(page.getByTestId('selection-top')).toHaveCount(0);
  await expect(page.getByRole('banner')).toBeInViewport();
  // Select all: every item of the shop (only ticked here, never deleted — other tests share the shop).
  await selectAll.click();
  await expect(selectAll).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('selected-count')).toHaveText(/^\d+ selected$/);
  await expect(page.getByTestId('selected-count')).not.toHaveText('3 selected');
  // Select all again: nothing ticked.
  await selectAll.click();
  await expect(page.getByTestId('selected-count')).toHaveText('Select items');
  await expect(selectAll).toHaveAttribute('aria-checked', 'false');
  // A tap on the card ticks it (a layer over the card takes the tap while selecting); Cancel leaves
  // selection mode and the Select button is back.
  const tapAt = (await card.boundingBox())!;
  await page.mouse.click(tapAt.x + tapAt.width / 2, tapAt.y + tapAt.height - 12);
  await expect(page.getByTestId('selected-count')).toHaveText('3 selected');
  await bar.getByRole('button', { name: 'Cancel' }).click();
  await expect(bar).toBeHidden();
  await expect(page.getByTestId('select-products')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/products$/); // a tap while selecting ticks, it never opens the item
});

test('selecting on a long list: the bottom bar (Select all, Cancel, actions) stays on screen while scrolling', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/admin/products'); // every design: a long page
  await page.getByTestId('select-products').click();
  const viewport = page.viewportSize()!;
  for (const to of ['bottom', 'middle'] as const) {
    await page.evaluate((where) => window.scrollTo(0, where === 'bottom' ? document.documentElement.scrollHeight : document.documentElement.scrollHeight / 2), to);
    // (polls: the bar slides in for a moment) On a phone it sits on the bottom edge; on wider screens it floats 16 px above it.
    const gap = viewport.width < 640 ? 0 : 16;
    await expect.poll(async () => {
      const bottom = (await page.getByTestId('selection-bar').boundingBox())!;
      return Math.round(bottom.y + bottom.height);
    }).toBe(viewport.height - gap);
  }
  await expect(page.getByRole('checkbox', { name: 'Select all', exact: true })).toBeInViewport();
  await expect(page.getByTestId('selection-bar').getByRole('button', { name: 'Cancel' })).toBeInViewport();
  await expect(page.getByTestId('selection-top')).toHaveCount(0);
  // The phone's menu dock steps aside while selecting.
  if (viewport.width < 640) await expect(page.getByRole('navigation', { name: 'Main' })).not.toBeInViewport();
});

test('Companies and All tags → Select: delete companies after a confirmation; print chosen tags', async ({ page }) => {
  await loginOwner(page);
  const a = `Sel Co A ${run}`;
  const b = `Sel Co B ${run}`;
  for (const company of [a, b]) {
    await page.goto('/admin/companies');
    await page.getByText('+ Add company').click();
    await page.getByLabel('Company name').fill(company);
    await page.getByRole('button', { name: 'Add company' }).click();
    await expect(page.getByRole('status')).toContainText(`${company} added.`);
  }
  await page.goto('/admin/companies');
  await page.getByTestId('select-companies').click();
  // The tick sits beside the row, never over the name (owner, 2026-11-21).
  const tick = page.getByRole('checkbox', { name: `Select ${a}` });
  const name = page.getByTestId('supplier-list').getByText(a, { exact: true });
  await expect
    .poll(async () => (await name.boundingBox())!.x - ((await tick.boundingBox())!.x + (await tick.boundingBox())!.width))
    .toBeGreaterThanOrEqual(0); // the row slides right; wait for it
  await tick.check();
  await page.getByRole('checkbox', { name: `Select ${b}` }).check();
  // Delete only (no Hide / Bring back), and it asks first.
  const bar = page.getByTestId('selection-bar');
  await expect(bar.getByRole('button', { name: 'Hide' })).toHaveCount(0);
  await bar.getByRole('button', { name: 'Delete' }).click();
  const ask = page.getByRole('dialog', { name: 'Delete 2 companies?' });
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Cancel' }).click(); // the sheet's Cancel (the bar has one too)
  await expect(page.getByTestId('supplier-list')).toContainText(a);
  await bar.getByRole('button', { name: 'Delete' }).click();
  await page.getByTestId('confirm-delete').click();
  await expect(page.getByTestId('selection-toast')).toContainText('2 companies deleted.');
  await page.getByTestId('company-search').fill(`Sel Co`);
  await expect(page.getByTestId('supplier-list').getByText(a, { exact: true })).toHaveCount(0);
  // Any company can go; its items stay with no company (e2e/companies-collections.spec.ts, unit test: deleteCompanies).

  // All tags: tick two tags and print only those.
  await page.goto('/admin/labels?q=MAA-TS-00&show=tags');
  await page.getByTestId('select-tags').click();
  const ticks = page.getByRole('checkbox', { name: /^Select Classic Crew Tee/ });
  await ticks.nth(0).check();
  await ticks.nth(1).check();
  await page.getByTestId('selection-bar').getByRole('button', { name: 'Print 2 selected' }).click();
  await expect(page.getByRole('heading', { name: 'Selected tags' })).toBeVisible();
  await page.getByRole('link', { name: 'One per item instead (2)' }).click();
  await expect(page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode/ })).toHaveCount(2);
});

test('owner restocks existing items by scanning each piece and by name search', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/admin/stock/receive');
  const scanBox = page.getByLabel('Scan a tag, or type SKU / name');
  await expect(scanBox).toBeFocused();
  // Oxford Shirt scanned three times = 3 pieces.
  for (let i = 0; i < 3; i++) {
    await page.keyboard.type('8905555000012', { delay: 5 });
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Pieces of Oxford Shirt 40')).toHaveValue(String(i + 1));
  }
  const shirtLine = page.getByTestId('restock-lines').getByRole('listitem').filter({ hasText: 'Oxford Shirt' });
  const [, before] = (await shirtLine.innerText()).match(/now (\d+) →/) ?? [];

  // Name search with several matches → pick one, then bump with +.
  await scanBox.fill('Crew Tee');
  await page.keyboard.press('Enter');
  await page.getByTestId('restock-choices').getByRole('button', { name: /Classic Crew Tee · L/ }).click();
  await page.getByRole('button', { name: 'One more Classic Crew Tee L' }).click();
  await expect(page.getByLabel('Pieces of Classic Crew Tee L')).toHaveValue('2');

  await page.getByLabel('Company bill no. (optional)').fill('RS-1');
  await page.getByRole('button', { name: 'Receive 5 pieces and print labels' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  await expect(page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode/ })).toHaveCount(5);
  await expect(page.getByText(/bill RS-1/)).toBeVisible();
  // Back on Receive stock, the received lines are gone: scanning one more piece must not receive them again.
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/stock\/receive$/);
  await expect(page.getByTestId('restock-lines').getByRole('listitem')).toHaveCount(0);
  await expect(page.getByLabel('Company bill no. (optional)')).toHaveValue('');

  // Stock went up by exactly 3 (the sizes and their pieces are on the product page, ADR-070).
  await openProduct(page, 'Oxford Shirt');
  await expect(page.getByTestId('size-row').filter({ visible: true, hasText: /^40/ })).toContainText(`${Number(before) + 3} pcs`); // MAA-SH-001
});

test('a salesman cannot add companies, categories, products, stock or change rates', async ({ page }) => {
  await page.context().clearCookies(); // switch user: start logged out
  await page.goto('/login');
  await page.getByText('Pradeep', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/pos$/);
  for (const path of ['/admin/companies', '/admin/categories', '/admin/stock/new', '/admin/stock/form', '/admin/stock/receive', '/admin/products', '/admin/products/new', '/admin/more', '/admin/labels']) {
    await page.goto(path);
    await expect(page, `${path} must be blocked`).toHaveURL(/\/pos$/);
  }
  // At the counter the only price a salesman sets is this sale's price (max MRP).
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await page.keyboard.type('MAA-TS-002', { delay: 5 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('item-details')).not.toContainText(/cost|purchase/i);
});

test('owner sets a code word; labels print the purchase price in code and the decoder reads it', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/admin/settings');
  await page.getByLabel('Code word (10 different letters)').fill('blackhorse');
  await expect(page.getByTestId('code-key')).toContainText('B');
  await expect(page.getByText('Example: purchase price ₹450 prints as CKE.')).toBeVisible();
  await page.getByLabel('Print the purchase price in this code on barcode labels').check();
  await page.getByRole('button', { name: 'Save code price settings' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await page.reload();
  await page.getByLabel('Decode a tag').fill('lss');
  await expect(page.getByTestId('decoded')).toHaveText('= ₹299');

  // Classic Crew Tee M Black: purchase ₹299 → "LSS" on its label.
  await openProduct(page, 'Classic Crew Tee'); // its first size, M = MAA-TS-001
  await expect(page.getByTestId('price-code')).toHaveText('LSS');
});

test('new item: one plain item with MRP, purchase and pieces on top → labels → "Add next item" keeps company and category → seller scans', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/admin/stock');
  // Add stock: one main way, two other ways.
  await expect(page.getByRole('heading', { name: 'Other ways' })).toBeVisible();
  await expect(page.getByRole('link', { name: /More pieces of an existing item/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Tag old stock/ })).toBeVisible();
  await page.getByRole('link', { name: /New item/ }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/new$/); // the New item steps (plan v19, new-item-wizard.spec.ts)
  await expect(page.getByRole('heading', { level: 2, name: 'Which collection?' })).toBeVisible(); // no One / Many choice (ADR-064)
  // The rest of this test covers the earlier form, kept under Other ways as "Old form".
  await page.goto('/admin/stock');
  await page.getByRole('link', { name: /^Old form/ }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/form$/);
  await choose(companyBox(page), 'Shree Ganesh Textiles');
  await page.getByLabel('Category').selectOption({ label: 'Saree (SA)' });
  await page.getByLabel('Product name').fill(`Georgette Saree ${run}`);
  await salePrice(page).fill('2500');
  await purchasePrice(page).fill('1400');
  await page.getByLabel('Pieces', { exact: true }).fill('3');
  await page.getByLabel('Counter price, if lower (₹)').fill('2200');
  await expect(page.getByTestId('design-preview')).toHaveText('1 item · 3 pcs · purchase ₹4,200.00');
  await page.getByRole('button', { name: 'Save 1 item' }).click();

  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  await expect(page.getByText('Saved 1 new item with barcodes.')).toBeVisible();
  await expect(page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode 200/ })).toHaveCount(3);
  await expect(page.getByTestId('receipt-lines')).toContainText(`Georgette Saree ${run} · Free`);
  const georgette = page.getByTestId('label-sheet').getByRole('listitem').filter({ hasText: `Georgette Saree ${run}` }).first();
  const barcode = (await georgette.getByRole('img', { name: /^Barcode/ }).getAttribute('aria-label'))?.match(/Barcode (\d{13})/)?.[1];

  // Next item (plan v19): the New item steps open at "What is it?" of the same section (Saree → Women), company kept.
  await page.getByRole('link', { name: '+ Add next item' }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/new\?supplier=[0-9a-f-]{36}&section=[0-9a-f-]{36}&n=/);
  await expect(page.getByRole('heading', { level: 2, name: 'What is it?' })).toBeVisible();
  await expect(page.getByTestId('wizard-path')).toHaveText('Women');
  await page.getByRole('button', { name: /^Saree/ }).click();
  // Scoped to the steps' form: Next keeps the earlier form's page alive (hidden) behind this one.
  const steps = page.getByTestId('details-form');
  await expect(steps.getByRole('combobox', { name: /^Company/ })).toHaveText('Shree Ganesh Textiles');
  await expect(steps.getByLabel('Product name')).toHaveValue('');
  await steps.getByLabel('Product name').fill(`Cotton Saree ${run}`);
  await steps.getByLabel('Sale price', { exact: true }).fill('1200');
  await steps.getByLabel('Purchase price', { exact: true }).fill('600');
  // Details and sizes are one step (2026-11-21): Saree's only size, Free, is chosen already.
  await expect(page.getByTestId('size-summary')).toHaveText('1 size · 1 pc');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Save & print tags' }).click();
  await expect(page.getByTestId('receipt-lines')).toContainText(`Cotton Saree ${run} · Free`);

  // The seller scans it: selling price ₹2,200 (MRP ₹2,500), no purchase price shown.
  await page.context().clearCookies(); // switch user: start logged out
  await page.goto('/login');
  await page.getByText('Balram', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await page.keyboard.type(barcode!, { delay: 5 });
  await page.keyboard.press('Enter');
  const details = page.getByTestId('item-details');
  await expect(details).toContainText(`Georgette Saree ${run}`);
  await expect(details).toContainText('₹2,200.00');
  await expect(details).toContainText('₹2,500.00');
  await expect(details).not.toContainText('₹1,400.00');
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await expect(page.getByLabel(/Sale price/)).toHaveValue('2200');
});

test('all tags: grouped by date, company or delivery; filters; grid or sideways rows; print one group', async ({ page }) => {
  await loginOwner(page);
  const company = `Tag Lib Co ${run}`;
  await page.goto('/admin/companies');
  await page.getByText('+ Add company').click();
  await page.getByLabel('Company name').fill(company);
  await page.getByRole('button', { name: 'Add company' }).click();
  await expect(page.getByRole('status')).toContainText(`${company} added.`);

  // One bill from that company, entered as two items: a saree with 2 pieces and one with none left.
  await page.goto('/admin/stock/form');
  await choose(companyBox(page), company);
  await page.getByLabel('Category').selectOption({ label: 'Saree (SA)' });
  await page.getByLabel('Product name').fill(`Silk TagLib ${run}`);
  await salePrice(page).fill('2000');
  await purchasePrice(page).fill('1200');
  await page.getByLabel('Pieces', { exact: true }).fill('2');
  await page.getByLabel('Company bill no. (optional)').fill(`B-${run}`);
  await page.getByRole('button', { name: 'Save 1 item' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  // The second item of the bill through the earlier form again (this test is about All tags).
  await page.goto('/admin/stock/form');
  await choose(companyBox(page), company);
  await page.getByLabel('Category').selectOption({ label: 'Saree (SA)' });
  await page.getByLabel('Product name').fill(`Net TagLib ${run}`);
  await salePrice(page).fill('1500');
  await purchasePrice(page).fill('900');
  await page.getByLabel('Pieces', { exact: true }).fill('0');
  await page.getByLabel('Company bill no. (optional)').fill(`B-${run}`);
  await page.getByRole('button', { name: 'Save 1 item' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);

  // The print page leads to All tags; picking the company applies at once.
  await page.getByRole('link', { name: 'See all tags →' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'All tags' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Company' }).selectOption({ label: company });
  await expect(page).toHaveURL(/supplier=[0-9a-f-]{36}/);
  const groups = page.getByTestId('tag-group');
  const tags = page.getByTestId('tag-library').getByTestId('hang-tag');
  await expect(groups).toHaveCount(1);
  await expect(groups.getByRole('heading', { level: 2 })).toHaveText('Today'); // grouped by date by default
  await expect(tags).toHaveCount(2);
  await expect(page.getByTestId('tag-summary')).toContainText('Tags: 2 · In stock: 2 pcs · Groups: 1');

  // Group by company, then by delivery (bill, date and who made it).
  await page.getByRole('navigation', { name: 'Group by' }).getByRole('link', { name: 'Company' }).click();
  await expect(groups.getByRole('heading', { level: 2 })).toHaveText(company);
  await page.getByRole('navigation', { name: 'Group by' }).getByRole('link', { name: 'Delivery' }).click();
  // Each save is its own delivery (plan v17), both on the same bill.
  await expect(groups.getByRole('heading', { level: 2 })).toHaveText([`${company} · bill B-${run}`, `${company} · bill B-${run}`]);
  await expect(groups.first()).toContainText('by Owner');
  await expect(groups.filter({ hasText: 'Tags: 1 · In stock: 2 pcs' })).toHaveCount(1);

  // Filters: only items in stock; a category with none of them; when made.
  await page.getByLabel('Only items in stock').check();
  await expect(page).toHaveURL(/stock=in/);
  await expect(tags).toHaveCount(1);
  await expect(tags).toContainText(`Silk TagLib ${run}`);
  await page.getByLabel('Only items in stock').uncheck();
  await expect(tags).toHaveCount(2);
  await page.getByRole('navigation', { name: 'When made' }).getByRole('link', { name: 'Today' }).click();
  await expect(tags).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Category' }).selectOption({ label: 'Kurta' });
  await expect(page.getByText('No tags match these filters.')).toBeVisible();
  await page.getByRole('link', { name: 'Clear filters' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\?group=delivery$/);

  // Views: Rows puts each group on one line that scrolls sideways, and the phone remembers it.
  await page.goto(`/admin/labels?q=TagLib ${run}`);
  const library = page.getByTestId('tag-library');
  const row = library.locator('ul.tag-row').first();
  await expect(library).toHaveAttribute('data-view', 'grid');
  await expect(row).toHaveCSS('flex-wrap', 'wrap');
  await page.getByRole('button', { name: 'Rows' }).click();
  await expect(library).toHaveAttribute('data-view', 'rows');
  await expect(row).toHaveCSS('flex-wrap', 'nowrap');
  await expect(row).toHaveCSS('overflow-x', 'auto');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Rows' })).toHaveAttribute('aria-pressed', 'true');
  await expect(library).toHaveAttribute('data-view', 'rows');
  await page.getByRole('button', { name: 'Grid' }).click();
  await expect(library).toHaveAttribute('data-view', 'grid');

  // A tag opens its item (combined view: open the design's tags first).
  await page.getByTestId('design-card').filter({ hasText: `Silk TagLib ${run}` }).getByText('Show 1 tag').click();
  await page.getByRole('link', { name: `Open Silk TagLib ${run} · Free` }).click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);

  // Print one group (by company): one tag per piece in stock, or one per item.
  await page.goto(`/admin/labels?q=TagLib ${run}&group=company`);
  await page.getByRole('link', { name: 'Print this group' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?.*list=1.*key=/);
  await expect(page.getByRole('heading', { level: 1, name: company })).toBeVisible();
  const printed = page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode 200/ });
  await expect(printed).toHaveCount(2);
  await expect(page.getByTestId('label-sheet')).not.toContainText(`Net TagLib ${run}`); // no pieces left, no tag
  await page.getByRole('link', { name: 'One per item instead (2)' }).click();
  await expect(printed).toHaveCount(2);
  await expect(page.getByTestId('label-sheet')).toContainText(`Net TagLib ${run}`);
});

test('combined view: one card per design (name + company + MRP) on Products and All tags; every item one tap away; print one design', async ({ page }) => {
  await loginOwner(page);
  const company = `Combo Co ${run}`;
  const name = `Combo Kurta ${run}`;
  await page.goto('/admin/companies');
  await page.getByText('+ Add company').click();
  await page.getByLabel('Company name').fill(company);
  await page.getByRole('button', { name: 'Add company' }).click();
  await expect(page.getByRole('status')).toContainText(`${company} added.`);

  // One design in 4 sizes = 4 items, 2 pieces each (no colours outside the product page since 2026-11-22).
  await page.goto('/admin/stock/form');
  await choose(companyBox(page), company);
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Product name').fill(name);
  await salePrice(page).fill('1499');
  await purchasePrice(page).fill('800');
  await page.getByLabel('Counter price, if lower (₹)').fill('1399');
  await showVariants(page);
  for (const size of ['M', 'L', 'XL', 'XXL']) await page.getByRole('button', { name: `Size ${size}`, exact: true }).click();
  await tab(page, 'Details');
  await page.getByLabel('Pieces each').fill('2');
  await page.getByRole('button', { name: 'Save 4 items' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);

  // Stocks (ADR-070): every product, one short card for the 4 items — the pieces, the purchase price
  // per piece and the MRP, each said once (no company, item count, "× = total" line or sizes row);
  // no QR code on the card itself, no folding list or print link, and no search, filters or view switch.
  await page.goto('/admin/products');
  const card = productCard(page, name);
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute('data-items', '4');
  await expect(card.getByTestId('card-figures')).toHaveText('8 pcs₹800/pcMRP ₹1,499');
  await expect(card).not.toContainText(company);
  await expect(card.getByRole('img')).toHaveCount(0);
  await expect(card).not.toContainText(/Show \d|Print tags/);
  await expect(page.getByRole('search')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Show' })).toHaveCount(0);
  await expect(page.getByTestId('products-summary')).toContainText(/^Designs: \d+ · Items: \d+ · In stock: \d+ pcs$/);

  // All tags: the same card; its 4 real tags fold out; Every tag shows them all at once.
  await page.goto(`/admin/labels?q=${encodeURIComponent(name)}`);
  const tagCard = page.getByTestId('tag-library').getByTestId('design-card');
  await expect(tagCard).toHaveCount(1);
  await expect(page.getByTestId('tag-summary')).toContainText('Designs: 1 · Tags: 4 · In stock: 8 pcs · Groups: 1');
  await expect(tagCard).toContainText(`${company} · MRP ₹1,499.00 · selling ₹1,399.00`); // All tags keeps the MRP
  const tags = tagCard.getByTestId('hang-tag');
  await expect(tags.first()).toBeHidden();
  await tagCard.getByText('Show 4 tags').click();
  await expect(tags).toHaveCount(4);
  await expect(tags.first()).toBeVisible();
  await page.getByRole('navigation', { name: 'Show' }).getByRole('link', { name: 'Every tag' }).click();
  await expect(page).toHaveURL(/show=tags/);
  await expect(page.getByTestId('tag-library').getByTestId('design-card')).toHaveCount(0);
  await expect(page.getByTestId('tag-library').getByTestId('hang-tag')).toHaveCount(4);
  await expect(page.getByTestId('tag-library').getByTestId('hang-tag').first()).toBeVisible();

  // Print one design: one tag per piece (8), or one per item (4).
  await page.getByRole('navigation', { name: 'Show' }).getByRole('link', { name: 'Combined' }).click();
  await tagCard.getByRole('link', { name: 'Print tags' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?.*list=1.*design=/);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  const printed = page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode 200/ });
  await expect(printed).toHaveCount(8);
  await page.getByRole('link', { name: 'One per item instead (4)' }).click();
  await expect(printed).toHaveCount(4);
});

test('owner makes a salesman a catalog person; they get catalog screens but not costs, staff or dashboard', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/admin/staff');
  const nitin = page.getByTestId('staff-list').getByRole('listitem').filter({ hasText: /^Nitin/ });
  await nitin.getByText(/^Permissions:/).click();
  const form = page.getByRole('form', { name: 'Permissions for Nitin' });
  await form.getByLabel('Catalog for Nitin').check();
  await form.getByLabel('Prices for Nitin').check();
  await form.getByLabel('Stock for Nitin').check();
  await form.getByLabel('Purchase price for Nitin').uncheck();
  await form.getByRole('button', { name: 'Save permissions' }).click();
  await expect(form.getByRole('status')).toHaveText('Saved: catalog, prices, stock.');

  await page.context().clearCookies(); // switch user: start logged out

  await page.goto('/login');
  await page.getByText('Nitin', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/pos$/);
  await page.goto('/admin/more');
  await expect(page.getByRole('link', { name: /Tag old stock/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Staff & permissions/ })).toHaveCount(0);
  await page.goto('/admin/categories');
  await expect(page.getByRole('heading', { name: 'Categories', level: 1 })).toBeVisible();
  // No purchase (code) price field without the "Purchase price" right.
  await page.goto('/admin/stock/form');
  await expect(salePrice(page)).toBeVisible();
  await expect(purchasePrice(page)).toHaveCount(0);
  // Price by size: MRP and selling price per size, but no purchase price boxes.
  await showVariants(page);
  await page.getByRole('button', { name: 'Size M', exact: true }).click();
  await page.getByRole('button', { name: 'Size L', exact: true }).click();
  await page.getByText('Price by size (optional)').click();
  await expect(page.getByLabel('Size M selling price')).toBeVisible();
  await expect(page.getByLabel('Size L MRP')).toBeVisible();
  await expect(page.getByLabel(/purchase price/i)).toHaveCount(0);
  // Products: Select (its only action, Delete, is the owner's) is not offered.
  await page.goto('/admin/products');
  const firstCard = page.getByTestId('design-list').getByTestId('product-card').first();
  await expect(firstCard).toBeVisible();
  await expect(page.getByTestId('select-products')).toHaveCount(0);
  // Cards show the pieces and the MRP — no purchase price per piece (ADR-057/070, invariant 4).
  await expect(firstCard.getByTestId('card-pieces')).toHaveText(/^\d+ pcs$/);
  await expect(firstCard.getByTestId('card-mrp')).toHaveText(/^MRP ₹[\d,.]+$/);
  await expect(page.getByTestId('card-cost')).toHaveCount(0);
  await expect(page.getByTestId('design-list')).not.toContainText('/pc');
  // With the catalog / stock right, the QR button shows the label too (ADR-070).
  await firstCard.getByTestId('card-label').click();
  await expect(page.getByTestId('label-view').getByTestId('hang-tag')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('action-sheet')).toHaveCount(0);
  for (const path of ['/admin/dashboard', '/admin/staff', '/admin/settings', '/admin/activity']) {
    await page.goto(path);
    await expect(page, `${path} is owner-only`).toHaveURL(/\/pos$/);
  }
});

test('catalog person tags old stock with a photo; label, today\'s labels, photo at the counter', async ({ page }) => {
  // Owner makes Nitin a catalog person (no purchase price).
  await loginOwner(page);
  await page.goto('/admin/staff');
  await page.getByTestId('staff-list').getByRole('listitem').filter({ hasText: /^Nitin/ }).getByText(/^Permissions:/).click();
  const perms = page.getByRole('form', { name: 'Permissions for Nitin' });
  for (const p of ['Catalog', 'Prices', 'Stock']) await perms.getByLabel(`${p} for Nitin`).check();
  await perms.getByLabel('Purchase price for Nitin').uncheck();
  await perms.getByRole('button', { name: 'Save permissions' }).click();
  await expect(perms.getByRole('status')).toContainText('Saved');

  // A real JPEG made in the browser, as a phone camera would give.
  const jpegBase64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 480;
    const g = c.getContext('2d')!;
    g.fillStyle = '#c2410c';
    g.fillRect(0, 0, 640, 480);
    g.fillStyle = '#fde68a';
    g.fillRect(100, 100, 300, 200);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  });

  await page.context().clearCookies(); // switch user: start logged out

  await page.goto('/login');
  await page.getByText('Nitin', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/pos$/);
  await page.goto('/admin/stock');
  await page.getByRole('link', { name: /Tag old stock/ }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/old$/);

  await page.getByLabel('Choose photos').setInputFiles({ name: 'shelf.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpegBase64, 'base64') });
  await expect(page.getByTestId('new-photos').getByRole('img')).toHaveCount(1);
  await page.getByRole('combobox', { name: /^Category/ }).selectOption({ label: 'Saree (SA)' });
  await page.getByLabel('Product name').fill(`Phulkari Dupatta ${run}`);
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await expect(page.getByLabel('Colour', { exact: true })).toHaveCount(0); // colour only on the product page
  await page.getByLabel('MRP (₹)').fill('899');
  await expect(page.getByLabel('Purchase price (₹)')).toHaveCount(0);
  await page.getByLabel('Pieces counted').fill('3');
  await page.getByRole('button', { name: 'Save and get barcode' }).click();

  const saved = page.getByRole('status');
  await expect(saved).toContainText(`Saved Phulkari Dupatta ${run}`);
  const barcode = (await saved.innerText()).match(/barcode (\d{13})/)?.[1];
  expect(barcode).toMatch(/^200/);
  await page.getByRole('button', { name: 'Next item →' }).click();
  await expect(page.getByRole('combobox', { name: /^Category/ })).toHaveValue(/.+/); // category kept
  await expect(page.getByLabel('Product name')).toHaveValue('');

  await page.getByRole('link', { name: "print today's labels" }).click();
  await expect(page.getByRole('heading', { name: 'My labels today' })).toBeVisible();
  await expect(page.getByTestId('label-sheet').getByRole('img', { name: `Barcode ${barcode} for MAA-SA-`, exact: false })).toHaveCount(3);
  // Hang tags on A4 by default; tag printer: one 40 × 60 mm tag each.
  const myTags = page.getByTestId('label-sheet').getByTestId('hang-tag').filter({ has: page.getByRole('img', { name: `Barcode ${barcode} for MAA-SA-`, exact: false }) });
  await expect(myTags).toHaveCount(3);
  await expect(myTags.first().getByRole('img', { name: /^QR code for MAA-SA-/ })).toBeVisible();
  await page.getByRole('link', { name: 'Tag printer 40×60 mm' }).click();
  await expect(page).toHaveURL(/format=tag/);
  await expect(myTags).toHaveCount(3);
  // Sticker-printer format: same labels, each exactly 50 × 25 mm.
  await page.getByRole('link', { name: 'Sticker printer 50×25 mm' }).click();
  await expect(page).toHaveURL(/format=sticker/);
  const stickers = page.getByTestId('label-sheet').getByRole('img', { name: `Barcode ${barcode} for MAA-SA-`, exact: false });
  await expect(stickers).toHaveCount(3);
  const box = await page.getByTestId('label-sheet').locator('li').first().locator('> div').boundingBox();
  expect(Math.round(box!.width)).toBe(189); // 50 mm
  expect(Math.round(box!.height)).toBe(94); // 25 mm

  // Seller scans it and sees the photo.
  await page.goto('/pos');
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await page.keyboard.type(barcode!, { delay: 5 });
  await page.keyboard.press('Enter');
  const photo = page.getByRole('img', { name: `Photo of Phulkari Dupatta ${run}` });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

test('guide and help are reachable logged out; lessons can be ticked; first-time tips can be dismissed', async ({ page }) => {
  await page.context().clearCookies(); // switch user: start logged out
  await page.goto('/login');
  await page.getByRole('link', { name: 'New here?' }).click();
  await expect(page).toHaveURL(/\/guide#start$/);
  await expect(page.getByRole('heading', { name: 'Guide', level: 1 })).toBeVisible();
  // "New here?" opens the first lesson straight away: one step at a time.
  const story = page.getByRole('dialog', { name: 'Log in' });
  await expect(story.getByTestId('story-text')).toHaveText('Tap your name');
  await expect(story.getByTestId('story-count')).toHaveText('1 of 4');
  await story.getByRole('button', { name: 'Close lesson' }).click();
  await expect(story).toBeHidden();
  // Lessons are grouped by part; each part shows only its own short lessons.
  const lessons = page.getByTestId('guide-lessons');
  for (const title of ['Log in', 'Language and colours', 'Read a tag']) await expect(lessons.getByRole('button', { name: new RegExp(title) })).toBeVisible();
  await page.getByRole('button', { name: 'Stock & tags', exact: true }).click();
  for (const title of ['New item', 'Tag old stock', 'Print tags', 'More pieces arrived', 'The item page']) await expect(lessons.getByRole('button', { name: new RegExp(title) })).toBeVisible();
  await expect(lessons.getByRole('button', { name: /Log in/ })).toHaveCount(0);
  // The tag lesson shows the real tag with one part ringed at a time.
  await page.getByRole('button', { name: 'Everyone', exact: true }).click();
  await lessons.getByRole('button', { name: /Read a tag/ }).click();
  const tagStory = page.getByRole('dialog', { name: 'Read a tag' });
  await expect(tagStory.getByTestId('hang-tag')).toBeVisible();
  await expect(tagStory.getByTestId('story-text')).toHaveText('QR opens the item');
  // Finishing a lesson ticks it, and that is remembered on this phone.
  await expect(page.getByTestId('guide-progress')).toContainText('0 of 22 learned');
  for (let i = 0; i < 5; i++) await tagStory.getByRole('button', { name: 'Next step' }).click();
  await expect(tagStory.getByTestId('story-text')).toHaveText('Every part has a job.');
  await tagStory.getByRole('button', { name: 'Got it ✓' }).click();
  await expect(tagStory).toBeHidden();
  await expect(page.getByTestId('guide-progress')).toContainText('1 of 22 learned');
  await page.reload();
  await expect(page.getByTestId('guide-progress')).toContainText('1 of 22 learned');
  // Quick help & fixes is still there.
  await page.getByRole('link', { name: 'Problems & fixes' }).click();
  await expect(page).toHaveURL(/\/help#faq$/);
  await expect(page.getByRole('heading', { name: 'Help & guide' })).toBeVisible();

  await page.context().clearCookies(); // switch user: start logged out

  await page.goto('/login');
  await page.getByText('Vishal', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  const tip = page.getByRole('note').filter({ hasText: 'First time here?' });
  await expect(tip).toBeVisible();
  await tip.getByRole('button', { name: 'Hide this tip' }).click();
  await expect(tip).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeVisible();
  await expect(page.getByRole('note').filter({ hasText: 'First time here?' })).toHaveCount(0);
});

test('tag old stock with the barcode already on the tag; a known barcode is refused', async ({ page }) => {
  // A valid EAN-13 unique to this run (manufacturer-style, prefix 890).
  const first12 = `890${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
  const sum = first12.split('').reduce((t, d, i) => t + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  const ean = first12 + ((10 - (sum % 10)) % 10);

  await loginOwner(page);
  await page.goto('/admin/stock/old');
  await page.getByRole('button', { name: "Scan the tag's barcode" }).click();
  await expect(page.getByLabel("Scan the barcode on the item's tag")).toBeFocused();
  await page.keyboard.type('8901111000014', { delay: 5 }); // already in the app (Classic Crew Tee)
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Already in the app: Classic Crew Tee/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save and get barcode' })).toBeDisabled();

  await page.getByLabel("Scan the barcode on the item's tag").fill(ean);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('tag-barcode')).toContainText(ean);
  await page.getByRole('combobox', { name: /^Category/ }).selectOption({ label: 'Shirt (SH)' });
  await page.getByLabel('Product name').fill(`Branded Shirt ${run}`);
  await page.getByLabel('MRP (₹)').fill('1299');
  await page.getByLabel('Pieces counted').fill('2');
  await page.getByRole('button', { name: 'Save and get barcode' }).click();
  await expect(page.getByRole('status')).toContainText(`barcode ${ean}`);
  await expect(page.getByRole('status')).toContainText('no new sticker is needed');

  // The tag's own barcode now sells at the counter.
  await page.goto('/pos');
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await page.keyboard.type(ean, { delay: 5 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('item-details')).toContainText(`Branded Shirt ${run}`);
});

test('needs attention: QC to-do list links to the item to fix', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/admin/more');
  await page.getByRole('link', { name: /Needs attention/ }).click();
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  for (const id of ['photo', 'company', 'stock', 'cost']) await expect(page.getByTestId(`count-${id}`)).toBeVisible();
  const outOfStock = page.locator('#stock');
  // Short lists start open; open it only if it is closed.
  if (!(await outOfStock.evaluate((d: HTMLDetailsElement) => d.open))) await outOfStock.locator('summary').click();
  await outOfStock.getByRole('link', { name: 'Open →' }).first().click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);
});

test('installable app: manifest + icons; opening the app while logged in goes to your screen', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Maa Collection', display: 'standalone', start_url: '/login' });
  for (const icon of manifest.icons) {
    const res = await request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
  }
  await loginOwner(page);
  await page.goto('/login'); // e.g. tapping the home-screen icon
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
});

test('owner reports and CSV exports; salesmen cannot download them', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/admin/reports?period=30d');
  await expect(page.getByRole('link', { name: 'Last 30 days' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('report-net')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Not selling (no sale in 30 days)' })).toBeVisible();

  const sales = await page.request.get('/admin/export/sales?period=30d');
  expect(sales.status()).toBe(200);
  expect(sales.headers()['content-type']).toContain('text/csv');
  expect((await sales.text()).split('\r\n')[0]).toContain('Type,Status,By hand,Date & time (IST),SKU,Product');
  const stock = await page.request.get('/admin/export/stock');
  expect(await stock.text()).toContain('MAA-TS-001');

  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByText('Pradeep', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/pos$/);
  expect((await page.request.get('/admin/export/stock')).status()).toBe(403);
  await page.goto('/admin/reports');
  await expect(page).toHaveURL(/\/pos$/);
});

test('after tagging an old item, Edit fixes it in place: same barcode, no new item, pieces unchanged; For / Age tags too', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/admin/stock/old');
  await page.getByRole('combobox', { name: /^Category/ }).selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Product name').fill(`Chikan Kurta ${run}`);
  const forTags = page.getByRole('group', { name: 'For' });
  const ageTags = page.getByRole('group', { name: 'Age' });
  await forTags.getByRole('button', { name: 'Girls' }).click();
  await ageTags.getByRole('button', { name: 'Adult' }).click();
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByLabel('MRP (₹)').fill('999');
  await page.getByLabel('Pieces counted').fill('2');
  await page.getByRole('button', { name: 'Save and get barcode' }).click();
  const status = page.getByRole('status');
  await expect(status).toContainText(`Saved Chikan Kurta ${run}`);
  const barcode = (await status.innerText()).match(/barcode (\d{13})/)?.[1];
  expect(barcode).toMatch(/^200/);

  // Edit: the same form comes back filled in, without photos, tag scan or piece count.
  await page.getByRole('button', { name: 'Edit this item' }).click();
  await expect(page.getByText(`Editing Chikan Kurta ${run} · barcode ${barcode}`)).toBeVisible();
  await expect(page.getByLabel('Product name')).toHaveValue(`Chikan Kurta ${run}`);
  await expect(page.getByLabel('Pieces counted')).toHaveCount(0);
  await expect(page.getByLabel('Choose photos')).toHaveCount(0);
  await expect(forTags.getByRole('button', { name: 'Girls' })).toHaveAttribute('aria-pressed', 'true');
  await ageTags.getByRole('button', { name: 'Child' }).click(); // Adult → Child
  await page.getByLabel('Product name').fill(`Chikan Kurta Long ${run}`);
  await page.getByRole('button', { name: 'L', exact: true }).click();
  await page.getByLabel('MRP (₹)').fill('1099');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByRole('status')).toContainText('Changes saved.');
  const tag = page.getByTestId('hang-tag');
  await expect(tag).toContainText(`Chikan Kurta Long ${run}`);
  await expect(tag.getByRole('img', { name: new RegExp(`^Barcode ${barcode}`) })).toBeVisible();

  // Still one item with that barcode, now size L, MRP 1,099, 2 pieces.
  await page.getByRole('link', { name: /Open item/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`Chikan Kurta Long ${run}`);
  await expect(page.getByTestId('item-chips')).toContainText('Girls');
  await expect(page.getByTestId('item-chips')).toContainText('Child');
  await expect(page.getByTestId('item-chips')).not.toContainText('Adult');
  await expect(page.getByTestId('size-row')).toHaveText([/^L/]);
  await expect(page.getByTestId('item-prices')).toContainText('MRP ₹1,099.00');
  // The tag Print tag prints (drawn only for printing) still carries the same barcode.
  await expect(page.getByTestId('item-print-tag').getByRole('img', { name: new RegExp(`^Barcode ${barcode}`), includeHidden: true })).toHaveCount(1);
  await page.goto('/admin/products'); // still exactly one item with that name
  await expect(productCard(page, `Chikan Kurta Long ${run}`)).toHaveCount(1);
  await expect(productCard(page, `Chikan Kurta Long ${run}`)).toHaveAttribute('data-items', '1');
});

test('clear stock: owner only, two steps, and a wrong PIN changes nothing', async ({ page }) => {
  // (The real clearing is covered by the service test: doing it here would empty the shop under the other tests.)
  await loginOwner(page);
  await page.goto('/admin/more');
  await page.getByRole('link', { name: /Clear stock/ }).click();
  await expect(page).toHaveURL(/\/admin\/settings#clear-stock$/);
  const now = page.getByTestId('stock-now');
  await expect(now).toContainText(/In stock now: \d+ items, \d+ pieces\./);

  await page.getByRole('button', { name: 'Clear all stock…' }).click();
  await expect(page.getByText(/This cannot be undone\. All \d+ pieces will be set to 0\./)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByLabel('Your PIN')).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear all stock…' }).click();
  await page.getByLabel('Your PIN').fill('9999');
  await page.getByRole('button', { name: 'Set all pieces to 0' }).click();
  await expect(page.getByText('Wrong PIN. Nothing was changed.')).toBeVisible();
  await page.reload();
  // Still in stock (other tests add items meanwhile, so the exact number may have grown).
  await expect(page.getByTestId('stock-now')).toContainText(/In stock now: [1-9]\d* items, [1-9]\d* pieces\./);

  // A salesman can't reach it.
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByText('Vishal', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/pos$/);
  await page.goto('/admin/settings');
  await expect(page.getByTestId('stock-now')).toHaveCount(0);
});
