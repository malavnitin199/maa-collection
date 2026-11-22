import { test, expect, type Page } from '@playwright/test';
import { addToBill, billEditor, chooseBillCompany, openMore, openProduct } from './products';

/**
 * Bills (owner's feedback 2026-11-22, ADR-060/061): a bill stands on its own — a company if you
 * like (one), and the shop's products as lines: from the list (newest first), a search, a barcode
 * gun or the camera. Quantities and rates start from the product and can be changed; step 2 is
 * the paper check; the saved bill keeps its own copy; Edit bill; the Bills page; Home's line.
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

async function addCollection(page: Page, company: string, name: string) {
  await page.goto('/admin/stock/new');
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  await page.getByRole('button', { name: /^Kurta/ }).click();
  const box = page.getByRole('combobox', { name: /^Company/ });
  await box.click();
  await page.getByRole('listbox').getByRole('option', { name: company, exact: true }).click();
  await page.getByLabel('Product name').fill(name);
  await page.getByLabel('Sale price', { exact: true }).fill('999');
  await page.getByLabel('Purchase price', { exact: true }).fill('300');
  await openMore(page);
  await page.getByRole('button', { name: 'All sizes' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.keyboard.press('Escape');
}

test('a bill from products with a company: + All sizes, quantities and rates, the paper check, Edit bill, the list; delete', async ({ page }) => {
  await loginOwner(page);
  const company = `Bill Co ${run}`;
  const name = `Jeans One ${run}`;
  await page.goto('/admin/companies');
  await page.getByText('+ Add company').click();
  await page.getByLabel('Company name').fill(company);
  await page.getByRole('button', { name: 'Add company' }).click();
  await expect(page.getByRole('status')).toContainText(`${company} added.`);
  await addCollection(page, company, name); // 4 sizes × 1 pc × ₹300

  // Home → Bills → + New bill: nothing on it yet; the newest products are already listed.
  await page.goto('/admin/dashboard');
  await page.getByTestId('home-bills').click();
  await page.getByRole('link', { name: '+ New bill' }).click();
  const editor = billEditor(page);
  await expect(editor.getByTestId('bill-lines-empty')).toBeVisible();
  await expect(editor.getByTestId('bill-product').first()).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Next: check bill' })).toBeDisabled();
  await expect(editor.getByLabel(/amount/i)).toHaveCount(0);
  await chooseBillCompany(page, company);
  // + All sizes: every size with its pieces at its purchase price.
  await addToBill(page, name);
  const lines = editor.getByTestId('bill-line');
  await expect(lines).toHaveCount(4);
  await expect(editor.getByTestId('bill-total')).toHaveText('₹1,200.00');
  await expect(editor.getByRole('button', { name: `Add ${name} · M`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  // The lines are a table like the paper: S.N · Product · Qty · Purchase ₹ · Total ₹.
  await expect(editor.getByTestId('bill-lines').locator('thead').getByRole('columnheader')).toHaveText(['S.N', 'Product', 'Qty', 'Purchase ₹', 'Total ₹']);
  // Type over a line (3 pieces at ₹280; Enter moves to the next box, never to step 2), take another off.
  const qtyM = editor.getByLabel(`Quantity of ${name} · M`);
  await qtyM.fill('3');
  await qtyM.press('Enter');
  await expect(editor.getByLabel(`Purchase price of ${name} · M ₹`)).toBeFocused();
  await editor.getByLabel(`Purchase price of ${name} · M ₹`).fill('280');
  await expect(lines.first().getByTestId('bill-line-amount')).toHaveText('840.00');
  await expect(editor).toHaveAttribute('data-step', 'pick');
  await editor.getByRole('button', { name: `Take off ${name} · XXL` }).click();
  await expect(lines).toHaveCount(3);
  // Undo brings it back in its place; taken off again, it stays off.
  await editor.getByTestId('bill-line-removed').getByRole('button', { name: 'Undo' }).click();
  await expect(lines).toHaveCount(4);
  await expect(lines.nth(3)).toContainText('XXL');
  await editor.getByRole('button', { name: `Take off ${name} · XXL` }).click();
  await expect(lines).toHaveCount(3);
  await expect(editor.getByTestId('bill-units')).toHaveText('5');
  await expect(editor.getByTestId('bill-total')).toHaveText('₹1,440.00');
  await expect(editor.getByTestId('bill-picked')).toHaveText('3 items · 5 pcs');

  // Step 2: like the paper — party, bill no., date, S.N · goods · qty · rate · amount, total.
  await editor.getByRole('button', { name: 'Next: check bill' }).click();
  await expect(editor).toHaveAttribute('data-step', 'check');
  await expect(editor.getByTestId('bill-party')).toContainText(company);
  const sheet = editor.getByTestId('bill-sheet');
  await expect(sheet.locator('thead').getByRole('columnheader')).toHaveText(['S.N', 'Product', 'Qty', 'Purchase ₹', 'Total ₹']);
  await expect(sheet.getByTestId('bill-sheet-line')).toHaveCount(3);
  await expect(sheet.getByTestId('bill-sheet-line').first()).toHaveText(new RegExp(`^1\\.${name}M3280\\.00840\\.00$`));
  await expect(sheet.getByTestId('bill-sheet-total')).toHaveText('1,440.00');
  // The phone's back button goes back to the lines (nothing lost), then Next again.
  await page.goBack();
  await expect(editor).toHaveAttribute('data-step', 'pick');
  await expect(lines).toHaveCount(3);
  await editor.getByRole('button', { name: 'Next: check bill' }).click();
  await editor.getByLabel('Bill no. (optional)').fill(`JB-${run}`);
  await editor.getByLabel('Bill date').fill('2026-11-01'); // backdated
  await editor.getByRole('button', { name: 'Save bill' }).click();
  await expect(page).toHaveURL(/\/admin\/bills\/[0-9a-f-]{36}$/);
  const billUrl = page.url();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`bill JB-${run}`);
  await expect(page.getByTestId('bill-detail-total')).toHaveText('₹1,440.00');
  await expect(page.getByTestId('bill-companies')).toContainText(company);
  await expect(page.getByTestId('bill-companies')).toContainText('₹1,440.00');
  await expect(page.getByTestId('bill-sheet').getByTestId('bill-sheet-line')).toHaveCount(3);

  // Edit bill: one more piece of M (typed over); the number stays; the amount follows.
  await page.getByTestId('edit-bill').click();
  await expect(page).toHaveURL(/\/edit$/);
  await expect(editor.getByTestId('bill-line')).toHaveCount(3);
  await expect(editor.getByLabel(`Quantity of ${name} · M`)).toHaveValue('3');
  await editor.getByLabel(`Quantity of ${name} · M`).fill('4');
  await expect(editor.getByTestId('bill-total')).toHaveText('₹1,720.00');
  await editor.getByRole('button', { name: 'Next: check bill' }).click();
  await expect(editor.getByLabel('Bill no. (optional)')).toHaveValue(`JB-${run}`);
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(page).toHaveURL(billUrl);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('bill-detail-total')).toHaveText('₹1,720.00');

  // The Bills list shows it with its company and what is due.
  await page.goto('/admin/bills');
  const row = page.getByTestId('bill-list').getByRole('link').filter({ hasText: `JB-${run}` });
  await expect(row).toContainText(company);
  await expect(row).toContainText('3 items · 6 pcs');
  await expect(row).toContainText('Due ₹1,720.00');

  // A second bill can be deleted after a confirmation.
  await page.goto('/admin/bills/new');
  await addToBill(page, name, 'L');
  await editor.getByRole('button', { name: 'Next: check bill' }).click();
  await editor.getByRole('button', { name: 'Save bill' }).click();
  await expect(page).toHaveURL(/\/admin\/bills\/[0-9a-f-]{36}$/);
  await expect(page).not.toHaveURL(billUrl);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Delete bill' }).click();
  await page.getByTestId('confirm-delete-bill').click();
  await expect(page).toHaveURL(/\/admin\/bills$/);
  await expect(page.getByTestId('bill-list')).toContainText(`JB-${run}`);
});

test('a company added from New bill is chosen there; a barcode gun adds tags (the same tag again = one more; a QR link works; an unknown code is said)', async ({ page }) => {
  await loginOwner(page);
  const fresh = `Bill New Co ${run}`;
  await page.goto('/admin/bills/new');
  const editor = billEditor(page);
  await editor.getByRole('combobox', { name: /^Company/ }).click();
  await page.getByRole('listbox').getByRole('option', { name: '+ New company…' }).click();
  await page.getByLabel('New company name').fill(fresh);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Company added')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(editor.getByRole('combobox', { name: /^Company/ })).toContainText(fresh);

  // A barcode gun types the tag and presses Enter: that item goes on the bill (one piece), never the form.
  const search = editor.getByLabel('Search an item: name, code or barcode');
  const qty = editor.getByLabel('Quantity of Anarkali Kurta · M'); // never its colour (ADR-049)
  await search.fill('8902222000016'); // Anarkali Kurta M Blue (demo)
  await search.press('Enter');
  await expect(qty).toHaveValue('1');
  await expect(search).toHaveValue('');
  await expect(editor).toHaveAttribute('data-step', 'pick');
  await search.fill('8902222000016');
  await search.press('Enter');
  await expect(qty).toHaveValue('2');
  // The tag's QR holds a link: it finds the same item.
  await search.fill('https://maa-collection-pi.vercel.app/i/8902222000016');
  await search.press('Enter');
  await expect(qty).toHaveValue('3');
  await expect(editor.getByTestId('bill-line')).toHaveCount(1);
  await search.fill('2009999999999');
  await search.press('Enter');
  await expect(editor.getByRole('alert')).toContainText('No item has the code 2009999999999.');

  await editor.getByRole('button', { name: 'Next: check bill' }).click();
  await expect(editor.getByTestId('bill-party')).toContainText(fresh);
  await editor.getByRole('button', { name: 'Save bill' }).click();
  await expect(page).toHaveURL(/\/admin\/bills\/[0-9a-f-]{36}$/);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('bill-companies')).toContainText(fresh);
  // It is not offered twice in the bill's company box.
  await page.goto('/admin/bills/new');
  await editor.getByRole('combobox', { name: /^Company/ }).click();
  await expect(page.getByRole('listbox').getByRole('option', { name: fresh, exact: true })).toHaveCount(1);
});

test('a bill with no company; it keeps its copy when the item changes later (ADR-060/061)', async ({ page }) => {
  await loginOwner(page);
  const name = `Bill Item ${run}`;
  // An item with no company: sizes M and L, 3 pieces each, purchase ₹400 (the old form).
  await page.goto('/admin/stock/form');
  await page.getByLabel('Product name').fill(name);
  await page.getByLabel('Category').selectOption({ label: 'Kurta (KU)' });
  await page.getByLabel('Sale price (MRP) ₹').fill('999');
  await page.getByLabel('Purchase price ₹', { exact: true }).fill('400');
  await page.getByRole('tab', { name: 'Sizes', exact: true }).click();
  await page.getByRole('button', { name: 'Size M' }).click();
  await page.getByRole('button', { name: 'Size L' }).click();
  await page.getByRole('tab', { name: 'Details', exact: true }).click();
  await page.getByLabel('Pieces each').fill('3');
  await page.getByRole('button', { name: 'Save 2 items' }).click();
  await expect(page).toHaveURL(/\/admin\/labels\/print\?receipt=/);

  // New bill, no company: M starts at its 3 pieces (set to 2), L at 3 (set to 1).
  await page.goto('/admin/bills/new');
  const editor = billEditor(page);
  await addToBill(page, name, 'M');
  await expect(editor.getByLabel(`Quantity of ${name} · M`)).toHaveValue('3');
  await expect(editor.getByLabel(`Purchase price of ${name} · M ₹`)).toHaveValue('400');
  await editor.getByLabel(`Quantity of ${name} · M`).fill('2');
  await addToBill(page, name, 'L');
  await editor.getByLabel(`Quantity of ${name} · L`).fill('1');
  await expect(editor.getByTestId('bill-total')).toHaveText('₹1,200.00');
  await expect(editor.getByTestId('bill-picked')).toHaveText('2 items · 3 pcs');
  await editor.getByRole('button', { name: 'Next: check bill' }).click();
  await expect(editor.getByTestId('bill-party')).toContainText('No company');
  await expect(editor.getByTestId('bill-sheet-line')).toHaveCount(2);
  await expect(editor.getByTestId('bill-sheet-total')).toHaveText('1,200.00');
  await editor.getByLabel('Bill no. (optional)').fill(`IT-${run}`);
  await editor.getByRole('button', { name: 'Save bill' }).click();
  await expect(page).toHaveURL(/\/admin\/bills\/[0-9a-f-]{36}$/);
  const billUrl = page.url();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('bill-detail-total')).toHaveText('₹1,200.00');
  await expect(page.getByTestId('bill-no-company')).toHaveText('No company');
  await expect(page.getByTestId('bill-companies')).toHaveCount(0);
  await expect(page.getByTestId('bill-sheet-line').first()).toContainText(name);

  // The item is renamed and repriced on its page afterwards: the bill keeps its own copy.
  await openProduct(page, name);
  await page.getByTestId('edit-details').click();
  const details = page.getByTestId('details-sheet');
  await details.getByLabel('Name').fill(`${name} Renamed`);
  await details.getByLabel('Purchase ₹').fill('450');
  await details.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${name} Renamed`);
  await page.goto(billUrl);
  await expect(page.getByTestId('bill-detail-total')).toHaveText('₹1,200.00');
  await expect(page.getByTestId('bill-sheet-line').first()).toContainText(name);
  await expect(page.getByTestId('bill-sheet-line').first()).not.toContainText('Renamed');

  // The Bills list: no company, its items, its total; nothing due.
  await page.goto('/admin/bills');
  const row = page.getByTestId('bill-list').getByRole('link').filter({ hasText: `bill IT-${run}` });
  await expect(row).toContainText('No company');
  await expect(row).toContainText('2 items · 3 pcs');
  await expect(row).toContainText('₹1,200.00');
  await expect(row).not.toContainText('Due');
});

test('Make bill on a product page: New bill starts with its sizes (pieces in stock, purchase price) and its company', async ({ page }) => {
  await loginOwner(page);
  const name = `Make Bill ${run}`;
  await addCollection(page, 'Royal Garments', name); // 4 sizes × 1 pc × ₹300
  await openProduct(page, name);
  await page.getByTestId('make-bill').click();
  await expect(page).toHaveURL(/\/admin\/bills\/new\?product=/);
  const editor = billEditor(page);
  await expect(editor.getByTestId('bill-line')).toHaveCount(4);
  await expect(editor.getByTestId('bill-total')).toHaveText('₹1,200.00');
  await expect(editor.getByRole('combobox', { name: /^Company/ })).toContainText('Royal Garments');
  await expect(editor.getByLabel(`Purchase price of ${name} · M ₹`)).toHaveValue('300');
});
