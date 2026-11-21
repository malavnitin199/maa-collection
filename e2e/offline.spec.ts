import { test, expect, type Page } from '@playwright/test';

/**
 * Plan v18 — selling without internet: the counter keeps working from the
 * phone's copy of the items, sales wait on the phone, and they are sent by
 * themselves when internet is back (even if the stock goes below zero).
 */
const PIN = '1234';
const run = Date.now().toString(36);

async function login(page: Page, name: string) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByText(name, { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function addProduct(page: Page, name: string, stock: string) {
  await page.goto('/admin/products/new');
  await page.getByLabel('Product name').fill(name);
  await page.getByLabel('Brand').fill('Test Brand');
  await page.getByRole('combobox', { name: /^Category/ }).selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Size').fill('M');
  await page.getByLabel('MRP (₹)').fill('999');
  await page.getByLabel('Selling price (₹)').fill('899');
  await page.getByLabel(/Purchase price/).fill('500');
  await page.getByLabel('Opening stock (pieces)').fill(stock);
  await page.getByRole('button', { name: 'Add product and generate label' }).click();
  const status = page.getByRole('status');
  await expect(status).toContainText('Product added');
  return (await status.innerText()).match(/barcode (\d{13})/)![1];
}

/** Hardware scanners type fast and press Enter (once the counter is ready for them). */
async function scan(page: Page, code: string) {
  await expect(page.getByLabel('Scan barcode or enter SKU')).toBeFocused();
  await page.keyboard.type(code, { delay: 5 });
  await page.keyboard.press('Enter');
}

/** Whose copy of the items this phone holds, if it already has `barcode` in it ('' = not yet). */
function phoneCopyOwner(page: Page, barcode: string) {
  return page.evaluate(
    (code) =>
      new Promise<string>((resolve) => {
        const open = indexedDB.open('maa-offline');
        // Never create the app's storage from the test.
        open.onupgradeneeded = () => open.transaction?.abort();
        open.onerror = () => resolve('');
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('kv')) {
            db.close();
            return resolve('');
          }
          const read = db.transaction('kv', 'readonly').objectStore('kv').get('catalogue');
          read.onsuccess = () => {
            const copy = read.result as { me: { name: string }; items: { barcode: string }[] } | undefined;
            db.close();
            resolve(copy?.items.some((item) => item.barcode === code) ? copy.me.name : '');
          };
          read.onerror = () => {
            db.close();
            resolve('');
          };
        };
      }),
    barcode,
  );
}

test('no internet: scan and sell from the phone’s copy, sell by hand, see them waiting; sent by themselves when internet is back, even below zero stock', async ({ page, context }, testInfo) => {
  const name = `Offline Kurta ${run} ${testInfo.project.name}`;
  const handName = `Offline dupatta ${run} ${testInfo.project.name}`;
  await login(page, 'Owner');
  const barcode = await addProduct(page, name, '1');

  await login(page, 'Vishal');
  // Exchange needs the shop's server: it says so when the internet drops.
  await page.goto('/pos/exchange');
  await context.setOffline(true);
  await expect(page.getByTestId('exchange-offline')).toHaveText('Exchange needs internet. Counter sales work without it.');
  await context.setOffline(false);

  await page.goto('/pos');
  // While online the phone keeps a copy of the items (never purchase prices).
  await expect.poll(() => phoneCopyOwner(page, barcode), { timeout: 20_000 }).toBe('Vishal');

  await context.setOffline(true);
  const strip = page.getByTestId('offline-strip');
  await expect(strip).toContainText('No internet · the counter still works');

  // Scan: found in the phone's copy; 2 sold although the copy says 1 left (owner's choice).
  await scan(page, barcode);
  await expect(page.getByTestId('item-details')).toContainText(name);
  await expect(page.getByTestId('phone-copy')).toContainText('No internet: from this phone’s copy');
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await page.getByLabel('Quantity').fill('2');
  await page.getByLabel(/Sale price/).fill('850');
  await page.getByRole('button', { name: 'Record sale' }).click();
  const done = page.getByTestId('done-overlay');
  await expect(done).toContainText('Saved on this phone');
  await expect(done).toContainText('₹1,700.00');
  await expect(page.getByRole('status').filter({ hasText: 'Saved on this phone: 2 ×' })).toContainText('It is sent to the shop when internet is back.');
  await expect(page.getByTestId('offline-count')).toHaveText('1');

  // Sell by hand: also saved on the phone.
  await expect(done).toBeHidden({ timeout: 5000 });
  await page.getByTestId('by-hand').click();
  await page.getByLabel('Item name').fill(handName);
  await page.getByLabel(/Sale price/).fill('300');
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByTestId('offline-count')).toHaveText('2');
  await expect(strip).toContainText('No internet · 2 sales saved on this phone');

  // See them: both waiting; Send now waits for internet.
  await strip.click();
  const sheet = page.getByRole('dialog', { name: 'Saved on this phone' });
  await expect(sheet.getByTestId('saved-sale')).toHaveCount(2);
  await expect(sheet.getByTestId('saved-sale').first()).toContainText(`${name} · M`);
  await expect(sheet.getByTestId('saved-sale').first()).toContainText('2 × ₹850.00 · for Vishal');
  await expect(sheet.getByTestId('send-now')).toHaveText('Waiting for internet');
  await expect(sheet.getByTestId('send-now')).toBeDisabled();
  await sheet.getByRole('button', { name: 'Close' }).click();

  // Logging out warns: the sales stay on the phone.
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByTestId('logout-warning')).toContainText('2 sales on this phone are not sent yet.');
  await page.getByTestId('logout-warning').getByRole('button', { name: 'Cancel' }).click();
  await page.keyboard.press('Escape');

  // Internet is back: sent by themselves, and the strip goes away.
  await context.setOffline(false);
  await expect(page.getByTestId('offline-sent')).toHaveText('2 saved sales reached the shop', { timeout: 20_000 });
  await expect(strip).toBeHidden();

  // The owner checks them like any other sale, marked "made offline"; the count went below zero.
  await login(page, 'Owner');
  await page.goto('/admin/approvals');
  const scanned = page.getByTestId('approval-entry').filter({ hasText: name });
  await expect(scanned).toHaveCount(1);
  await expect(scanned).toContainText(`2 × ${name}`);
  await expect(scanned.getByTestId('made-offline')).toContainText('Made offline ·');
  const byHand = page.getByTestId('approval-entry').filter({ hasText: handName });
  await expect(byHand.getByTestId('made-offline')).toBeVisible();
  await page.goto('/pos');
  await scan(page, barcode);
  await expect(page.getByTestId('details-stock')).toHaveText('-1');
});

test('the counter opens without internet (offline helper), and a tag’s QR link opens the item from the phone’s copy', async ({ page, context }, testInfo) => {
  const name = `Helper Kurta ${run} ${testInfo.project.name}`;
  await login(page, 'Owner');
  const barcode = await addProduct(page, name, '3');
  await login(page, 'Nitin');
  await expect(page).toHaveURL(/\/pos$/);
  const helper = await page.evaluate(async () => Boolean('serviceWorker' in navigator && (await navigator.serviceWorker.getRegistration())));
  test.skip(!helper, 'The offline helper runs only in the built app (next build && next start).');

  // The helper keeps the counter page; the app keeps the items' copy.
  await expect
    .poll(() => page.evaluate(async () => Boolean(await (await caches.open('maa-pages-v1')).match('/pos'))), { timeout: 20_000 })
    .toBe(true);
  await expect.poll(() => phoneCopyOwner(page, barcode), { timeout: 20_000 }).toBe('Nitin');

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Counter sale' })).toBeVisible();
  await expect(page.getByTestId('offline-strip')).toContainText('No internet');

  // A tag's QR code (opened with the phone's camera) → the counter with that item.
  await page.goto(`/i/${barcode}`);
  await expect(page).toHaveURL(new RegExp(`/pos\\?code=${barcode}$`));
  await expect(page.getByTestId('item-details')).toContainText(name);
  await expect(page.getByTestId('phone-copy')).toBeVisible();
  await page.getByRole('button', { name: 'Sell this item' }).click();
  await page.getByLabel(/Sale price/).fill('800');
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByTestId('offline-count')).toHaveText('1');

  // Other screens say they need internet and lead back to the counter.
  await page.goto('/pos/my-sales');
  await expect(page.getByRole('heading', { name: 'No internet' })).toBeVisible();
  await page.getByRole('link', { name: /Open the counter/ }).click();
  await expect(page.getByRole('heading', { name: 'Counter sale' })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByTestId('offline-sent')).toHaveText('1 saved sale reached the shop', { timeout: 20_000 });
  await page.goto('/pos/my-sales');
  await expect(page.getByTestId('my-activity')).toContainText(name);
});
