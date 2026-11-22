import { test, expect, type Locator, type Page } from '@playwright/test';
import { productCard } from './products';

/**
 * Owner, 2026-11-23 (ADR-068): coming back to a screen shows it plain — nothing ticked, no
 * search, no filter. Next keeps a visited screen alive and hidden; Back / Forward (the phone's
 * back button) shows that same copy again, so these tests move with them, never page.goto.
 * Also: the whole Products card opens the product, and a round › says so.
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

/** Two designs of two sizes each, through the old form. */
async function makeDesign(page: Page, name: string) {
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
}

test('Products: a tap anywhere on a card opens it; ticked cards are plain again after another screen', async ({ page }) => {
  await loginOwner(page);
  const first = `Return Kurta A ${run}`;
  const second = `Return Kurta B ${run}`;
  await makeDesign(page, first);
  await makeDesign(page, second);
  // From Home, Products through the app's own menu (the dock on a phone, the header on a computer).
  await page.goto('/admin/dashboard');
  const toProducts = () => page.locator('a[href="/admin/products"]').filter({ visible: true }).first().click();
  await toProducts();
  await expect(page).toHaveURL(/\/admin\/products$/);

  // The card says it opens (a round ›), and a tap on its sizes — not the name — opens it.
  const card = productCard(page, first).filter({ visible: true });
  await expect(card.getByTestId('card-open')).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  const sizes = await card.getByTestId('design-sizes').boundingBox();
  await page.mouse.click(sizes!.x + 4, sizes!.y + sizes!.height / 2);
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(first);
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/products$/);

  // Tick two cards: the › steps aside while selecting.
  await page.getByTestId('select-products').filter({ visible: true }).click();
  await page.getByRole('checkbox', { name: `Select ${first}` }).click();
  await page.getByRole('checkbox', { name: `Select ${second}` }).click();
  await expect(page.getByTestId('selected-count')).toHaveText('4 selected');
  await expect(card.getByTestId('card-open')).toHaveCSS('opacity', '0');

  // The phone's back button to Home, then Products again: nothing ticked, no bar.
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByTestId('quick-actions').filter({ visible: true })).toBeVisible();
  await toProducts();
  await expect(page).toHaveURL(/\/admin\/products$/);
  await expect(page.getByTestId('select-products').filter({ visible: true })).toBeVisible();
  await expect(page.getByTestId('selection-bar')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: `Select ${first}` })).toHaveCount(0);
  await expect(card.getByTestId('card-open')).toHaveCSS('opacity', '1');

  // Forward / back between two screens (Products ⇄ the product): still plain.
  await page.getByTestId('select-products').filter({ visible: true }).click();
  await page.getByRole('checkbox', { name: `Select ${first}` }).click();
  await expect(page.getByTestId('selected-count')).toHaveText('2 selected');
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByTestId('quick-actions').filter({ visible: true })).toBeVisible(); // Home is on screen
  await page.goForward();
  await expect(page).toHaveURL(/\/admin\/products$/);
  await expect(page.getByTestId('selection-bar')).toHaveCount(0);
});

test('Companies: the search and place are empty again after opening a company and coming back', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/admin/companies');
  const search = page.getByTestId('company-search');
  await search.fill('Shree');
  await expect(page.getByTestId('company-count')).toBeVisible();
  await page.getByTestId('supplier-list').getByRole('link', { name: /Shree Ganesh Textiles/ }).click();
  await expect(page).toHaveURL(/\/admin\/companies\/[0-9a-f-]{36}$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/companies$/);
  await expect(page.getByTestId('company-search').filter({ visible: true })).toHaveValue('');
  await expect(page.getByTestId('company-count')).toHaveCount(0);
});

test('All tags: search and filters are gone after another screen; the plain list shows', async ({ page }) => {
  await loginOwner(page);
  const name = `Return Tags ${run}`;
  await makeDesign(page, name);
  await page.goto(`/admin/labels?q=${encodeURIComponent(name)}&stock=in`);
  const search = page.locator('input[name="q"]').filter({ visible: true });
  await expect(search).toHaveValue(name);
  // Another screen through the app (print these tags), then Back.
  await page.getByRole('link', { name: /^Print these tags/ }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?/);
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/labels$/);
  await expect(search).toHaveValue('');
});
