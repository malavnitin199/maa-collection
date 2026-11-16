import { expect, test, type Page } from '@playwright/test';

/*
 * The Guide as short stories with voice (plan v10). Test browsers have no
 * voices, so the phone's speech engine is replaced by a stand-in that records
 * what would be spoken; `__finishSpeech()` ends the current sentence like a
 * real voice would.
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
    // The dev-only Next.js overlay (never in production) can pop a notice over the
    // story's buttons on a phone-size screen; keep it out of the way in these tests.
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.append(style);
    });
  });
}

const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: { text: string; lang: string }[] }).__spoken);
const finish = (page: Page) => page.evaluate(() => (window as unknown as { __finishSpeech: () => void }).__finishSpeech());

test('a lesson plays as a story: few words, the voice says more, and it moves on by itself', async ({ page }) => {
  await fakeVoice(page);
  await page.goto('/guide');
  await page.getByRole('button', { name: 'Selling', exact: true }).click();
  await page.getByTestId('guide-lessons').getByRole('button', { name: /Sell an item/ }).click();
  await expect(page).toHaveURL(/\/guide#sell$/);

  const story = page.getByRole('dialog', { name: 'Sell an item' });
  const text = story.getByTestId('story-text');
  await expect(text).toHaveText('Scan the tag');
  await expect(story.getByTestId('story-count')).toHaveText('1 of 5');
  // On screen: three words. The voice gives the fuller guidance.
  await expect.poll(async () => (await spoken(page)).at(-1)).toEqual({ text: 'Tap Sell, then Scan with camera, and hold the tag in the box. You hear a ting.', lang: 'en-IN' });

  // When the voice finishes, the next step comes by itself.
  await finish(page);
  await expect(text).toHaveText('Check size and colour');
  await expect.poll(async () => (await spoken(page)).at(-1)?.text).toMatch(/^Check the photo, size and colour/);

  // Next / Back, and the arrow keys.
  await story.getByRole('button', { name: 'Next step' }).click();
  await expect(text).toHaveText('Type the agreed price');
  await story.getByRole('button', { name: 'Back a step' }).click();
  await expect(text).toHaveText('Check size and colour');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(text).toHaveText('Record sale ✓');

  // Voice off: nothing more is spoken, and the story waits for a tap.
  await story.getByRole('button', { name: 'Voice' }).click();
  await expect(story.getByRole('button', { name: 'Voice' })).toHaveAttribute('aria-pressed', 'false');
  const before = (await spoken(page)).length;
  await story.getByRole('button', { name: 'Next step' }).click();
  await expect(text).toHaveText("Tag won't scan? Enter by hand");
  expect((await spoken(page)).length).toBe(before);
  await story.getByRole('button', { name: 'Next step' }).click();
  await expect(text).toHaveText('Scan, price, record.');

  // "Got it" ticks the lesson and returns to the list.
  await story.getByRole('button', { name: 'Got it ✓' }).click();
  await expect(story).toBeHidden();
  await expect(page.getByTestId('guide-progress')).toContainText('1 of 16 learned');
  await expect(page).not.toHaveURL(/#sell$/);
});

test('links open a lesson or a part; the voice speaks Hindi for a Hindi reader', async ({ page }) => {
  await fakeVoice(page);
  await page.goto('/guide#for-owner');
  await expect(page.getByRole('button', { name: 'Owner', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('guide-lessons').getByRole('button', { name: /Reports/ })).toBeVisible();

  await page.goto('/login');
  await page.getByRole('button', { name: 'Language: English. Switch to Hindi' }).click();
  await page.getByText('अपने नाम पर टैप करें और PIN डालें।').waitFor();
  await page.goto('/guide#look');
  const story = page.getByRole('dialog', { name: 'भाषा और रंग' });
  await expect(story.getByTestId('story-text')).toHaveText('ऊपर अ / A दबाएँ');
  // No tap yet on this page, so start the voice by turning it off and on.
  await story.getByRole('button', { name: 'आवाज़' }).click();
  await story.getByRole('button', { name: 'आवाज़' }).click();
  await expect.poll(async () => (await spoken(page)).at(-1)).toEqual({ text: 'ऊपर अ या A वाला बटन दबाकर हिन्दी और अंग्रेज़ी बदलें। आपकी पसंद याद रहती है।', lang: 'hi-IN' });
});

test('practice sale at the end of the Sell lesson: above MRP is refused, then "Sale done" — nothing saved', async ({ page }) => {
  await fakeVoice(page);
  await page.goto('/guide#sell');
  const story = page.getByRole('dialog', { name: 'Sell an item' });
  for (let i = 0; i < 5; i++) await story.getByRole('button', { name: 'Next step' }).click();
  await story.getByRole('button', { name: 'Try it: practice a sale' }).click();
  const practice = story.getByTestId('practice-sale');
  await practice.getByRole('button', { name: 'Scan this tag' }).click();
  await expect.poll(async () => (await spoken(page)).at(-1)?.text).toMatch(/^Good scan\./);
  await expect(practice).toContainText('4 in stock · MRP ₹1,499.00');
  await practice.getByRole('button', { name: 'Sell this item' }).click();
  await practice.getByLabel('Sale price (₹)').fill('1600');
  await practice.getByRole('button', { name: 'Record sale' }).click();
  await expect(practice.getByRole('alert')).toHaveText('Above MRP (₹1,499.00). Type a lower price.');
  await practice.getByLabel('Sale price (₹)').fill('1299');
  await practice.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByText('Sale done', { exact: true })).toBeVisible();
  await expect(practice).toContainText('Well done!');
  await expect(practice).toContainText('Practice only — nothing was saved.');
});
