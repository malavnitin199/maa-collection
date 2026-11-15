import { test, expect, type Page } from '@playwright/test';

const PIN = '1234';
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

async function loginOwner(page: Page) {
  await page.goto('/login');
  await page.getByText('Owner', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

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
  await expect(page.getByRole('link', { name: /Many different products/ })).toBeVisible();
  await tabs.getByRole('link', { name: 'More' }).click();
  await page.getByRole('link', { name: /^Companies/ }).click();
  await expect(page).toHaveURL(/\/admin\/suppliers$/);
  await tabs.getByRole('link', { name: 'More' }).click();
  await page.getByRole('link', { name: /Categories/ }).click();
  await expect(page).toHaveURL(/\/admin\/categories$/);
  await tabs.getByRole('link', { name: 'Products' }).click();
  await expect(page.getByTestId('product-list')).toContainText('Classic Crew Tee');
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
  await page.getByRole('link', { name: '+ New design in sizes × colours' }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/new\?supplier=/);

  // Supplier preselected, brand defaults to the supplier name.
  await expect(page.getByLabel('Brand')).toHaveValue(`Design Co ${run}`);
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Design / product name').fill(`Chikan Kurta ${run}`);
  await page.getByRole('button', { name: 'Size M' }).click();
  await page.getByRole('button', { name: 'Size L' }).click();
  await page.getByLabel('Colour').fill('Blue, Pink');
  await page.getByRole('button', { name: 'Add colour' }).click();
  await page.getByLabel('MRP (₹)').fill('1499');
  await page.getByLabel('Selling price (₹)').fill('1399');
  await page.getByLabel('Purchase price (₹)').fill('800');
  await page.getByLabel('Pieces each').fill('2');
  await page.getByLabel('Supplier bill no. (optional)').fill('INV-42');
  await expect(page.getByTestId('design-preview')).toContainText('4 new items (2 colours × 2 sizes)');
  await expect(page.getByTestId('design-preview')).toContainText('8 pieces in total');
  await page.getByRole('button', { name: 'Save 4 items and print labels' }).click();

  // Labels: one per piece by default (8), or one per item (4).
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  await expect(page.getByText('Saved 4 new items with barcodes.')).toBeVisible();
  await expect(page.getByTestId('receipt-lines')).toContainText(`Chikan Kurta ${run} · Pink · L`);
  const labels = page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode 200/ });
  await expect(labels).toHaveCount(8);
  await page.getByRole('link', { name: 'One per item instead (4)' }).click();
  await expect(labels).toHaveCount(4);
  const barcode = (await labels.first().getAttribute('aria-label'))?.match(/Barcode (\d{13})/)?.[1];
  expect(barcode).toMatch(/^200\d{10}$/);

  // Rates for the whole design from any one of its products.
  await page.getByTestId('receipt-lines').getByRole('link').first().click();
  await expect(page.getByTestId('design-variants').getByRole('link')).toHaveCount(4);
  const rates = page.locator('section', { has: page.getByRole('heading', { name: 'Rates for the whole design' }) });
  await rates.getByLabel('MRP (₹)').fill('1599');
  await rates.getByLabel('Price (₹)').fill('1499');
  await rates.getByRole('button', { name: 'Apply to all 4 sizes/colours' }).click();
  await expect(page.getByText('Rates updated for 4 items.')).toBeVisible();
  await page.goto(`/admin/products?q=${encodeURIComponent(`Chikan Kurta ${run}`)}`);
  await expect(page.getByTestId('product-list').getByRole('listitem').filter({ hasText: '₹1,499.00' })).toHaveCount(4);

  // Same entry again is refused (sizes/colours already exist).
  await page.goto('/admin/stock/new');
  await page.getByRole('combobox', { name: /^Supplier/ }).selectOption({ label: `Design Co ${run}` });
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Design / product name').fill(`Chikan Kurta ${run}`);
  await page.getByRole('button', { name: 'Size M' }).click();
  await page.getByLabel('Colour').fill('Blue');
  await page.getByLabel('MRP (₹)').fill('1499');
  await page.getByRole('button', { name: /^Save 1 item/ }).click();
  await expect(page.getByText(/Already in the catalogue: Blue M/)).toBeVisible();

  // A salesman scans the new barcode at the counter.
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
  await expect(page.getByTestId('label-sheet').getByRole('img')).toHaveCount(5);
  await expect(page.getByText(/bill RS-1/)).toBeVisible();

  // Stock went up by exactly 3.
  await page.goto('/admin/products?q=MAA-SH-001');
  await expect(page.getByTestId('product-list')).toContainText(String(Number(before) + 3));
});

test('a salesman cannot add companies, categories, products, stock or change rates', async ({ page }) => {
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
  await page.goto('/admin/products?q=MAA-TS-001');
  await page.getByTestId('product-list').getByRole('link').first().click();
  await expect(page.getByTestId('price-code')).toHaveText('LSS');
});

test('quick add: one company + category, several products with their own prices → labels → seller scans', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/admin/stock');
  await page.getByRole('link', { name: /Many different products/ }).click();
  await page.getByRole('combobox', { name: /^Company/ }).selectOption({ label: 'Shree Ganesh Textiles' });
  await page.getByRole('combobox', { name: /^Category/ }).selectOption({ label: 'Saree (SA)' });

  await page.getByLabel('Product 1 name').fill(`Georgette Saree ${run}`);
  await page.getByLabel('Product 1 MRP').fill('2500');
  await page.getByLabel('Product 1 selling price').fill('2200');
  await page.getByLabel('Product 1 purchase price').fill('1400');
  await page.getByLabel('Product 1 pieces').fill('3');

  await page.getByRole('button', { name: '+ Add product' }).click();
  await page.getByLabel('Product 2 name').fill(`Cotton Saree ${run}`);
  await page.getByLabel('Product 2 MRP').fill('1200');
  await page.getByLabel('Product 2 purchase price').fill('600');
  await page.getByLabel('Product 2 pieces').fill('2');

  // Copy keeps the prices; just give it a new name.
  await page.getByTestId('quick-rows').getByRole('listitem').nth(1).getByRole('button', { name: 'Copy' }).click();
  await page.getByLabel('Product 3 name').fill(`Linen Saree ${run}`);
  await expect(page.getByLabel('Product 3 MRP')).toHaveValue('1200');

  await expect(page.getByTestId('quick-summary')).toHaveText('3 products · 7 pieces · purchase value ₹6,600.00');
  await page.getByRole('button', { name: 'Save 3 products and print labels' }).click();

  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  await expect(page.getByText('Saved 3 new items with barcodes.')).toBeVisible();
  await expect(page.getByTestId('label-sheet').getByRole('img', { name: /^Barcode 200/ })).toHaveCount(7);
  await expect(page.getByTestId('receipt-lines')).toContainText(`Georgette Saree ${run} · Assorted · Free`);
  const georgette = page.getByTestId('label-sheet').getByRole('listitem').filter({ hasText: `Georgette Saree ${run}` }).first();
  const barcode = (await georgette.getByRole('img').getAttribute('aria-label'))?.match(/Barcode (\d{13})/)?.[1];

  // The seller scans it: selling price ₹2,200 (MRP ₹2,500), no purchase price shown.
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
  await page.goto('/admin/stock/quick');
  await expect(page.getByLabel('Product 1 MRP')).toBeVisible();
  await expect(page.getByLabel('Product 1 purchase price')).toHaveCount(0);
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
  await page.getByLabel('Colour').fill('Orange');
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

test('help guide is reachable and first-time tips can be dismissed', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'New here?' }).click();
  await expect(page).toHaveURL(/\/help#start$/);
  await expect(page.getByRole('heading', { name: 'Help & guide' })).toBeVisible();
  await expect(page.getByText('Add it to your home screen')).toBeVisible(); // "New here?" open by default
  await page.getByText('Catalog & old stock (catalog / QC person)').click();
  await expect(page.getByText('Tag one item (about 30 seconds)')).toBeVisible();

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
