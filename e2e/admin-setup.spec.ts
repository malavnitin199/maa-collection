import { test, expect, type Page } from '@playwright/test';

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
 * New item and the product page (plan v17): top tabs Details (open first) · Colours · Other details.
 * New item's must-haves: company, sale price (MRP) and purchase price.
 */
const tab = (page: Page, name: 'Details' | 'Colours' | 'Other details') => page.getByRole('tab', { name, exact: true }).click();
const showVariants = (page: Page) => tab(page, 'Colours');
const companyBox = (page: Page) => page.getByRole('combobox', { name: /^Company/ });
const salePrice = (page: Page) => page.getByLabel('Sale price (MRP) ₹');
const purchasePrice = (page: Page) => page.getByLabel('Purchase price ₹', { exact: true });

test('owner adds a supplier and a category; both show up with details', async ({ page }) => {
  await loginOwner(page);

  await page.goto('/admin/suppliers');
  await page.getByText('+ Add supplier').click();
  await page.getByLabel('Company name').fill(`XYZ Textiles ${run}`);
  await page.getByLabel('Contact person (optional)').fill('Ramesh');
  await page.getByLabel('Phone (optional)').fill('98765 43210');
  await page.getByRole('button', { name: 'Add supplier' }).click();
  await expect(page.getByRole('status')).toContainText(`XYZ Textiles ${run} added.`);
  const supplierCard = page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(`XYZ Textiles ${run}`) });
  await expect(supplierCard).toContainText('Ramesh · 98765 43210');
  await supplierCard.click();
  await expect(page.getByRole('heading', { level: 1, name: `XYZ Textiles ${run}` })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Call 98765 43210' })).toHaveAttribute('href', 'tel:9876543210');

  // Duplicate supplier is refused.
  await page.goto('/admin/suppliers');
  await page.getByText('+ Add supplier').click();
  await page.getByLabel('Company name').fill(`XYZ Textiles ${run}`);
  await page.getByRole('button', { name: 'Add supplier' }).click();
  await expect(page.getByText('A supplier with that name already exists.')).toBeVisible();

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
  await expect(page).toHaveURL(/\/admin\/suppliers$/);
  await tabs.getByRole('link', { name: 'More' }).click();
  await page.getByRole('link', { name: /Categories/ }).click();
  await expect(page).toHaveURL(/\/admin\/categories$/);
  await tabs.getByRole('link', { name: 'Products' }).click();
  await expect(page.getByTestId('design-list')).toContainText('Classic Crew Tee'); // combined view by default (plan v14)
  await expect(tabs.getByRole('link', { name: 'Products' })).toHaveAttribute('aria-current', 'page');
});

test('owner enters a new design from a supplier in sizes × colours, prints labels; salesman can scan it', async ({ page }) => {
  await loginOwner(page);
  // Supplier for this run.
  await page.goto('/admin/suppliers');
  await page.getByText('+ Add supplier').click();
  await page.getByLabel('Company name').fill(`Design Co ${run}`);
  await page.getByRole('button', { name: 'Add supplier' }).click();
  await expect(page.getByRole('status')).toContainText('added');
  await page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(`Design Co ${run}`) }).click();
  await page.getByRole('link', { name: `+ New item from Design Co ${run}` }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/new\?supplier=/);

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
  await page.getByLabel('Colour', { exact: true }).fill('Blue, Pink');
  await page.getByRole('button', { name: 'Add colour' }).click();
  await expect(page.getByTestId('item-size-pills')).toHaveText('ML');
  await expect(page.getByTestId('combo-grid').getByRole('row')).toHaveCount(3); // sizes + Blue + Pink
  await tab(page, 'Details');
  await page.getByLabel('Pieces each').fill('2');
  await page.getByLabel('Counter price, if lower (₹)').fill('1399');
  await page.getByLabel('Supplier bill no. (optional)').fill('INV-42');
  await expect(page.getByTestId('design-preview')).toHaveText('4 items · 8 pcs · purchase ₹6,400.00');
  await page.getByRole('button', { name: 'Save 4 items' }).click();

  // Labels: one per piece by default (8), or one per item (4).
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  await expect(page.getByText('Saved 4 new items with barcodes.')).toBeVisible();
  await expect(page.getByTestId('receipt-lines')).toContainText(`Chikan Kurta ${run} · Pink · L`);
  await expect(page.getByRole('link', { name: '+ Add next item' })).toHaveAttribute('href', /^\/admin\/stock\/new\?supplier=[0-9a-f-]{36}&category=[0-9a-f-]{36}$/);
  const labels = page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode 200/ });
  await expect(labels).toHaveCount(8);
  await page.getByRole('link', { name: 'One per item instead (4)' }).click();
  await expect(labels).toHaveCount(4);
  const barcode = (await labels.first().getAttribute('aria-label'))?.match(/Barcode (\d{13})/)?.[1];
  expect(barcode).toMatch(/^200\d{10}$/);

  // Product page: header tags; Colours shows every colour × size with its pieces.
  await page.getByTestId('receipt-lines').getByRole('link').first().click();
  await expect(page.getByTestId('item-pills')).toContainText('Girls');
  await expect(page.getByTestId('item-pills')).toContainText('Adult');
  await tab(page, 'Colours');
  await expect(page.getByTestId('design-variants').getByRole('link')).toHaveCount(4);
  await expect(page.getByTestId('design-variants').getByRole('link', { name: `Pink L: 2 in stock` })).toBeVisible();
  // Other details: change "for whom" for the whole design.
  await tab(page, 'Other details');
  await page.getByRole('group', { name: 'For' }).getByRole('button', { name: 'Both' }).click();
  await page.getByRole('button', { name: 'Save tags' }).click();
  await expect(page.getByText('Tags saved for 4 items.')).toBeVisible();
  // Rates for the whole design (Details).
  await tab(page, 'Details');
  const rates = page.locator('section', { has: page.getByRole('heading', { name: 'Rates for the whole design' }) });
  await rates.getByLabel('MRP (₹)').fill('1599');
  await rates.getByLabel('Price (₹)').fill('1499');
  await rates.getByRole('button', { name: 'Apply to all 4 sizes/colours' }).click();
  await expect(page.getByText('Rates updated for 4 items.')).toBeVisible();
  await page.goto(`/admin/products?q=${encodeURIComponent(`Chikan Kurta ${run}`)}&show=items`);
  await expect(page.getByTestId('product-list').getByRole('listitem').filter({ hasText: '₹1,499.00' })).toHaveCount(4);

  // Same entry again is refused (sizes/colours already exist).
  await page.goto('/admin/stock/new');
  await companyBox(page).selectOption({ label: `Design Co ${run}` });
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Product name').fill(`Chikan Kurta ${run}`);
  await salePrice(page).fill('1499');
  await purchasePrice(page).fill('800');
  await showVariants(page);
  await page.getByRole('button', { name: 'Size M' }).click();
  await page.getByLabel('Colour', { exact: true }).fill('Blue');
  await page.getByRole('button', { name: /^Save 1 item/ }).click();
  await expect(page.getByText(/Already in the catalogue: Blue M/)).toBeVisible();

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

test('owner gives sizes their own MRP, selling and purchase price; every colour of a size gets them', async ({ page }) => {
  await loginOwner(page);
  const name = `Linen Shirt ${run}`;
  await page.goto('/admin/stock/new');
  await companyBox(page).selectOption({ label: 'Royal Garments' });
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Product name').fill(name);
  await salePrice(page).fill('700');
  await purchasePrice(page).fill('300');
  await page.getByLabel('Counter price, if lower (₹)').fill('500');
  await showVariants(page);
  for (const size of ['XL', 'M', 'L']) await page.getByRole('button', { name: `Size ${size}`, exact: true }).click();
  await page.getByLabel('Colour', { exact: true }).fill('Black, White');
  await page.getByRole('button', { name: 'Add colour' }).click();

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
  // (300 + 330 + 360) × 2 colours × 1 piece
  await expect(page.getByTestId('design-preview')).toContainText('purchase ₹1,980.00');

  // Above MRP for one size is flagged in the preview and refused by the server.
  await editor.getByLabel('Size XL selling price').fill('800');
  await expect(page.getByText('Selling price is above MRP for size XL.')).toBeVisible();
  await page.getByRole('button', { name: 'Save 6 items' }).click();
  await expect(page.getByText('Size XL: Selling price cannot be above MRP.')).toBeVisible();
  await editor.getByLabel('Size XL selling price').fill('600');
  await page.getByRole('button', { name: 'Save 6 items' }).click();

  // Labels print each size's own MRP, on both colours.
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  await expect(page.getByText('Saved 6 new items with barcodes.')).toBeVisible();
  const labels = page.getByTestId('label-sheet').getByRole('listitem');
  await expect(labels.filter({ hasText: 'MRP ₹750.00' })).toHaveCount(2);
  await expect(labels.filter({ hasText: 'MRP ₹700.00' })).toHaveCount(4);

  const list = page.getByTestId('product-list').getByRole('listitem');
  await page.goto(`/admin/products?q=${encodeURIComponent(name)}&show=items`);
  await expect(list).toHaveCount(6);
  await expect(list.filter({ hasText: '₹500.00 · MRP ₹700.00 · purchase ₹300.00' })).toHaveCount(2);
  await expect(list.filter({ hasText: '₹550.00 · MRP ₹700.00 · purchase ₹330.00' })).toHaveCount(2);
  await expect(list.filter({ hasText: '₹600.00 · MRP ₹750.00 · purchase ₹360.00' })).toHaveCount(2);

  // Product page: rates by size, filled with today's prices; change only L.
  await page.getByTestId('product-list').getByRole('link').first().click();
  const rates = page.locator('section', { has: page.getByRole('heading', { name: 'Rates for the whole design' }) });
  await expect(rates.getByLabel('MRP (₹)')).toHaveValue('700');
  await expect(rates.getByTestId('size-rates')).toHaveAttribute('open', '');
  await expect(rates.getByLabel('Size XL MRP')).toHaveValue('750');
  await expect(rates.getByLabel('Size M selling price')).toHaveValue('');
  await rates.getByLabel('Size L selling price').fill('520');
  await rates.getByRole('button', { name: 'Apply to all 6 sizes/colours' }).click();
  await expect(page.getByText('Rates updated for 6 items.')).toBeVisible();
  await page.goto(`/admin/products?q=${encodeURIComponent(name)}&show=items`);
  await expect(list.filter({ hasText: '₹520.00 · MRP ₹700.00 · purchase ₹330.00' })).toHaveCount(2);
  await expect(list.filter({ hasText: '₹500.00 · MRP ₹700.00' })).toHaveCount(2);
  await expect(list.filter({ hasText: '₹600.00 · MRP ₹750.00' })).toHaveCount(2);
});

test('hang tags: QR code, size boxed, the design\'s sizes with this one highlighted; the QR link opens the item', async ({ page }) => {
  await loginOwner(page);
  // Anarkali Kurta M Blue (MAA-KU-001); the design also has L.
  await page.goto('/admin/products?q=MAA-KU-001&show=items');
  await page.getByTestId('product-list').getByRole('link').first().click();
  const tag = page.getByTestId('hang-tag');
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
  const productUrl = page.url();

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
  await page.goto('/admin/stock/new');
  await showVariants(page);
  await expect(page.getByText('Choose the category above to see its sizes first.')).toBeVisible();
  const option = page.getByLabel('Category').locator('option', { hasText: `Gents Trousers ${run}` });
  await page.getByLabel('Category').selectOption((await option.getAttribute('value'))!);
  const chips = page.getByTestId('category-size-chips');
  await expect(chips.getByRole('button', { name: /^Size / })).toHaveText(['28', '30', '32', '34', '36']);
  await chips.getByRole('button', { name: 'Pick all' }).click();
  await expect(chips.getByRole('button', { name: /^Size /, pressed: true })).toHaveCount(5);
});

test('categories by section (plan v19): tiles; the owner\'s own section with a Hindi name and picture, renamed, reordered, hidden and brought back; a category with a Hindi name under it', async ({ page, isMobile }) => {
  await loginOwner(page);
  await page.goto('/admin/categories');
  const tiles = page.getByTestId('section-tiles');
  const list = page.getByTestId('category-list');
  const head = page.getByTestId('section-head');
  // Tile texts are "Name<count>"; the run id ends in digits too, so match by prefix.
  const order = async () => tiles.getByRole('link').allTextContents();
  const indexOf = async (name: string) => (await order()).findIndex((text) => text.startsWith(name));
  await expect(tiles.getByRole('link').nth(3)).toContainText('Girls');
  expect((await order()).slice(0, 4).map((text) => text.replace(/\d+$/, ''))).toEqual(['Men', 'Women', 'Boys', 'Girls']);
  // Men opens first: its categories only; the first section cannot move up.
  await expect(list).toContainText('Kurta');
  await expect(list).not.toContainText('Saree');
  await expect(head.getByRole('button', { name: 'Move Men up' })).toBeDisabled();
  await tiles.getByRole('link', { name: /^Women/ }).click();
  await expect(page).toHaveURL(/\/admin\/categories\?s=[0-9a-f-]{36}$/);
  await expect(list).toContainText('Saree');
  await expect(head).toContainText('Women');
  await expect(head).toContainText('महिला');

  // The owner's own section (e.g. Kids) goes last, with its picture.
  await page.getByText('+ Add section').click();
  const addSection = page.locator('details', { hasText: '+ Add section' });
  await addSection.getByLabel('Section name').fill(`Kids ${run}`);
  await addSection.locator('label').filter({ hasText: 'Baby' }).click();
  await addSection.getByRole('button', { name: 'Add section' }).click();
  await expect(addSection.getByRole('status')).toContainText(`Kids ${run} added.`);
  await expect(tiles.getByRole('link').filter({ hasNotText: 'Needs sorting' }).last()).toContainText(`Kids ${run}`); // Needs sorting stays last
  await tiles.getByRole('link', { name: `Kids ${run}` }).click();
  await expect(head).toContainText(`Kids ${run}`);
  await expect(head).toContainText('0 categories');
  await expect(page.getByText('No categories here yet.')).toBeVisible();

  // Rename, Hindi name and picture.
  await head.getByText('Edit section').click();
  await head.getByLabel('Section name').fill(`Junior ${run}`);
  await head.getByLabel('Hindi name').fill('जूनियर');
  await head.locator('label').filter({ hasText: 'Family' }).click();
  await head.getByRole('button', { name: 'Save section' }).click();
  await expect(head.getByRole('status')).toContainText('Saved');
  await expect(tiles.getByRole('link', { name: `Junior ${run}` })).toBeVisible();
  await expect(head).toContainText('जूनियर');

  // Shop order: ▲ / ▼ swap with the neighbour (desktop run only: the phone run adds sections at the same time).
  if (!isMobile) {
    const was = await indexOf(`Junior ${run}`);
    await head.getByRole('button', { name: `Move Junior ${run} up` }).click();
    await expect.poll(() => indexOf(`Junior ${run}`)).toBe(was - 1);
    await head.getByRole('button', { name: `Move Junior ${run} down` }).click();
    await expect.poll(() => indexOf(`Junior ${run}`)).toBe(was);
  }

  // Hide it and bring it back (nothing deleted).
  await head.getByLabel('Shown in New item').uncheck();
  await head.getByRole('button', { name: 'Save section' }).click();
  await expect(tiles.getByRole('link', { name: `Junior ${run}` })).toContainText('(Hidden)');
  await expect(head).toContainText('Hidden');
  await head.getByLabel('Shown in New item').check();
  await head.getByRole('button', { name: 'Save section' }).click();
  await expect(tiles.getByRole('link', { name: `Junior ${run}` })).not.toContainText('Hidden');

  // A category with a Hindi name lands under it.
  await page.getByText('+ Add category').click();
  const addCategory = page.locator('details', { hasText: '+ Add category' });
  await addCategory.getByLabel('Category name').fill(`Frock ${run}`);
  await addCategory.getByLabel('Hindi name (optional)').fill('फ़्रॉक');
  await addCategory.getByRole('button', { name: 'Add category' }).click();
  await expect(addCategory.getByRole('status')).toContainText(`Frock ${run} added with code`);
  await expect(list.getByRole('listitem').filter({ hasText: `Frock ${run}` })).toContainText('फ़्रॉक');
  await expect(head).toContainText('1 category');

  // The same section name again is refused (the add form is still open from before).
  if (!(await addSection.getByLabel('Section name').isVisible())) await page.getByText('+ Add section').click();
  await addSection.getByLabel('Section name').fill(`Junior ${run}`);
  await addSection.getByRole('button', { name: 'Add section' }).click();
  await expect(addSection.getByRole('alert')).toContainText('That name is already in the list.');
});

// The next two share the seed's one old-style category ("Dress Material", under no section):
// desktop only, in this order, so the phone run cannot sort it first.
test('plan v19: New item refuses a category that is not sorted under a section yet', async ({ page, isMobile }) => {
  test.skip(isMobile, 'one shared seed row; the desktop run covers it');
  await loginOwner(page);
  await page.goto('/admin/stock/new');
  await companyBox(page).selectOption({ label: 'Shree Ganesh Textiles' });
  await page.getByLabel('Category').selectOption({ label: 'Dress Material (DM)' });
  await page.getByLabel('Product name').fill(`Cotton Suit Piece ${run}`);
  await salePrice(page).fill('900');
  await purchasePrice(page).fill('500');
  await page.getByLabel('Pieces', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Save 1 item' }).click();
  await expect(page.getByText('Sort this category under Men, Women, Boys or Girls first (Categories).')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/stock\/new$/);
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

test('photos while creating tags: one per colour (every size gets it), or the main photo at the top of a new item', async ({ page }) => {
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

  // Sizes × colours: Blue gets its own photo, Red none (and there is no main photo).
  await page.goto('/admin/stock/new');
  await companyBox(page).selectOption({ label: 'Royal Garments' });
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Product name').fill(`Photo Kurta ${run}`);
  await salePrice(page).fill('999');
  await purchasePrice(page).fill('500');
  await showVariants(page);
  await page.getByRole('button', { name: 'Size M', exact: true }).click();
  await page.getByRole('button', { name: 'Size L', exact: true }).click();
  await page.getByLabel('Colour', { exact: true }).fill('Blue, Red');
  await page.getByRole('button', { name: 'Add colour' }).click();
  const photos = page.getByTestId('colour-photos');
  await photos.getByLabel('Gallery for Blue').setInputFiles(file);
  await expect(photos.getByRole('img', { name: 'Photo for Blue' })).toBeVisible();
  await expect(photos.getByRole('button', { name: 'Remove photo for Blue' })).toBeVisible();
  await expect(photos.getByRole('button', { name: 'Choose photo for Red from gallery' })).toBeVisible();
  await page.getByRole('button', { name: 'Save 4 items' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  await expect(page.getByText('Saved 4 new items with barcodes.')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'photo could not be saved' })).toHaveCount(0);

  // Blue L (not the first Blue item) shows the photo; Red M has none.
  const lines = page.getByTestId('receipt-lines');
  await lines.getByRole('link', { name: `Photo Kurta ${run} · Blue · L` }).click();
  await tab(page, 'Colours'); // photos sit with the colours on the product page
  const photo = page.getByRole('img', { name: 'Product photo 1' });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.goBack();
  await page.getByTestId('receipt-lines').getByRole('link', { name: `Photo Kurta ${run} · Red · M` }).click();
  await tab(page, 'Colours');
  await expect(page.getByText('No photos yet.', { exact: false })).toBeVisible();
  await expect(page.getByRole('img', { name: 'No photo' })).toBeVisible(); // the header's empty photo square

  // One plain item: the main photo fills the box at the top. The old quick-add address lands here.
  await page.goto('/admin/stock/quick');
  await expect(page).toHaveURL(/\/admin\/stock\/new$/);
  const box = page.getByTestId('item-photo');
  await companyBox(page).selectOption({ label: 'Shree Ganesh Textiles' });
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
  await expect(page.getByRole('img', { name: `Photo Saree ${run}` })).toBeVisible(); // header photo
  await tab(page, 'Colours');
  await expect(page.getByRole('img', { name: 'Product photo 1' })).toBeVisible();
});

test('company box: add a company on the spot, the same name is reused, a hidden company comes back from "Previous companies"', async ({ page }) => {
  await loginOwner(page);
  const fresh = `Fresh Co ${run}`;
  // New item: "+ New company…" adds it and chooses it.
  await page.goto('/admin/stock/new');
  await companyBox(page).selectOption({ label: '+ New company…' });
  await page.getByLabel('New company name').fill(fresh);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(companyBox(page).locator('option:checked')).toHaveText(fresh);
  // The same name again (other letters case) is reused, never doubled.
  await companyBox(page).selectOption({ label: '+ New company…' });
  await page.getByLabel('New company name').fill(fresh.toLowerCase());
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(companyBox(page).locator('option:checked')).toHaveText(fresh);
  await expect(companyBox(page).locator('option', { hasText: fresh })).toHaveCount(1);

  // Hide it: Suppliers → the company → untick Active.
  await page.goto('/admin/suppliers');
  await page.getByTestId('supplier-list').getByRole('link', { name: new RegExp(fresh) }).click();
  await page.getByText('Edit supplier details').click();
  await page.getByLabel(/^Active/).uncheck();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toBeVisible();

  // Tag old stock: it is under "Previous companies"; choosing it brings it back.
  await page.goto('/admin/stock/old');
  const box = page.getByRole('combobox', { name: /^Company/ });
  const previous = box.locator('optgroup[label="Previous companies"] option', { hasText: fresh });
  await expect(previous).toHaveCount(1);
  await box.selectOption({ label: fresh });
  await expect(box.locator('option:checked')).toHaveText(fresh);
  await expect(previous).toHaveCount(0);
  // A normal company again everywhere.
  await page.goto('/admin/products/new');
  const single = page.getByRole('combobox', { name: /^Supplier/ });
  await expect(single.locator('option', { hasText: fresh })).toHaveCount(1);
  await expect(single.locator('optgroup option', { hasText: fresh })).toHaveCount(0);
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

test('Products → Select: rename, For / Age, prices, print, hide and bring back several items at once', async ({ page }) => {
  await loginOwner(page);
  const name = `Bulk Tee ${run}`;
  await page.goto('/admin/stock/new');
  await companyBox(page).selectOption({ label: 'Royal Garments' });
  await page.getByLabel('Category').selectOption({ label: 'T-Shirt (TS)' });
  await page.getByLabel('Product name').fill(name);
  await salePrice(page).fill('600');
  await purchasePrice(page).fill('300');
  await showVariants(page);
  for (const size of ['M', 'L', 'XL']) await page.getByRole('button', { name: `Size ${size}`, exact: true }).click();
  await page.getByLabel('Colour', { exact: true }).fill('Black');
  await page.getByRole('button', { name: 'Save 3 items' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);

  await page.goto(`/admin/products?q=${encodeURIComponent(name)}&show=items`);
  const rows = page.getByTestId('product-list').getByRole('listitem');
  await expect(rows).toHaveCount(3);
  // A long-press on a card starts selecting with that card ticked (and does not open it).
  const first = await rows.first().boundingBox();
  await page.mouse.move(first!.x + first!.width / 2, first!.y + first!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(page.getByTestId('selected-count')).toHaveText('1 selected');
  await expect(page).toHaveURL(/show=items/);
  const bar = page.getByTestId('selection-bar');
  const sheet = page.getByTestId('action-sheet');
  const toast = page.getByTestId('selection-toast');
  const selectAll = page.getByRole('checkbox', { name: 'Select all', exact: true });
  await selectAll.click();
  await expect(page.getByTestId('selected-count')).toHaveText('3 selected');
  await expect(selectAll).toHaveAttribute('aria-checked', 'true');

  // Rename all three.
  await bar.getByRole('button', { name: 'Rename' }).click();
  await expect(sheet).toHaveAccessibleName('Rename · 3 selected');
  await sheet.getByLabel('New name for all').fill(`${name} Pro`);
  await sheet.getByRole('button', { name: 'Apply' }).click();
  await expect(toast).toContainText('Done for 3 items.');
  await expect(sheet).toBeHidden();
  await expect(rows.filter({ hasText: `${name} Pro` })).toHaveCount(3);

  // For / Age and a new MRP for two of them (tick boxes).
  await page.getByRole('checkbox', { name: `Select ${name} Pro Black M` }).check();
  await page.getByRole('checkbox', { name: `Select ${name} Pro Black L` }).check();
  await expect(page.getByTestId('selected-count')).toHaveText('2 selected');
  await bar.getByRole('button', { name: 'For / Age' }).click();
  await sheet.getByRole('group', { name: 'For' }).getByRole('button', { name: 'Boys' }).click();
  await sheet.getByRole('button', { name: 'Apply' }).click();
  await expect(toast).toContainText('Done for 2 items.');
  await page.getByRole('checkbox', { name: `Select ${name} Pro Black XL` }).check();
  await bar.getByRole('button', { name: 'Prices' }).click();
  await sheet.getByLabel('New MRP ₹').fill('200');
  await sheet.getByRole('button', { name: 'Apply' }).click();
  await expect(sheet.getByRole('alert')).toContainText('Selling price would be above MRP');
  await sheet.getByLabel('New MRP ₹').fill('650');
  await sheet.getByRole('button', { name: 'Apply' }).click();
  await expect(toast).toContainText('Done for 1 item.');
  await expect(rows.filter({ hasText: 'MRP ₹650.00' })).toHaveCount(1);

  // Print just two tags.
  await page.getByRole('checkbox', { name: `Select ${name} Pro Black M` }).check();
  await page.getByRole('checkbox', { name: `Select ${name} Pro Black L` }).check();
  await bar.getByRole('button', { name: 'Print tags' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?items=/);
  await expect(page.getByRole('heading', { name: 'Selected tags' })).toBeVisible();
  await page.getByRole('link', { name: 'One per item instead (2)' }).click();
  await expect(page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode 200/ })).toHaveCount(2);

  // Hide all three: gone from Products; Hidden items brings them back.
  await page.goto(`/admin/products?q=${encodeURIComponent(name)}&show=items`);
  await page.getByTestId('select-products').click();
  await selectAll.click();
  await bar.getByRole('button', { name: 'Hide' }).click();
  await sheet.getByRole('button', { name: 'Yes, hide 3' }).click();
  await expect(toast).toContainText('Done for 3 items.');
  await expect(rows).toHaveCount(0);
  await page.goto(`/admin/products?q=${encodeURIComponent(name)}&show=hidden`);
  await expect(rows).toHaveCount(3);
  await page.getByTestId('select-products').click();
  await selectAll.click();
  await bar.getByRole('button', { name: 'Bring back' }).click();
  await expect(rows).toHaveCount(0);
  // ✕ leaves selection mode; the Select button is back.
  await page.getByRole('button', { name: 'Done selecting' }).click();
  await expect(page.getByTestId('selection-top')).toBeHidden();
  await page.goto(`/admin/products?q=${encodeURIComponent(name)}&show=items`);
  await expect(rows).toHaveCount(3);
  await expect(rows.filter({ hasText: 'MRP ₹650.00' })).toHaveCount(1);
});

test('selecting on a long list: the top bar (Select all) and the action bar stay on screen while scrolling', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/admin/products'); // every design: a long page
  await page.getByTestId('select-products').click();
  const viewport = page.viewportSize()!;
  for (const to of ['bottom', 'middle'] as const) {
    await page.evaluate((where) => window.scrollTo(0, where === 'bottom' ? document.documentElement.scrollHeight : document.documentElement.scrollHeight / 2), to);
    // (polls: the bars slide in for a moment)
    await expect.poll(async () => Math.round((await page.getByTestId('selection-top').boundingBox())!.y)).toBe(0);
    // On a phone it sits on the bottom edge; on wider screens it floats 16 px above it.
    const gap = viewport.width < 640 ? 0 : 16;
    await expect.poll(async () => {
      const bottom = (await page.getByTestId('selection-bar').boundingBox())!;
      return Math.round(bottom.y + bottom.height);
    }).toBe(viewport.height - gap);
  }
  await expect(page.getByRole('checkbox', { name: 'Select all', exact: true })).toBeInViewport();
  // The phone's menu dock steps aside while selecting.
  if (viewport.width < 640) await expect(page.getByRole('navigation', { name: 'Main' })).not.toBeInViewport();
});

test('Companies and All tags → Select: hide companies at once; print chosen tags', async ({ page }) => {
  await loginOwner(page);
  const a = `Sel Co A ${run}`;
  const b = `Sel Co B ${run}`;
  for (const company of [a, b]) {
    await page.goto('/admin/suppliers');
    await page.getByText('+ Add supplier').click();
    await page.getByLabel('Company name').fill(company);
    await page.getByRole('button', { name: 'Add supplier' }).click();
    await expect(page.getByRole('status')).toContainText(`${company} added.`);
  }
  await page.goto('/admin/suppliers');
  await page.getByTestId('select-companies').click();
  await page.getByRole('checkbox', { name: `Select ${a}` }).check();
  await page.getByRole('checkbox', { name: `Select ${b}` }).check();
  await page.getByTestId('selection-bar').getByRole('button', { name: 'Hide' }).click();
  await expect(page.getByTestId('selection-toast')).toContainText('Done for 2 items.');
  await expect(page.getByTestId('supplier-list').getByRole('listitem').filter({ hasText: a })).toContainText('(inactive)');
  await page.goto('/admin/stock/new');
  await expect(companyBox(page).locator('optgroup[label="Previous companies"] option', { hasText: a })).toHaveCount(1);

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
    await expect(page.getByLabel('Pieces of Oxford Shirt Sky Blue 40')).toHaveValue(String(i + 1));
  }
  const shirtLine = page.getByTestId('restock-lines').getByRole('listitem').filter({ hasText: 'Oxford Shirt' });
  const [, before] = (await shirtLine.innerText()).match(/now (\d+) →/) ?? [];

  // Name search with several matches → pick one, then bump with +.
  await scanBox.fill('Crew Tee');
  await page.keyboard.press('Enter');
  await page.getByTestId('restock-choices').getByRole('button', { name: /White · L/ }).click();
  await page.getByRole('button', { name: 'One more Classic Crew Tee L' }).click();
  await expect(page.getByLabel('Pieces of Classic Crew Tee White L')).toHaveValue('2');

  await page.getByLabel('Supplier bill no. (optional)').fill('RS-1');
  await page.getByRole('button', { name: 'Receive 5 pieces and print labels' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  await expect(page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode/ })).toHaveCount(5);
  await expect(page.getByText(/bill RS-1/)).toBeVisible();
  // Back on Receive stock, the received lines are gone: scanning one more piece must not receive them again.
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/stock\/receive$/);
  await expect(page.getByTestId('restock-lines').getByRole('listitem')).toHaveCount(0);
  await expect(page.getByLabel('Supplier bill no. (optional)')).toHaveValue('');

  // Stock went up by exactly 3.
  await page.goto('/admin/products?q=MAA-SH-001&show=items');
  await expect(page.getByTestId('product-list')).toContainText(String(Number(before) + 3));
});

test('a salesman cannot add companies, categories, products, stock or change rates', async ({ page }) => {
  await page.context().clearCookies(); // switch user: start logged out
  await page.goto('/login');
  await page.getByText('Pradeep', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/pos$/);
  for (const path of ['/admin/suppliers', '/admin/categories', '/admin/stock/new', '/admin/stock/receive', '/admin/products', '/admin/products/new', '/admin/more', '/admin/labels']) {
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
  await page.goto('/admin/products?q=MAA-TS-001&show=items');
  await page.getByTestId('product-list').getByRole('link').first().click();
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
  await expect(page).toHaveURL(/\/admin\/stock\/new$/);
  await companyBox(page).selectOption({ label: 'Shree Ganesh Textiles' });
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
  await expect(page.getByTestId('receipt-lines')).toContainText(`Georgette Saree ${run} · Assorted · Free`);
  const georgette = page.getByTestId('label-sheet').getByRole('listitem').filter({ hasText: `Georgette Saree ${run}` }).first();
  const barcode = (await georgette.getByRole('img', { name: /^Barcode/ }).getAttribute('aria-label'))?.match(/Barcode (\d{13})/)?.[1];

  // Next item: company and category are already chosen.
  await page.getByRole('link', { name: '+ Add next item' }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/new\?supplier=.+&category=.+/);
  await expect(companyBox(page).locator('option:checked')).toHaveText('Shree Ganesh Textiles');
  await expect(page.getByLabel('Category').locator('option:checked')).toHaveText('Saree (SA)');
  // The last item's name and prices are gone (Next 16 keeps the page alive; it is cleared after saving).
  await expect(page.getByLabel('Product name')).toHaveValue('');
  await expect(purchasePrice(page)).toHaveValue('');
  await expect(page.getByLabel('Counter price, if lower (₹)')).toHaveValue('');
  await page.getByLabel('Product name').fill(`Cotton Saree ${run}`);
  await salePrice(page).fill('1200');
  await purchasePrice(page).fill('600');
  await page.getByRole('button', { name: 'Save 1 item' }).click();
  await expect(page.getByTestId('receipt-lines')).toContainText(`Cotton Saree ${run} · Assorted · Free`);

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
  await page.goto('/admin/suppliers');
  await page.getByText('+ Add supplier').click();
  await page.getByLabel('Company name').fill(company);
  await page.getByRole('button', { name: 'Add supplier' }).click();
  await expect(page.getByRole('status')).toContainText(`${company} added.`);

  // One bill from that company, entered as two items: a saree with 2 pieces and one with none left.
  await page.goto('/admin/stock/new');
  await companyBox(page).selectOption({ label: company });
  await page.getByLabel('Category').selectOption({ label: 'Saree (SA)' });
  await page.getByLabel('Product name').fill(`Silk TagLib ${run}`);
  await salePrice(page).fill('2000');
  await purchasePrice(page).fill('1200');
  await page.getByLabel('Pieces', { exact: true }).fill('2');
  await page.getByLabel('Supplier bill no. (optional)').fill(`B-${run}`);
  await page.getByRole('button', { name: 'Save 1 item' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  await page.getByRole('link', { name: '+ Add next item' }).click();
  await page.getByLabel('Product name').fill(`Net TagLib ${run}`);
  await salePrice(page).fill('1500');
  await purchasePrice(page).fill('900');
  await page.getByLabel('Pieces', { exact: true }).fill('0');
  await page.getByLabel('Supplier bill no. (optional)').fill(`B-${run}`);
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
  await page.getByRole('link', { name: `Open Silk TagLib ${run} · Assorted · Free` }).click();
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
  await page.goto('/admin/suppliers');
  await page.getByText('+ Add supplier').click();
  await page.getByLabel('Company name').fill(company);
  await page.getByRole('button', { name: 'Add supplier' }).click();
  await expect(page.getByRole('status')).toContainText(`${company} added.`);

  // One design in 2 sizes × 2 colours = 4 items, 2 pieces each.
  await page.goto('/admin/stock/new');
  await companyBox(page).selectOption({ label: company });
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Product name').fill(name);
  await salePrice(page).fill('1499');
  await purchasePrice(page).fill('800');
  await page.getByLabel('Counter price, if lower (₹)').fill('1399');
  await showVariants(page);
  await page.getByRole('button', { name: 'Size M' }).click();
  await page.getByRole('button', { name: 'Size L' }).click();
  await page.getByLabel('Colour', { exact: true }).fill('Blue, Pink');
  await page.getByRole('button', { name: 'Add colour' }).click();
  await tab(page, 'Details');
  await page.getByLabel('Pieces each').fill('2');
  await page.getByRole('button', { name: 'Save 4 items' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);

  // Products: one card for the 4 items, with every size and colour and their pieces.
  await page.goto(`/admin/products?q=${encodeURIComponent(name)}`);
  const cards = page.getByTestId('design-list').getByTestId('design-card');
  await expect(cards).toHaveCount(1);
  const designCard = cards.first();
  await expect(designCard).toContainText(name);
  await expect(designCard).toContainText(`${company} · MRP ₹1,499.00 · selling ₹1,399.00`);
  await expect(designCard.getByTestId('design-sizes')).toHaveText('M · 4L · 4');
  await expect(designCard.getByTestId('design-colours')).toHaveText('Blue · 4Pink · 4');
  await expect(designCard).toContainText('Items: 4 · In stock: 8 pcs');
  await expect(designCard.getByRole('img', { name: `Design QR for ${name}` })).toBeVisible();
  const items = designCard.getByTestId('design-items').getByRole('listitem');
  await expect(items.first()).toBeHidden();
  await designCard.getByText('Show 4 items').click();
  await expect(items).toHaveCount(4);
  await expect(items.first()).toBeVisible();
  // Every item: the old one-row-per-item list.
  await page.getByRole('navigation', { name: 'Show' }).getByRole('link', { name: 'Every item' }).click();
  await expect(page).toHaveURL(/show=items/);
  await expect(page.getByTestId('product-list').getByRole('listitem')).toHaveCount(4);

  // All tags: the same card; its 4 real tags fold out; Every tag shows them all at once.
  await page.goto(`/admin/labels?q=${encodeURIComponent(name)}`);
  const tagCard = page.getByTestId('tag-library').getByTestId('design-card');
  await expect(tagCard).toHaveCount(1);
  await expect(page.getByTestId('tag-summary')).toContainText('Designs: 1 · Tags: 4 · In stock: 8 pcs · Groups: 1');
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
  await page.goto('/admin/stock/new');
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
  await page.getByLabel('Colour', { exact: true }).fill('Orange');
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
  for (const title of ['New item', 'Tag old stock', 'Print tags', 'More pieces arrived']) await expect(lessons.getByRole('button', { name: new RegExp(title) })).toBeVisible();
  await expect(lessons.getByRole('button', { name: /Log in/ })).toHaveCount(0);
  // The tag lesson shows the real tag with one part ringed at a time.
  await page.getByRole('button', { name: 'Everyone', exact: true }).click();
  await lessons.getByRole('button', { name: /Read a tag/ }).click();
  const tagStory = page.getByRole('dialog', { name: 'Read a tag' });
  await expect(tagStory.getByTestId('hang-tag')).toBeVisible();
  await expect(tagStory.getByTestId('story-text')).toHaveText('QR opens the item');
  // Finishing a lesson ticks it, and that is remembered on this phone.
  await expect(page.getByTestId('guide-progress')).toContainText('0 of 17 learned');
  for (let i = 0; i < 5; i++) await tagStory.getByRole('button', { name: 'Next step' }).click();
  await expect(tagStory.getByTestId('story-text')).toHaveText('Every part has a job.');
  await tagStory.getByRole('button', { name: 'Got it ✓' }).click();
  await expect(tagStory).toBeHidden();
  await expect(page.getByTestId('guide-progress')).toContainText('1 of 17 learned');
  await page.reload();
  await expect(page.getByTestId('guide-progress')).toContainText('1 of 17 learned');
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
  await page.getByLabel('Colour', { exact: true }).fill('White');
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
  await expect(page.getByTestId('item-pills')).toContainText('Girls');
  await expect(page.getByTestId('item-pills')).toContainText('Child');
  await expect(page.getByTestId('item-pills')).not.toContainText('Adult');
  await expect(page.getByText(barcode!).first()).toBeVisible();
  await page.goto(`/admin/products?q=${run}&show=items`); // one row per item: still exactly one
  await expect(page.getByText(`Chikan Kurta Long ${run}`)).toHaveCount(1);
  await expect(page.getByText(`Chikan Kurta ${run}`, { exact: true })).toHaveCount(0);
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
