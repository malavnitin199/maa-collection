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
    // 450 until 2026-11-23; raised for the lessons on bills, companies, collections and the item page (ADR-067).
    expect(total).toBeLessThan(600);
  });

  it('covers the screens that came since ADR-040 and drops the retired ones (ADR-067)', () => {
    const ids = STORIES.map((s) => s.id);
    for (const id of ['bill', 'item', 'companies', 'bills', 'collections']) expect(ids, id).toContain(id);
    const all = STORIES.flatMap((s) => [s.title.en, s.goal.en, s.tip?.en ?? '', ...s.steps.flatMap((step) => [step.text.en, step.say.en])]).join(' ');
    // Rates by size went with ADR-061, the One / Many start with ADR-064; Staff says Remove (ADR-029).
    for (const gone of ['Rates for the whole design', 'Price by size', 'Deactivate', 'One item', 'Many items?']) expect(all, gone).not.toContain(gone);
  });

  it('follows ADR-068: the photo box, selecting a few, size only, today’s words (ADR-069)', () => {
    const lesson = (id: string) => STORIES.find((s) => s.id === id)!;
    expect(lesson('item').steps.map((s) => s.scene.kind)).toContain('photobox');
    for (const id of ['print', 'approve']) expect(lesson(id).steps.some((s) => s.scene.kind === 'select'), id).toBe(true);
    const all = STORIES.flatMap((s) => [s.title.en, s.goal.en, s.tip?.en ?? '', ...s.steps.flatMap((step) => [step.text.en, step.say.en])]).join(' ');
    // Colour lives on the product page (ADR-049); the waiting strip is not yellow online; a day column is not tappable;
    // Record a payment is a heading, the button is Save payment.
    for (const gone of ['colour, MRP', 'yellow strip', 'Tap a day', 'tap Record a payment']) expect(all, gone).not.toContain(gone);
  });

  it('follows ADR-072: the Bulk addition lesson; the photo and "add more" in New item', () => {
    const lesson = (id: string) => STORIES.find((s) => s.id === id)!;
    expect(lesson('bulk').steps.map((s) => s.scene.kind)).toEqual(['tiles', 'bill', 'buttons']);
    expect(lesson('bulk').open?.href).toBe('/admin/stock/bulk');
    const newItem = lesson('new-design').steps.map((s) => s.say.en).join(' ');
    expect(newItem).toContain('Add photo');
    expect(newItem).toContain('Save and add more');
    const all = STORIES.flatMap((s) => s.steps.flatMap((step) => [step.text.en, step.say.en])).join(' ');
    expect(all).not.toContain('add next'); // "Save & add next" became "Save & add more <category>"
  });
});
