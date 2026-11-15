import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/lib/i18n';
import { AUDIENCES, STORIES } from './stories';

const words = (text: string) => text.replace(/\*\*/g, '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const hasHindi = (text: string) => /[ऀ-ॿ]/.test(text);

describe('Guide stories stay short, complete and in both languages', () => {
  it('has unique ids and lessons for every part', () => {
    expect(new Set(STORIES.map((s) => s.id)).size).toBe(STORIES.length);
    for (const audience of AUDIENCES) expect(STORIES.some((s) => s.audience === audience)).toBe(true);
  });

  it('keeps every lesson to 2–5 steps of at most 7 words on screen', () => {
    for (const story of STORIES) {
      expect(story.steps.length, story.id).toBeGreaterThanOrEqual(2);
      expect(story.steps.length, story.id).toBeLessThanOrEqual(5);
      for (const locale of LOCALES) {
        expect(words(story.title[locale]), `${story.id} title`).toBeLessThanOrEqual(4);
        expect(words(story.goal[locale]), `${story.id} goal`).toBeLessThanOrEqual(9);
        if (story.tip) expect(words(story.tip[locale]), `${story.id} tip`).toBeLessThanOrEqual(12);
        for (const step of story.steps) {
          expect(words(step.text[locale]), `${story.id}: ${step.text[locale]}`).toBeLessThanOrEqual(7);
          // The voice may say more than the screen, but stays one or two short sentences.
          expect(words(step.say[locale]), `${story.id}: ${step.say[locale]}`).toBeLessThanOrEqual(26);
        }
      }
    }
  });

  it('has Hindi for every line, and bold marks come in pairs', () => {
    for (const story of STORIES) {
      const lines = [story.title, story.goal, ...(story.tip ? [story.tip] : []), ...(story.open ? [story.open.label] : []), ...story.steps.flatMap((s) => [s.text, s.say])];
      for (const line of lines) {
        expect(line.en.trim(), story.id).not.toBe('');
        expect(hasHindi(line.hi), `${story.id}: ${line.hi}`).toBe(true);
        for (const locale of LOCALES) expect((line[locale].match(/\*\*/g) ?? []).length % 2, line[locale]).toBe(0);
      }
    }
  });

  it('is far shorter than the old guide (about 1,600 words)', () => {
    const total = STORIES.reduce((n, s) => n + words(s.title.en) + words(s.goal.en) + (s.tip ? words(s.tip.en) : 0) + s.steps.reduce((m, step) => m + words(step.text.en), 0), 0);
    expect(total).toBeLessThan(450);
  });
});
