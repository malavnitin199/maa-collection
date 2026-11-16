import { test, expect, type Page } from '@playwright/test';

// Local/test database seeds every account with PIN 1234 (never in production).
const PIN = '1234';
const run = Date.now().toString(36);

async function login(page: Page, name: string, pin = PIN) {
  await page.context().clearCookies(); // switch user: start logged out
  await page.goto('/login');
  await page.getByText(name, { exact: true }).click();
  await page.getByLabel('PIN').fill(pin);
  await page.getByRole('button', { name: 'Log in' }).click();
  // Wait for the login to finish before navigating, or the next page load races it.
  if (pin === PIN) await expect(page).not.toHaveURL(/\/login$/);
}

/** Admin adds a product; returns its generated barcode. */
async function addProduct(page: Page, { name, size, mrp, price, stock }: { name: string; size: string; mrp: string; price: string; stock: string }) {
  await page.goto('/admin/products/new');
  await page.getByLabel('Product name').fill(name);
  await page.getByLabel('Brand').fill('Test Brand');
  await page.getByRole('combobox', { name: /^Category/ }).selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Size').fill(size);
  await page.getByLabel('Colour').fill('Blue');
  await page.getByLabel('MRP (₹)').fill(mrp);
  await page.getByLabel('Selling price (₹)').fill(price);
  await page.getByLabel(/Purchase price/).fill('500');
  await page.getByLabel('Opening stock (pieces)').fill(stock);
  await page.getByRole('button', { name: 'Add product and generate label' }).click();
  const status = page.getByRole('status');
  await expect(status).toContainText('Product added');
  const barcode = (await status.innerText()).match(/barcode (\d{13})/)?.[1];
  expect(barcode).toMatch(/^200\d{10}$/);
  await expect(page.getByRole('img', { name: `Barcode ${barcode} for MAA-KU-`, exact: false })).toBeVisible();
  return barcode as string;
}

/** Hardware scanners type fast and press Enter. */
async function scan(page: Page, code: string) {
  await page.keyboard.type(code, { delay: 5 });
  await page.keyboard.press('Enter');
}

test('logged-out visitors go to login; salesmen cannot open admin pages; wrong PIN is refused', async ({ page }) => {
  await page.goto('/pos');
  await expect(page).toHaveURL(/\/login$/);

  await login(page, 'Pradeep', '0000');
  await expect(page.getByText('Wrong PIN. Try again.')).toBeVisible();

  await login(page, 'Pradeep');
  await expect(page).toHaveURL(/\/pos$/);
  await expect(page.getByTestId('current-user')).toContainText('Pradeep · Salesman');
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/pos$/);
  await expect(page.getByRole('link', { name: 'Products' })).toHaveCount(0);
});

test('camera scanner opens over the current screen without moving the scan form', async ({ page }) => {
  await login(page, 'Nitin');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const scanForm = page.locator('form').filter({ has: page.getByLabel('Scan barcode or enter SKU') });
  const geometry = () =>
    scanForm.evaluate((form) => {
      const { x, y, width, height } = form.getBoundingClientRect();
      return { x: x + window.scrollX, y: y + window.scrollY, width, height };
    });
  const before = await geometry();
  const cameraButton = page.getByRole('button', { name: 'Scan with camera' });
  const buttonBefore = await cameraButton.boundingBox();
  expect(buttonBefore).not.toBeNull();
  expect(buttonBefore!.height).toBeGreaterThanOrEqual(44);

  await cameraButton.click();

  const dialog = page.getByRole('dialog', { name: 'Camera scan' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();
  const dialogBounds = await dialog.boundingBox();
  const closeButton = dialog.getByRole('button', { name: 'Close' });
  const closeBounds = await closeButton.boundingBox();
  expect(dialogBounds).not.toBeNull();
  expect(closeBounds).not.toBeNull();
  const buttonCenterX = buttonBefore!.x + buttonBefore!.width / 2;
  const closeCenterX = closeBounds!.x + closeBounds!.width / 2;
  const dialogCenterX = dialogBounds!.x + dialogBounds!.width / 2;
  expect(dialogBounds!.x).toBeLessThanOrEqual(buttonCenterX);
  expect(dialogBounds!.x + dialogBounds!.width).toBeGreaterThanOrEqual(buttonCenterX);
  expect(Math.abs(dialogBounds!.y + dialogBounds!.height - (buttonBefore!.y - 8))).toBeLessThan(20);
  expect(Math.abs(closeCenterX - dialogCenterX)).toBeLessThan(1);
  expect(closeBounds!.width).toBeGreaterThanOrEqual(44);
  expect(closeBounds!.height).toBeGreaterThanOrEqual(44);
  const after = await geometry();
  expect(after.x).toBeCloseTo(before.x, 1);
  expect(Math.abs(after.y - before.y)).toBeLessThan(4);
  expect(after.width).toBeCloseTo(before.width, 1);
  expect(after.height).toBeCloseTo(before.height, 1);

  await closeButton.click();
  await expect(dialog).toHaveCount(0);
  await expect(cameraButton).toBeFocused();

  await cameraButton.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(cameraButton).toBeFocused();

  await cameraButton.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(4, 4);
  await expect(dialog).toHaveCount(0);
  await expect(cameraButton).toBeFocused();
});

test('admin adds a product with a generated barcode, receives stock; salesman sells it on behalf of a colleague', async ({ page }) => {
  await login(page, 'Owner');
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  const barcode = await addProduct(page, { name: `Test Kurta ${run}`, size: 'M', mrp: '1299', price: '1199', stock: '2' });

  await page.getByLabel('Pieces received').fill('3');
  await page.getByRole('button', { name: 'Add stock' }).click();
  await expect(page.getByText('Stock is now 5')).toBeVisible();

  // Nitin sells 2, credited to Vishal.
  await login(page, 'Nitin');
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await scan(page, barcode);
  await expect(page.getByTestId('item-details')).toContainText(`Test Kurta ${run}`);
  await expect(page.getByTestId('details-stock')).toHaveText('5');
  await expect(page.getByTestId('item-details')).not.toContainText('₹500.00'); // no purchase price at the counter
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await expect(page.getByLabel(/Sale price/)).toHaveValue('1199');
  await page.getByLabel('Quantity').fill('2');
  await page.getByLabel(/Sale price/).fill('1100');
  await page.getByLabel('Credit sale to').selectOption({ label: 'Vishal' });
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByRole('status')).toContainText('credited to Vishal (recorded by Nitin). Stock left: 3.');

  await page.goto('/pos/my-sales');
  await expect(page.getByTestId('my-activity')).toContainText(`2 × Test Kurta ${run}`);
  await expect(page.getByTestId('my-activity')).toContainText('credited to Vishal · recorded by Nitin');

  // Above-MRP price and unknown codes are refused.
  await page.goto('/pos');
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await scan(page, barcode);
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await page.getByLabel(/Sale price/).fill('1300');
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByRole('status')).toContainText('cannot be above MRP');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await scan(page, '0000000000000');
  await expect(page.getByRole('status')).toContainText('No item found');
});

test('exchange: return part of a sale for another size; stock and money stay correct', async ({ page }) => {
  await login(page, 'Owner');
  const medium = await addProduct(page, { name: `Swap Kurta ${run}`, size: 'M', mrp: '1500', price: '1500', stock: '3' });
  const large = await addProduct(page, { name: `Swap Kurta ${run}`, size: 'L', mrp: '1600', price: '1600', stock: '2' });

  await login(page, 'Vishal');
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await scan(page, medium);
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await page.getByLabel('Quantity').fill('2');
  await page.getByLabel(/Sale price/).fill('1400');
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByRole('status')).toContainText('Stock left: 1.');

  // Balram processes the exchange of 1 medium for 1 large.
  await login(page, 'Balram');
  await page.goto('/pos/exchange');
  await expect(page.getByLabel('1. Scan the item the customer brought back')).toBeFocused();
  await scan(page, medium);
  const saleRow = page.getByTestId('returnable-sales').getByRole('listitem').first();
  await expect(saleRow).toContainText('sold by Vishal');
  await expect(saleRow).toContainText('2 can be returned');
  await saleRow.getByRole('button', { name: 'Choose' }).click();
  await expect(page.getByLabel('3. Scan the new item the customer is taking')).toBeFocused();
  await scan(page, large);
  await expect(page.getByTestId('exchange-summary')).toContainText('Customer pays ₹200.00');
  await page.getByRole('button', { name: 'Confirm exchange' }).click();
  await expect(page.getByRole('status')).toContainText('Exchange done. Customer pays ₹200.00.');

  // Stock: medium 3 − 2 + 1 = 2, large 2 − 1 = 1.
  await page.goto('/pos');
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await scan(page, medium);
  await expect(page.getByTestId('details-stock')).toHaveText('2');
  await scan(page, large);
  await expect(page.getByTestId('item-details')).toContainText('L');
  await expect(page.getByTestId('details-stock')).toHaveText('1');

  // Admin sees it in the activity log, credited to the original seller.
  await login(page, 'Owner');
  await page.goto('/admin/activity');
  const log = page.getByTestId('activity-log');
  await expect(log).toContainText(`Returned 1 × Swap Kurta ${run} (M) → 1 × Swap Kurta ${run} (L)`);
  await expect(log).toContainText('credited to Vishal · recorded by Balram');
});

test('admin dashboard, staff and labels pages load with seeded data', async ({ page }) => {
  await login(page, 'Owner');
  await expect(page.getByTestId('sales-by-person')).toContainText('Vishal');
  await expect(page.getByTestId('sales-by-person')).toContainText('Balram');
  await page.goto('/admin/staff');
  for (const name of ['Owner', 'Vishal', 'Nitin', 'Pradeep', 'Balram']) {
    await expect(page.getByTestId('staff-list')).toContainText(name);
  }
  // All tags (plan v13): search narrows to the seeded tee, whatever else other tests have tagged.
  await page.goto('/admin/labels?q=MAA-TS-001&show=tags'); // every tag, not the combined cards
  await expect(page.getByRole('heading', { name: 'All tags' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Barcode 8901111000014 for MAA-TS-001' })).toBeVisible();
  // Hang tags carry a QR code next to the barcode (ADR-014).
  await expect(page.getByRole('img', { name: 'QR code for MAA-TS-001' })).toBeVisible();
});

test('sales team dashboard: number of sellers, each one’s share and daily sales; a QR scan leads straight to the sale', async ({ page }) => {
  await login(page, 'Owner');
  const barcode = await addProduct(page, { name: `Team Kurta ${run}`, size: 'M', mrp: '1000', price: '950', stock: '6' });

  // Pradeep opens the tag's QR link (what the phone camera opens) → the item is ready to sell → enters the agreed price.
  await login(page, 'Pradeep');
  await page.goto(`/i/${barcode}`);
  await expect(page).toHaveURL(new RegExp(`/pos\\?code=${barcode}$`));
  await expect(page.getByTestId('item-details')).toContainText(`Team Kurta ${run}`);
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await page.getByLabel(/Sale price/).fill('900');
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByRole('status')).toContainText('by Pradeep');
  // Salesmen can't see the team page.
  await page.goto('/admin/team');
  await expect(page).toHaveURL(/\/pos$/);

  await login(page, 'Owner');
  // Pradeep's sale waits for the owner (plan v12): approve it so it counts on the team page.
  await page.goto('/admin/approvals');
  const waiting = page.getByTestId('approval-entry').filter({ hasText: `Team Kurta ${run}` });
  await waiting.getByRole('button', { name: 'Approve' }).click();
  await expect(waiting).toHaveCount(0);
  await page.goto('/admin/dashboard');
  await page.getByRole('link', { name: 'Sales team graphs →' }).click();
  await expect(page).toHaveURL(/\/admin\/team$/);
  await expect(page.getByRole('heading', { name: 'Sales team', level: 1 })).toBeVisible();
  await expect(page.getByTestId('team-salesmen')).toHaveText(/^\d+$/);
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page).toHaveURL(/period=today/);
  const share = page.getByTestId('team-share').getByRole('listitem').filter({ hasText: 'Pradeep' });
  await expect(share).toContainText('%');
  await expect(share).toHaveAttribute('aria-label', /^Pradeep: ₹[\d,]+\.\d\d, [\d.]+% of team sales, \d+ bills, \d+ pieces$/);
  const card = page.getByRole('listitem', { name: 'Seller Pradeep' });
  await expect(card.getByRole('img', { name: 'Pradeep: sales per day' })).toBeVisible();
  await expect(card).toContainText('below MRP');
  await expect(page.getByTestId('team-table').getByRole('row').filter({ hasText: 'Pradeep' })).toContainText('₹');
  await page.getByRole('link', { name: 'Last 30 days' }).click();
  await expect(page).toHaveURL(/period=30d/);
  await expect(page.getByTestId('seller-cards').getByRole('listitem')).not.toHaveCount(0);
});

test('Hindi or English: switch on the login page or in the header; each person keeps their choice', async ({ page }) => {
  // Own salesman for this test, so the seeded staff stay in English for the other tests.
  await login(page, 'Owner');
  await page.goto('/admin/staff');
  const name = `Ravi ${run}`;
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('PIN (4–6 digits)').fill('4321');
  await page.getByRole('button', { name: 'Add staff' }).click();
  await expect(page.getByRole('status')).toContainText(`${name} added`);

  // Logged out: this phone switches to Hindi on the login page.
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByRole('button', { name: 'Language: English. Switch to Hindi' }).click();
  await expect(page.getByText('अपने नाम पर टैप करें और PIN डालें।')).toBeVisible();
  await page.getByText(name, { exact: true }).click();
  await page.getByLabel('PIN').fill('4321');
  await page.getByRole('button', { name: 'लॉग इन करें' }).click();
  await expect(page).toHaveURL(/\/pos$/);
  // Ravi hasn't chosen yet → the phone's Hindi. Screens, labels and server messages are in Hindi.
  await expect(page.getByRole('heading', { name: 'काउंटर बिक्री' })).toBeVisible();
  await expect(page.getByLabel('बारकोड स्कैन करें या SKU डालें')).toBeVisible();
  await scan(page, 'NOPE-404');
  await expect(page.getByText('"NOPE-404" का कोई आइटम नहीं मिला।')).toBeVisible();

  // Header switch: English and back, in place (no login again); saved on Ravi.
  await page.getByRole('button', { name: 'भाषा: हिन्दी। अंग्रेज़ी में बदलें' }).click();
  await expect(page.getByRole('heading', { name: 'Counter sale' })).toBeVisible();
  await page.getByRole('button', { name: 'Language: English. Switch to Hindi' }).click();
  await expect(page.getByRole('heading', { name: 'काउंटर बिक्री' })).toBeVisible();

  // Another phone (no cookie): English login page, but Ravi gets his Hindi back after logging in.
  await page.context().clearCookies();
  await page.goto('/login');
  await expect(page.getByText('Tap your name and enter your PIN.')).toBeVisible();
  await page.getByText(name, { exact: true }).click();
  await page.getByLabel('PIN').fill('4321');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'काउंटर बिक्री' })).toBeVisible();
  await page.goto('/pos/my-sales');
  await expect(page.getByRole('heading', { name: 'मेरी बिक्री' })).toBeVisible();
  await page.goto('/guide');
  // A salesman lands on the selling lessons, in Hindi; owner lessons are in Hindi too.
  const lessons = page.getByTestId('guide-lessons');
  await expect(lessons.getByRole('button', { name: /आइटम बेचें/ })).toBeVisible();
  await page.getByRole('button', { name: 'मालिक', exact: true }).click();
  await expect(lessons.getByRole('button', { name: /स्टॉक सही रखें/ })).toBeVisible();
});

test('owner and catalog screens in Hindi: Home dashboard, products, stock entry, reports', async ({ page }) => {
  // Own owner-level person for this test, so the seeded Owner stays in English for the other tests.
  await login(page, 'Owner');
  await page.goto('/admin/staff');
  const name = `Malik ${run}`;
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Role').selectOption('admin');
  await page.getByLabel('PIN (4–6 digits)').fill('5678');
  await page.getByRole('button', { name: 'Add staff' }).click();
  await expect(page.getByRole('status')).toContainText(`${name} added`);

  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByRole('button', { name: 'Language: English. Switch to Hindi' }).click();
  await expect(page.getByText('अपने नाम पर टैप करें और PIN डालें।')).toBeVisible();
  await page.getByText(name, { exact: true }).click();
  await page.getByLabel('PIN').fill('5678');
  await page.getByRole('button', { name: 'लॉग इन करें' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  // Home: the owner's own words (Today / This month / net sales / exchanges) are Hindi; no English labels left.
  const main = page.locator('main');
  await expect(main.getByRole('heading', { name: 'आज', exact: true })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'इस महीने', exact: true })).toBeVisible();
  for (const english of ['Net revenue', 'Net sales', 'This month', 'Exchanges', 'Sales by salesperson', 'Low stock', 'Est. profit']) {
    await expect(main.getByText(english, { exact: false })).toHaveCount(0);
  }
  // Products, stock entry and reports pages open in Hindi.
  for (const path of ['/admin/products', '/admin/stock/new', '/admin/reports', '/admin/categories']) {
    await page.goto(path);
    await expect(page.locator('h1')).toHaveText(/[\u0900-\u097F]/);
  }
});

test('scan feedback: green tick, buzz and shake on a failed scan, "Sale done" card; sound can be muted', async ({ page }) => {
  await login(page, 'Owner');
  const barcode = await addProduct(page, { name: `Ting Kurta ${run}`, size: 'L', mrp: '800', price: '750', stock: '3' });

  await login(page, 'Balram');
  const sound = () => page.getByRole('button', { name: 'Sound and vibration for scans' });
  await expect(sound()).toHaveAttribute('aria-pressed', 'true'); // on by default
  await sound().click();
  await expect(sound()).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(sound()).toHaveAttribute('aria-pressed', 'false'); // remembered on this phone
  await sound().click();
  await expect(sound()).toHaveAttribute('aria-pressed', 'true');

  await scan(page, 'NOPE-999');
  await expect(page.locator('[data-last-scan="error"]')).toBeVisible();
  await scan(page, barcode);
  await expect(page.locator('[data-last-scan="ok"]')).toBeVisible();
  await expect(page.getByTestId('scan-ok')).toBeAttached();
  await expect(page.getByTestId('item-details')).toContainText(`Ting Kurta ${run}`);

  await page.getByRole('button', { name: 'Sell this item' }).click();
  await page.getByLabel(/Sale price/).fill('700');
  await page.getByRole('button', { name: 'Record sale' }).click();
  const done = page.getByTestId('done-overlay');
  await expect(done).toContainText('Sale done');
  await expect(done).toContainText('₹700.00');
  await expect(done).toBeHidden({ timeout: 5000 }); // closes by itself
  await expect(page.getByRole('status')).toContainText('by Balram');
});

test('sell without scanning, then the owner approves one entry and rejects another with a reason; totals and stock follow', async ({ page }) => {
  await login(page, 'Owner');
  const barcode = await addProduct(page, { name: `Plain Shirt ${run}`, size: 'L', mrp: '1499', price: '1299', stock: '2' });

  // Nitin: the tag would not scan → enter by hand; then a normal scanned sale. Both wait for the owner.
  await login(page, 'Nitin');
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await page.getByTestId('by-hand').click();
  await page.getByLabel('Item name').fill(`Blue kurti ${run}`);
  await page.getByLabel('Size (optional)').fill('M');
  await page.getByLabel(/Sale price/).fill('850');
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByRole('status')).toContainText(`Sold 1 × Blue kurti ${run} @ ₹850.00 each — by Nitin. Sent to the owner to check.`);
  await expect(page.getByTestId('by-hand-form')).toHaveCount(0);
  await page.goto('/pos');
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await scan(page, barcode);
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await page.getByLabel(/Sale price/).fill('1100');
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByRole('status')).toContainText('Stock left: 1. Sent to the owner to check.');

  // The desktop and phone runs share one database, so every check is keyed by this run's names.
  await page.goto('/pos/my-sales');
  await expect(page.getByTestId('my-waiting')).toContainText('Waiting for the owner:');
  const mine = (name: string) => page.getByTestId('my-activity').getByRole('listitem').filter({ hasText: name });
  await expect(mine(`Blue kurti ${run}`).getByTestId('status-waiting')).toBeVisible();
  await expect(mine(`Blue kurti ${run}`)).toContainText('By hand');
  await expect(mine(`Plain Shirt ${run}`).getByTestId('status-waiting')).toBeVisible();
  await page.goto('/admin/approvals');
  await expect(page).not.toHaveURL(/\/admin\/approvals/); // salesmen have no Approvals

  // Owner: Home shows the count; approve the by-hand sale, reject the scanned one with a reason.
  await login(page, 'Owner');
  await expect(page.getByTestId('approvals-waiting')).toContainText('entries waiting');
  await page.getByTestId('approvals-waiting').click();
  await expect(page).toHaveURL(/\/admin\/approvals$/);
  const byHand = page.getByTestId('approval-entry').filter({ hasText: `Blue kurti ${run}` });
  await expect(byHand).toHaveCount(1);
  await expect(byHand).toContainText('By hand');
  await expect(byHand).toContainText('No MRP (entered by hand)');
  await byHand.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('status')).toHaveText('Approved.');
  await expect(byHand).toHaveCount(0);

  const scanned = page.getByTestId('approval-entry').filter({ hasText: `Plain Shirt ${run}` });
  await expect(scanned).toContainText('MRP ₹1,499.00 · usual ₹1,299.00');
  await expect(scanned).toContainText('27% below MRP');
  await scanned.getByRole('button', { name: 'Reject' }).click();
  await scanned.getByRole('radio', { name: 'Wrong price' }).click();
  await scanned.getByLabel('Note (optional)').fill(`He said 1,000 ${run}`);
  await scanned.getByRole('button', { name: 'Reject entry' }).click();
  await expect(page.getByRole('status')).toHaveText('Rejected. 1 pcs back in stock.');
  await expect(scanned).toHaveCount(0);
  const decided = page.getByTestId('recent-decisions').getByRole('listitem').filter({ hasText: `Plain Shirt ${run}` });
  await expect(decided).toContainText('Wrong price');
  await expect(decided).toContainText(`He said 1,000 ${run}`);

  // Nitin: the piece is back on the shelf; the rejected sale is marked, the approved one no longer waits.
  await login(page, 'Nitin');
  await scan(page, barcode);
  await expect(page.getByTestId('details-stock')).toHaveText('2');
  await page.goto('/pos/my-sales');
  await expect(mine(`Plain Shirt ${run}`).getByTestId('status-rejected')).toBeVisible();
  await expect(mine(`Blue kurti ${run}`).getByTestId('status-waiting')).toHaveCount(0);
  await expect(mine(`Blue kurti ${run}`).getByTestId('status-rejected')).toHaveCount(0);
});
