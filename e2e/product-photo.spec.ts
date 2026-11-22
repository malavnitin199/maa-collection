import { test, expect, type Locator, type Page } from '@playwright/test';
import { productCard } from './products';

/**
 * The product's one photo (owner, 2026-11-23, ADR-068): many sizes, one picture. On the
 * product page the box at the top says Add photo; a tap opens a sheet with 📷 Take photo and
 * 🖼 From gallery. Every size shows it; Change photo replaces it; Remove photo asks first.
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

async function choose(box: Locator, label: string) {
  await box.click();
  await box.page().getByRole('listbox').getByRole('option', { name: label, exact: true }).click();
}

/** A plain JPEG of one colour, drawn in the browser. */
async function jpeg(page: Page, colour: string) {
  const data = await page.evaluate((fill) => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 500;
    const g = c.getContext('2d')!;
    g.fillStyle = fill;
    g.fillRect(0, 0, 400, 500);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, colour);
  return { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(data, 'base64') };
}

test('product page: add one photo for every size, change it, remove it', async ({ page }) => {
  await loginOwner(page);
  const name = `Photo Page Kurta ${run}`;
  await page.goto('/admin/stock/form');
  await page.getByLabel('Product name').fill(name);
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await choose(page.getByRole('combobox', { name: /^Company/ }), 'Shree Ganesh Textiles');
  await page.getByLabel('Sale price (MRP) ₹').fill('999');
  await page.getByLabel('Purchase price ₹', { exact: true }).fill('400');
  await page.getByRole('tab', { name: 'Sizes', exact: true }).click();
  await page.getByRole('button', { name: 'Size M' }).click();
  await page.getByRole('button', { name: 'Size L' }).click();
  await page.getByRole('tab', { name: 'Details', exact: true }).click();
  await page.getByRole('button', { name: 'Save 2 items' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);
  const lines = page.getByTestId('receipt-lines');
  const sizeL = await lines.getByRole('link', { name: `${name} · L` }).getAttribute('href');
  const sizeM = await lines.getByRole('link', { name: `${name} · M` }).getAttribute('href');

  // No photo yet: the box says Add photo.
  await page.goto(sizeM!);
  const head = page.getByTestId('item-head');
  await expect(head.getByRole('img')).toHaveCount(0);
  await head.getByRole('button', { name: 'Add photo' }).click();
  const sheet = page.getByTestId('photo-sheet');
  await expect(sheet.getByRole('button', { name: '📷 Take photo' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Remove photo' })).toHaveCount(0);
  await page.getByLabel('Gallery for this product').setInputFiles(await jpeg(page, '#1d4ed8'));
  const done = page.getByTestId('done-overlay');
  await expect(done).toContainText('Photo added');
  await expect(done).toContainText('2'); // sizes
  await page.keyboard.press('Escape');
  const photo = head.getByRole('img', { name });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const first = await photo.getAttribute('src');

  // The other size and the Products card show it too.
  await page.goto(sizeL!);
  await expect(page.getByTestId('item-head').getByRole('img', { name })).toHaveAttribute('src', first!);
  await page.goto('/admin/products');
  await expect(productCard(page, name).locator('img')).toHaveAttribute('src', first!);

  // Change photo: the big photo in the sheet, a new one replaces it on every size.
  await page.goto(sizeM!);
  await page.getByTestId('item-head').getByRole('button', { name: 'Change photo' }).click();
  await expect(sheet.getByRole('img', { name })).toBeVisible();
  await page.getByLabel('Gallery for this product').setInputFiles(await jpeg(page, '#b91c1c'));
  await expect(done).toContainText('Photo changed');
  await page.keyboard.press('Escape');
  const changed = page.getByTestId('item-head').getByRole('img', { name });
  await expect(changed).not.toHaveAttribute('src', first!);
  const second = await changed.getAttribute('src');
  await page.goto(sizeL!);
  await expect(page.getByTestId('item-head').getByRole('img', { name })).toHaveAttribute('src', second!);

  // Remove photo asks once more, then no size has one.
  await page.getByTestId('item-head').getByRole('button', { name: 'Change photo' }).click();
  await sheet.getByRole('button', { name: 'Remove photo' }).click();
  await expect(sheet).toContainText('Remove the photo from all 2 sizes?');
  await sheet.getByRole('button', { name: 'Keep it' }).click();
  await sheet.getByRole('button', { name: 'Remove photo' }).click();
  await sheet.getByRole('button', { name: 'Yes, remove' }).click();
  await expect(done).toContainText('Photo removed');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('item-head').getByRole('img')).toHaveCount(0);
  await expect(page.getByTestId('item-head').getByRole('button', { name: 'Add photo' })).toBeVisible();
  await page.goto(sizeM!);
  await expect(page.getByTestId('item-head').getByRole('img')).toHaveCount(0);
});
