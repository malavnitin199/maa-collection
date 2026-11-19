import { expect, test } from '@playwright/test';

// Plan v8: colour themes + day/night, remembered on this phone; PIN keypad on login.
test('theme and day/night apply at once and stay after a reload', async ({ page }) => {
  await page.goto('/login');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'bahi'); // default since plan v16

  await page.getByRole('button', { name: 'Theme and day/night' }).click();
  const panel = page.getByRole('dialog', { name: 'Look' });
  await panel.getByRole('radio', { name: 'Rani' }).click();
  await panel.getByRole('radio', { name: 'Night' }).click();
  await expect(html).toHaveAttribute('data-theme', 'rani');
  await expect(html).toHaveAttribute('data-mode', 'dark');
  await expect(panel.getByRole('radio', { name: 'Rani' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();

  // Set before the first paint on the next visit (no flash of the default colours).
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'rani');
  await expect(html).toHaveAttribute('data-mode', 'dark');

  await page.getByRole('button', { name: 'Theme and day/night' }).click();
  await panel.getByRole('radio', { name: 'Peacock' }).click();
  await panel.getByRole('radio', { name: 'Day' }).click();
  await expect(html).toHaveAttribute('data-theme', 'peacock');
  await expect(html).toHaveAttribute('data-mode', 'light');

  // The three themes added on 2026-11-19 (Sindoor, Jamun, Aasmani) are in the picker and apply too.
  await expect(panel.getByRole('radiogroup', { name: 'Colour theme' }).getByRole('radio')).toHaveText(['Peacock', 'Marigold', 'Rani', 'Neel', 'Mehendi', 'Sindoor', 'Jamun', 'Aasmani', 'Bahi']);
  for (const [name, id, main] of [['Sindoor', 'sindoor', '#b91c1c'], ['Jamun', 'jamun', '#7e22ce'], ['Aasmani', 'aasmani', '#0369a1']] as const) {
    await panel.getByRole('radio', { name }).click();
    await expect(html).toHaveAttribute('data-theme', id);
    // The brand scale really changes (the 600 step the header and buttons use).
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--b-600').trim())).toBe(main);
  }
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'aasmani');
});

test('the PIN keypad fills the PIN and logs in', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByText('Owner', { exact: true }).click();
  await expect(page.getByText('Hello Owner, enter your PIN')).toBeVisible();
  const keypad = page.getByRole('group', { name: 'Number keys' });
  for (const digit of ['1', '2', '3', '9']) await keypad.getByRole('button', { name: digit, exact: true }).click();
  await expect(page.getByLabel('PIN')).toHaveValue('1239');
  await keypad.getByRole('button', { name: 'Delete last digit' }).click();
  await keypad.getByRole('button', { name: '4', exact: true }).click();
  await expect(page.getByLabel('PIN')).toHaveValue('1234');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
});
