import { expect, test } from '@playwright/test';

// Plan v8: colour themes + day/night, remembered on this phone; PIN keypad on login.
test('theme and day/night apply at once and stay after a reload', async ({ page }) => {
  await page.goto('/login');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'peacock');

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
