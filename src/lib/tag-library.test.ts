import { describe, expect, it } from 'vitest';
import {
  capGroups,
  groupTags,
  hasTagFilters,
  parseTagParams,
  shopDay,
  tagFilter,
  tagLibraryHref,
  tagPrintHref,
  TAG_LIMIT_MAX,
  TAG_PAGE,
  type GroupableTag,
} from './tag-library';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const R1 = '33333333-3333-4333-8333-333333333333';
const R2 = '44444444-4444-4444-8444-444444444444';

type Row = GroupableTag & { id: string };
const row = (id: string, over: Partial<Row> = {}): Row => ({
  id,
  createdAt: new Date('2026-11-16T06:00:00Z'),
  stock: 1,
  supplierId: null,
  supplierName: null,
  categoryId: null,
  category: '',
  createdByName: 'Owner',
  receiptId: null,
  receiptBill: null,
  receiptAt: null,
  ...over,
});

describe('All tags address', () => {
  it('uses defaults and drops anything malformed', () => {
    expect(parseTagParams({})).toEqual({ q: '', when: 'all', stock: false, group: 'date', show: 'designs', limit: TAG_PAGE, supplier: undefined, category: undefined, made: undefined, key: undefined, design: undefined });
    const p = parseTagParams({ supplier: 'x', category: "1' or 1=1", made: '12', when: 'year', group: 'colour', key: '../etc', limit: 'lots', stock: 'yes' });
    expect(p).toMatchObject({ supplier: undefined, category: undefined, made: undefined, when: 'all', group: 'date', key: undefined, limit: TAG_PAGE, stock: false });
  });

  it('reads valid values, "no company", and keeps Show more within limits', () => {
    const p = parseTagParams({ q: '  kurta ', supplier: 'none', category: A, made: B, when: '7d', stock: 'in', group: 'delivery', key: R1, limit: '240' });
    expect(p).toMatchObject({ q: 'kurta', supplier: 'none', category: A, made: B, when: '7d', stock: true, group: 'delivery', key: R1, limit: 240 });
    expect(tagFilter(p)).toEqual({ search: 'kurta', supplierId: 'none', categoryId: A, createdBy: B, when: '7d', inStockOnly: true });
    expect(parseTagParams({ limit: '5' }).limit).toBe(TAG_PAGE);
    expect(parseTagParams({ limit: '99999' }).limit).toBe(TAG_LIMIT_MAX);
    expect(parseTagParams({ key: '2026-11-16' }).key).toBe('2026-11-16');
    expect(parseTagParams({ q: ['first', 'second'] }).q).toBe('first');
  });

  it('builds short links: defaults are left out, Show more only when asked', () => {
    const p = parseTagParams({ supplier: A, when: '30d', group: 'company', limit: '240' });
    expect(hasTagFilters(p)).toBe(true);
    expect(hasTagFilters(parseTagParams({ group: 'company' }))).toBe(false);
    expect(tagLibraryHref(parseTagParams({}))).toBe('/admin/labels');
    expect(tagLibraryHref(p)).toBe(`/admin/labels?supplier=${A}&when=30d&group=company`);
    expect(tagLibraryHref(p, { limit: 360 })).toBe(`/admin/labels?supplier=${A}&when=30d&group=company&limit=360`);
    expect(tagLibraryHref(p, { group: 'date' })).toBe(`/admin/labels?supplier=${A}&when=30d`);
    expect(tagPrintHref(p)).toBe(`/admin/labels/print?supplier=${A}&when=30d&group=company&list=1`);
    expect(tagPrintHref(p, A)).toBe(`/admin/labels/print?supplier=${A}&when=30d&group=company&list=1&key=${A}`);
    // Every tag (plan v14) stays in the page address; a design prints on its own.
    const tags = parseTagParams({ show: 'tags', group: 'company' });
    expect(tags.show).toBe('tags');
    expect(tagLibraryHref(tags)).toBe('/admin/labels?group=company&show=tags');
    expect(tagLibraryHref(tags, { show: 'designs' })).toBe('/admin/labels?group=company');
    const design = `${A}~149900~silk saree`;
    expect(parseTagParams({ design }).design).toBe(design);
    expect(parseTagParams({ design: 'drop table' }).design).toBeUndefined();
    expect(tagPrintHref(tags, A, design)).toBe(`/admin/labels/print?group=company&list=1&key=${A}&${new URLSearchParams({ design })}`);
  });
});

describe('grouping tags', () => {
  it('finds the shop day in India, not UTC', () => {
    expect(shopDay(new Date('2026-11-15T18:00:00Z'))).toBe('2026-11-15'); // 23:30 IST
    expect(shopDay(new Date('2026-11-15T19:00:00Z'))).toBe('2026-11-16'); // 00:30 IST
  });

  it('by date: newest day first, rows keep their order, pieces add up', () => {
    const rows = [
      row('a', { createdAt: new Date('2026-11-16T05:00:00Z'), stock: 3 }),
      row('b', { createdAt: new Date('2026-11-14T05:00:00Z') }),
      row('c', { createdAt: new Date('2026-11-15T19:30:00Z'), stock: -1 }), // 01:00 IST on the 16th
    ];
    const groups = groupTags(rows, 'date');
    expect(groups.map((g) => [g.key, g.items.map((r) => r.id), g.pieces])).toEqual([
      ['2026-11-16', ['a', 'c'], 3],
      ['2026-11-14', ['b'], 1],
    ]);
  });

  it('by company and category: A–Z, ignoring case, "none" last', () => {
    const rows = [
      row('a', { supplierId: A, supplierName: 'royal Garments', categoryId: A, category: 'Saree' }),
      row('b', { supplierId: null, category: 'Kurta' }),
      row('c', { supplierId: B, supplierName: 'Laxmi Fashion', categoryId: B, category: 'Kurti' }),
      row('d', { supplierId: A, supplierName: 'royal Garments', categoryId: null, category: '' }),
    ];
    expect(groupTags(rows, 'company').map((g) => [g.name, g.items.map((r) => r.id)])).toEqual([
      ['Laxmi Fashion', ['c']],
      ['royal Garments', ['a', 'd']],
      [null, ['b']],
    ]);
    // An item not linked to a category goes to "No category".
    expect(groupTags(rows, 'category').map((g) => [g.key, g.name, g.items.map((r) => r.id)])).toEqual([
      [B, 'Kurti', ['c']],
      [A, 'Saree', ['a']],
      ['none', null, ['b', 'd']],
    ]);
  });

  it('by delivery: newest delivery first with its bill and person; items added one by one last', () => {
    const rows = [
      row('a', { receiptId: R1, receiptAt: new Date('2026-11-14T05:00:00Z'), receiptBill: '771', supplierName: 'Royal', createdByName: 'Nitin' }),
      row('b'),
      row('c', { receiptId: R2, receiptAt: new Date('2026-11-16T05:00:00Z') }),
      row('d', { receiptId: R1, receiptAt: new Date('2026-11-14T05:00:00Z'), receiptBill: '771', supplierName: 'Royal' }),
    ];
    const groups = groupTags(rows, 'delivery');
    expect(groups.map((g) => [g.key, g.items.map((r) => r.id)])).toEqual([
      [R2, ['c']],
      [R1, ['a', 'd']],
      ['none', ['b']],
    ]);
    expect(groups[1]).toMatchObject({ name: 'Royal', delivery: { bill: '771', by: 'Nitin' } });
    expect(groups[2].delivery).toBeUndefined();
  });

  it('draws only the first tags but keeps every group’s full count', () => {
    const groups = groupTags(
      [row('a'), row('b'), row('c', { createdAt: new Date('2026-11-10T05:00:00Z') }), row('d', { createdAt: new Date('2026-11-01T05:00:00Z') })],
      'date',
    );
    const capped = capGroups(groups, 3);
    expect(capped.total).toBe(4);
    expect(capped.shown).toBe(3);
    expect(capped.groups.map((g) => [g.key, g.shown.length, g.items.length])).toEqual([
      ['2026-11-16', 2, 2],
      ['2026-11-10', 1, 1],
    ]);
    expect(capGroups(groups, 100).shown).toBe(4);
  });
});
