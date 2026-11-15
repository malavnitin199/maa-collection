import { expect, test, type Page } from '@playwright/test';

/*
 * Guide with voice (plan v9). Test browsers have no voices, so the phone's
 * speech engine is replaced by a stand-in that records what would be spoken;
 * `__finishSpeech()` ends the current sentence like a real voice would.
 */
async function fakeVoice(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __spoken: { text: string; lang: string }[]; __finishSpeech: () => void };
    w.__spoken = [];
    let current: SpeechSynthesisUtterance | null = null;
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      onvoiceschanged: null,
      getVoices: () => [],
      speak(u: SpeechSynthesisUtterance) {
        current = u;
        w.__spoken.push({ text: u.text, lang: u.lang });
      },
      cancel() {
        current = null;
      },
      pause() {},
      resume() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => true,
    };
    w.__finishSpeech = () => {
      const u = current;
      current = null;
      u?.onend?.(new Event('end') as SpeechSynthesisEvent);
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    localStorage.setItem('maa-sound', 'off');
  });
}

const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: { text: string; lang: string }[] }).__spoken);
const finish = (page: Page) => page.evaluate(() => (window as unknown as { __finishSpeech: () => void }).__finishSpeech());

test('Listen reads a lesson step by step and lights up the step being read', async ({ page }) => {
  await fakeVoice(page);
  await page.goto('/guide');
  const lesson = page.locator('#sell');
  await lesson.getByRole('button', { name: 'Listen to: Sell an item' }).click();

  // First the title and intro, then step 1 — the number isn't read, symbols are dropped.
  await expect.poll(async () => (await spoken(page)).at(-1)?.text).toBe('Sell an item. Scan, check, agree the price, record. Stock goes down on every phone at once.');
  expect((await spoken(page)).at(-1)?.lang).toBe('en-IN');
  await finish(page);
  await expect.poll(async () => (await spoken(page)).at(-1)?.text).toMatch(/^Tap the round Sell button \(middle of the bottom bar\), Scan with camera/);
  await expect(lesson.locator('li[aria-current="step"]')).toContainText('Tap the round Sell button');
  const player = lesson.getByRole('group', { name: 'Voice controls: Sell an item' });
  await expect(player).toContainText('2 of 7');

  await player.getByRole('button', { name: 'Next step' }).click();
  await expect(lesson.locator('li[aria-current="step"]')).toContainText('Check the photo, size and colour');
  await player.getByRole('button', { name: 'Pause' }).click();
  await expect(player.getByRole('button', { name: 'Continue' })).toBeVisible();
  await player.getByRole('button', { name: 'Stop' }).click();
  await expect(lesson.locator('[aria-current="step"]')).toHaveCount(0);
  await expect(lesson.getByRole('button', { name: 'Listen to: Sell an item' })).toBeVisible();

  // Tap a part of the tag to hear just that part.
  await page.getByRole('button', { name: 'Hear: MRP' }).click();
  await expect.poll(async () => (await spoken(page)).at(-1)?.text).toMatch(/^MRP\. /);
});

test('the voice speaks Hindi for a Hindi reader', async ({ page }) => {
  await fakeVoice(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Language: English. Switch to Hindi' }).click();
  await page.getByText('अपने नाम पर टैप करें और PIN डालें।').waitFor();
  await page.goto('/guide');
  await page.locator('#look').getByRole('button', { name: 'सुनें: रंग और दिन/रात' }).click();
  await expect.poll(async () => (await spoken(page)).at(-1)).toEqual({ text: 'रंग और दिन/रात. ऐप को अपना बनाएँ: दुकान के पाँच रंग, और शाम के लिए गहरी स्क्रीन।', lang: 'hi-IN' });
});

test('practice sale: scan the sample tag, a price above MRP is refused, then "Sale done" — nothing saved', async ({ page }) => {
  await fakeVoice(page);
  await page.goto('/guide');
  const practice = page.getByTestId('practice-sale');
  await practice.scrollIntoViewIfNeeded();
  await practice.getByRole('button', { name: 'Scan this tag' }).click();
  await expect.poll(async () => (await spoken(page)).at(-1)?.text).toMatch(/^Good scan\./);
  await expect(practice).toContainText('4 in stock · MRP ₹1,499.00');
  await practice.getByRole('button', { name: 'Sell this item' }).click();
  await practice.getByLabel('Sale price (₹)').fill('1600');
  await practice.getByRole('button', { name: 'Record sale' }).click();
  await expect(practice.getByRole('alert')).toHaveText('Above MRP (₹1,499.00). Type a lower price.');
  await practice.getByLabel('Sale price (₹)').fill('1299');
  await expect(practice).toContainText('Total: ₹1,299.00');
  await practice.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByText('Sale done', { exact: true })).toBeVisible();
  await expect(practice).toContainText('Well done!');
  await expect.poll(async () => (await spoken(page)).at(-1)?.text).toMatch(/^Sale done!/);
  await practice.getByRole('button', { name: 'Practise again' }).click();
  await expect(practice.getByRole('button', { name: 'Scan this tag' })).toBeVisible();
});
