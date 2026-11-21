import { test, expect, type Page } from '@playwright/test';

/**
 * Typing in Hindi or English (owner's feedback 2026-11-20): every name / note box
 * has अ / A (switch the script for this phone), ⇄ (change what is typed), and a
 * microphone (voice) where the browser supports it.
 */
const PIN = '1234';

async function loginOwner(page: Page) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByText('Owner', { exact: true }).click();
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test('New item: type a name in Hindi from English letters, change it back, the choice follows to other boxes', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/admin/stock/new');
  await page.getByRole('button', { name: /^Many items/ }).click();
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  await page.getByRole('button', { name: /^Kurta/ }).click();

  const name = page.getByLabel('Product name');
  await page.getByRole('button', { name: 'Type in Hindi' }).first().click();
  await name.pressSequentially('chikan kurta ');
  await expect(name).toHaveValue('चिकन कुर्ता ');
  await expect(name).toHaveAttribute('lang', 'hi');
  // A word still being typed changes when the box loses focus.
  await name.pressSequentially('blue');
  await page.getByLabel('Sale price (MRP) ₹').click();
  await expect(name).toHaveValue('चिकन कुर्ता ब्लू');

  // ⇄ changes what is typed to English letters and switches the script back.
  await page.getByRole('button', { name: 'Change to English' }).first().click();
  await expect(name).toHaveValue('Chikan Kurta Blue');
  await expect(name).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Type in Hindi' }).first()).toBeVisible();

  // The choice is for the whole phone: the brand box (under More) follows it.
  await page.getByRole('button', { name: 'Type in Hindi' }).first().click();
  await page.goto('/admin/companies');
  await page.getByText('+ Add company').click();
  const company = page.getByLabel('Company name');
  await expect(company).toHaveAttribute('lang', 'hi');
  await company.pressSequentially('surat silks ');
  await expect(company).toHaveValue('सूरत सिल्क्स ');
  // Back to English for the other tests on this browser.
  await page.getByRole('button', { name: 'Type in English' }).first().click();
  await expect(company).toHaveAttribute('lang', 'en');
});

test('a microphone sits next to name boxes where the browser can listen; it says when nothing was heard', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'speech recognition is a Chromium feature');
  await loginOwner(page);
  await page.goto('/admin/companies');
  await page.getByText('+ Add company').click();
  const row = page.getByLabel('Company name').locator('..');
  const mic = row.getByRole('button', { name: 'Speak to fill' });
  await expect(mic).toBeVisible();
  // No microphone in a test browser: the box explains instead of failing quietly.
  await mic.click();
  await expect(row.getByRole('alert').or(page.getByRole('button', { name: 'Listening… tap to stop' }))).toBeVisible();
});

test('New item: back after one or two steps starts fresh; after three it asks to continue or start a fresh collection; "Start again" clears on the spot', async ({ page }) => {
  await loginOwner(page);
  const start = () => expect(page.getByRole('heading', { level: 2, name: 'What are you adding?' })).toBeVisible();
  const away = async () => {
    await page.getByRole('link', { name: /^(Home|Dashboard)$/ }).first().click(); // the dock on a phone, the side menu on a desktop
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/stock\/new$/);
  };
  const toDetails = async () => {
    await page.getByRole('button', { name: /^Many items/ }).click();
    await page.getByRole('button', { name: 'Men', exact: true }).click();
    await page.getByRole('button', { name: /^Kurta/ }).click();
  };

  // Two steps (who, what) and nothing typed: a fresh start, no question.
  await page.goto('/admin/stock/new');
  await page.getByRole('button', { name: /^Many items/ }).click();
  await page.getByRole('button', { name: 'Men', exact: true }).click();
  await page.getByRole('button', { name: /^Kurta/ }).click();
  await away();
  await start();
  await expect(page.getByTestId('resume-sheet')).toHaveCount(0);

  // Three steps with details typed: the question — continue keeps everything.
  await toDetails();
  await page.getByLabel('Product name').fill('Half typed');
  await away();
  const sheet = page.getByTestId('resume-sheet');
  await expect(sheet).toContainText('You were in the middle of this');
  await sheet.getByRole('button', { name: 'Continue where I left off' }).click();
  await expect(page.getByLabel('Product name')).toHaveValue('Half typed');

  // The same question answered with a fresh collection: back to the start, empty.
  await away();
  await sheet.getByRole('button', { name: 'Start a fresh entry' }).click();
  await start();
  await toDetails();
  await expect(page.getByLabel('Product name')).toHaveValue('');

  // Start again: asks once when something is typed, then everything is cleared.
  await page.getByLabel('Product name').fill('Half typed again');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('start-over').click();
  await start();
  await toDetails();
  await expect(page.getByLabel('Product name')).toHaveValue('');

  // The earlier form too.
  await page.goto('/admin/stock/form');
  await page.getByLabel('Product name').fill('Old form half typed');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('start-over').click();
  await expect(page.getByLabel('Product name')).toHaveValue('');
});
